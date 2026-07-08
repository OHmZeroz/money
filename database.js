// database.js - ฐานข้อมูลของนักเรียนและสถานะการจ่ายเงิน ดึงจาก Google Sheets
// ข้อมูลนี้ถูกเก็บไว้ใน localStorage เพื่อประหยัดสถานะเมื่อรีเฟรชหน้าจอ

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzyLZTH43Xv2y_PLg4qIPU13q3u15oT8iuyd9-7UzsqCLW2U2oAR7QNFkbtnS9bAOyOsw/exec";
const STORAGE_KEY = "classroom_payment_db_v3";
const MONTH_NAMES = {
    "June": "มิถุนายน",
    "July": "กรกฎาคม",
    "August": "สิงหาคม",
    "September": "กันยายน",
    "October": "ตุลาคม",
    "November": "พฤศจิกายน",
    "December": "ธันวาคม",
    "January": "มกราคม",
    "February": "กุมภาพันธ์",
    "March": "มีนาคม",
    "April": "เมษายน"
};

class ClassroomDatabase {
    constructor() {
        this.students = [];
        this.webAppUrl = WEB_APP_URL;
        
        // ไมเกรตลิงก์สคริปต์เก่าไปยังลิงก์ใหม่โดยอัตโนมัติบนเบราว์เซอร์ของผู้ใช้
        const savedUrl = localStorage.getItem("classroom_google_sheet_url");
        if (savedUrl && (
            savedUrl.includes("AKfycby8_S081Npo5vqtrLAFpWdcKSPSCZeYI8Ttx-HA7lMMRmpdBnUTdKzxuOV5azAldAhs") ||
            savedUrl.includes("AKfycbwAWJRG_Lroxn4HsVeNR1_weAylCgbO_l1gZuSMqq-HYGYAmNC5C4N6D8dVU9VcoARO") ||
            savedUrl.includes("AKfycbweU-0aOR-GHal1ZwSvG2b-Zt_kJ24Cyqma9cj4cJ5bNb5TIwXT7WiU-weawrhSDUCL")
        )) {
            localStorage.setItem("classroom_google_sheet_url", WEB_APP_URL);
        }
        
        this.loadDatabase();
    }

