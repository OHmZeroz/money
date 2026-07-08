// database.js - ฐานข้อมูลจำลองของนักเรียนในเซคและสถานะการจ่ายเงิน
// ข้อมูลนี้ถูกเก็บไว้ใน localStorage เพื่อประหยัดสถานะเมื่อรีเฟรชหน้าจอ

const DEFAULT_STUDENT_LIST = [
    { id: "69010012", name: "คุณเก้า", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010024", name: "คุณเซเว่น", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010068", name: "คุณเหนือเมฆ", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010078", name: "คุณไตเติ้ล", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010115", name: "คุณโอม", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010165", name: "คุณน้ำเย็น", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010188", name: "คุณถั่วพู", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010202", name: "คุณฟลุ๊ค", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010215", name: "คุณจอม", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010253", name: "คุณลีโอ", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010320", name: "คุณปาย", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010375", name: "คุณวินเนอร์", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010433", name: "คุณยอด", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010472", name: "คุณเกม", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010588", name: "คุณทู", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010626", name: "คุณโมเม", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010649", name: "คุณตี๋", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010650", name: "คุณทัต", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010760", name: "คุณบิว", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010798", name: "คุณปาแปง", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010810", name: "คุณบอส", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010835", name: "คุณเม้ว", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010836", name: "คุณไนน์", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010854", name: "คุณกัส", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010869", name: "คุณภู", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69010911", name: "คุณต้นยาง", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011055", name: "คุณยู", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011059", name: "คุณพีค", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011134", name: "คุณปลื้ม", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011267", name: "คุณแฟร้งค์", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011606", name: "คุณโอชิ", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011613", name: "คุณเก้า", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011623", name: "คุณโอ๊ค", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011672", name: "คุณแพททริค", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011750", name: "คุณภูผา", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011806", name: "คุณเมธัส", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011824", name: "คุณเก็ต", status: { "June": false, "July": false, "August": false, "September": false } },
    { id: "69011850", name: "คุณต้นน้ำ", status: { "June": false, "July": false, "August": false, "September": false } }
];

const STORAGE_KEY = "classroom_payment_db_v3";
const MONTH_NAMES = {
    "June": "มิถุนายน",
    "July": "กรกฎาคม",
    "August": "สิงหาคม",
    "September": "กันยายน"
};

class ClassroomDatabase {
    constructor() {
        this.students = [];
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
                    console.warn("Invalid database structure, resetting to default");
                    this.students = JSON.parse(JSON.stringify(DEFAULT_STUDENT_LIST));
                    this.saveDatabase();
                }
            } catch (e) {
                console.error("Error parsing stored database, resetting to default", e);
                this.students = JSON.parse(JSON.stringify(DEFAULT_STUDENT_LIST));
                this.saveDatabase();
            }
        } else {
            this.students = JSON.parse(JSON.stringify(DEFAULT_STUDENT_LIST));
            this.saveDatabase();
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
    async syncWithGoogleSheet(sheetUrl) {
        if (!sheetUrl) return { success: false, error: "กรุณาระบุ URL ของ Google Sheet" };
        
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
                "กันยายน": "September"
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
                ["June", "July", "August", "September"].forEach(m => {
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
}

// สร้าง Instance ของ Database เพื่อใช้งาน
const db = new ClassroomDatabase();
window.classroomDb = db; // เปิดให้เรียกผ่าน console หรือไฟล์อื่นๆ ได้สะดวก