    // โหลดฐานข้อมูลจาก localStorage หรือใช้ค่าเริ่มต้นหากไม่มี
    loadDatabase() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // ตรวจสอบโครงสร้างข้อมูลเพื่อป้องกัน Error จากข้อมูลเก่าในเบราว์เซอร์
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].status) {
                    this.students = parsed;
                } else {
                    this.students = [];
                }
            } catch (e) {
                console.error("Error parsing stored database, resetting to empty", e);
                this.students = [];
            }
        } else {
            this.students = [];
        }
    }

    // เซฟฐานข้อมูลลง localStorage
    saveDatabase() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.students));
    }

    // ค้นหานักศึกษาด้วยรหัสนักศึกษา (Login)
    findStudentById(studentId) {
        if (!studentId) return null;
        const cleanId = studentId.trim();
        return this.students.find(s => s.id === cleanId);
    }

    // รับข้อมูลนักศึกษาทั้งหมด
    getAllStudents() {
        return this.students;
    }

    // อัปเดตสถานะการจ่ายเงินของนักศึกษา
    updatePaymentStatus(studentId, month, isPaid) {
        const student = this.findStudentById(studentId);
        if (student) {
            if (!student.status) {
                student.status = {};
            }
            student.status[month] = isPaid;
            this.saveDatabase();
            return true;
        }
        return false;
    }

    // นำเข้าข้อมูลรายชื่อนักศึกษาใหม่ (ใช้แทนข้อมูลเดิมทั้งหมด)
    importStudents(newStudentList) {
        this.students = newStudentList;
        this.saveDatabase();
    }

    // ฟังก์ชันคำนวณสถิติ
    getStats(month) {
        const total = this.students.length;
        const paidCount = this.students.filter(s => s.status && s.status[month]).length;
        const unpaidCount = total - paidCount;
        const paidAmount = paidCount * 100;
        const unpaidAmount = unpaidCount * 100;
        
        return {
            totalStudents: total,
            paidCount,
            unpaidCount,
            paidAmount,
            unpaidAmount,
            percentPaid: total > 0 ? Math.round((paidCount / total) * 100) : 0
        };
    }

    // แปลง URL ของ Google Sheets ให้เป็น URL สำหรับการดาวน์โหลด CSV
    getCsvUrl(sheetUrl) {
        if (!sheetUrl) return null;
        
        // ดึง Spreadsheet ID
        const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!idMatch) return null;
        const spreadsheetId = idMatch[1];
        
        // ดึง gid (id ของแผ่นงานย่อย) หากมี
        const gidMatch = sheetUrl.match(/gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : null;
        
        let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        if (gid) {
            url += `&gid=${gid}`;
        }
        return url;
    }

    // ตัวแปลงข้อมูล CSV แบบง่ายที่รองรับการครอบด้วยเครื่องหมายคำพูด (Quotes)
    parseCsv(csvText) {
        const lines = csvText.split(/\r?\n/);
        return lines.map(line => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        }).filter(row => row.length > 0 && row.some(cell => cell !== ""));
    }

    // ดึงข้อมูลสถานะการจ่ายเงินจาก Google Sheet และบันทึกเข้าสู่ระบบ
    async syncWithGoogleSheet(sheetUrl = WEB_APP_URL) {
        if (!sheetUrl) sheetUrl = WEB_APP_URL;
        
        // ตรวจสอบว่ารูปแแบบเป็น Google Apps Script Web App หรือไม่
        if (sheetUrl.includes("script.google.com")) {
            try {
                const response = await fetch(sheetUrl);
                if (!response.ok) {
                    throw new Error("ดาวน์โหลดข้อมูลล้มเหลว ตรวจสอบสถานะและสิทธิ์การแชร์ของ Web App");
                }
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || "เกิดข้อผิดพลาดในการดึงข้อมูลจากสคริปต์");
                }
                
                if (!result.students || result.students.length === 0) {
                    throw new Error("ไม่พบข้อมูลนักเรียนส่งกลับมาจากสคริปต์");
                }
                
                // นำเข้าข้อมูลใหม่เข้าสู่ Database และเซฟลง localStorage
                this.students = result.students;
                this.saveDatabase();
                
                // บันทึก URL เก็บไว้สำหรับการซิงค์ครั้งถัดไป
                localStorage.setItem("classroom_google_sheet_url", sheetUrl);
                
                return { success: true, count: result.students.length };
            } catch (e) {
                console.error("Sync Web App error:", e);
                return { success: false, error: e.message };
            }
        }

        // หากไม่ใช่สคริปต์ จะทำการดาวน์โหลดเป็น CSV และแปลง
        const csvUrl = this.getCsvUrl(sheetUrl);
        if (!csvUrl) return { success: false, error: "ลิงก์ Google Sheets ไม่ถูกต้อง กรุณาใช้ลิงก์จากแถบเบราว์เซอร์ของชีตของคุณ" };

        try {
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error("ดาวน์โหลดข้อมูลล้มเหลว ตรวจสอบสิทธิ์การแชร์ของชีต (ต้องตั้งค่าให้ 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน')");
            }
            const csvText = await response.text();
            const rows = this.parseCsv(csvText);
            
            if (rows.length < 2) {
                throw new Error("ไม่พบข้อมูลนักศึกษาหรือข้อมูลหัวตารางในชีต");
            }

            const headers = rows[0].map(h => h.toLowerCase().trim());
            let idColIndex = headers.findIndex(h => h.includes("รหัส") || h.includes("id"));
            let nameColIndex = headers.findIndex(h => h.includes("ชื่อ") || h.includes("name"));
            
            // ใช้ค่าเริ่มต้นหากหาคอลัมน์ไม่เจอ
            if (idColIndex === -1) idColIndex = 0;
            if (nameColIndex === -1) nameColIndex = 1;

            const monthMappings = {
                "june": "June",
                "มิถุนายน": "June",
                "july": "July",
                "กรกฎาคม": "July",
                "august": "August",
                "สิงหาคม": "August",
                "september": "September",
                "กันยายน": "September",
                "october": "October",
                "ตุลาคม": "October",
                "november": "November",
                "พฤศจิกายน": "November",
                "december": "December",
                "ธันวาคม": "December",
                "january": "January",
                "มกราคม": "January",
                "february": "February",
                "กุมภาพันธ์": "February",
                "march": "March",
                "มีนาคม": "March",
                "april": "April",
                "เมษายน": "April"
            };

            // ค้นหาดัชนีคอลัมน์ของแต่ละเดือน
            const monthColIndices = {};
            headers.forEach((header, idx) => {
                for (const [key, monthName] of Object.entries(monthMappings)) {
                    if (header.includes(key)) {
                        monthColIndices[monthName] = idx;
                        break;
                    }
                }
            });

            const newStudents = [];
            
            // วนลูปข้อมูลรายคน (เริ่มจากแถวที่ 1 ข้ามหัวข้อ)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length <= Math.max(idColIndex, nameColIndex)) continue;
                
                // ล้างอักขระคำพูดเดี่ยวหรือคู่ออก
                const id = row[idColIndex].replace(/^["']|["']$/g, '').trim();
                const name = row[nameColIndex].replace(/^["']|["']$/g, '').trim();
                if (!id || id.toLowerCase().includes("รหัส")) continue; // ข้ามแถวที่ไม่มีข้อมูลรหัส

                const status = {};
                // ตั้งค่าเริ่มต้นของทุกเดือนเป็น false
                ["June", "July", "August", "September", "October", "November", "December", "January", "February", "March", "April"].forEach(m => {
                    status[m] = false;
                });

                // อ่านข้อมูลจากแต่ละคอลัมน์เดือน
                Object.entries(monthColIndices).forEach(([monthName, idx]) => {
                    if (idx < row.length) {
                        const cellVal = row[idx].replace(/^["']|["']$/g, '').trim().toLowerCase();
                        // ถือเป็นจ่ายแล้วถ้าเป็น TRUE, จ่ายแล้ว, 1, yes, checked
                        const isPaid = cellVal === "true" || 
                                       cellVal === "จ่ายแล้ว" || 
                                       cellVal === "1" || 
                                       cellVal === "yes" || 
                                       cellVal === "checked";
                        status[monthName] = isPaid;
                    }
                });

                newStudents.push({ id, name, status });
            }

            if (newStudents.length === 0) {
                throw new Error("วิเคราะห์โครงสร้างตารางไม่สำเร็จ ไม่พบรายชื่อนักเรียน");
            }

            // นำเข้าข้อมูลใหม่เข้าสู่ Database และเซฟลง localStorage
            this.students = newStudents;
            this.saveDatabase();
            
            // บันทึก URL เก็บไว้สำหรับการซิงค์ครั้งถัดไป
            localStorage.setItem("classroom_google_sheet_url", sheetUrl);
            
            return { success: true, count: newStudents.length };
        } catch (e) {
            console.error("Sync error:", e);
            return { success: false, error: e.message };
        }
    }

    // อัปเดตสถานะการจ่ายเงินไปยัง Google Apps Script Web App (ถ้าเปิดใช้งาน)
    async updatePaymentStatusRemote(studentId, month, isPaid) {
        // อัปเดตข้อมูล Local ก่อนเพื่อให้ UI อัปเดตทันที
        this.updatePaymentStatus(studentId, month, isPaid);
        
        const sheetUrl = localStorage.getItem("classroom_google_sheet_url");
        if (sheetUrl && sheetUrl.includes("script.google.com")) {
            try {
                // ส่งคำร้องขอ GET ไปยัง Web App เพื่ออัปเดตข้อมูล
                const updateUrl = `${sheetUrl}?action=update&id=${encodeURIComponent(studentId)}&month=${encodeURIComponent(month)}&isPaid=${isPaid}`;
                const response = await fetch(updateUrl);
                if (!response.ok) {
                    throw new Error("เครือข่ายตอบกลับไม่ถูกต้อง สถานะ: " + response.status);
                }
                const result = await response.json();
                return result;
            } catch (e) {
                console.error("Failed to update remote sheet:", e);
                return { success: false, error: e.message };
            }
        }
        // หากไม่มีการตั้งค่าหรือไม่ได้ใช้ Web App ให้สำเร็จ (เฉพาะ Local)
        return { success: true, localOnly: true };
    }
}

// สร้าง Instance ของ Database เพื่อใช้งาน
const db = new ClassroomDatabase();
window.classroomDb = db; // เปิดให้เรียกผ่าน console หรือไฟล์อื่นๆ ได้สะดวก
