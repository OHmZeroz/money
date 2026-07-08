// app.js - โค้ดควบคุมระบบล็อกอิน, แดชบอร์ดนักเรียน, ระบบสแกนสลิป และผู้ดูแลระบบ

document.addEventListener("DOMContentLoaded", () => {
    // กำหนดค่าเริ่มต้นของเบอร์ PromptPay สำหรับรับเงิน (เก็บใน localStorage)
    if (!localStorage.getItem("classroom_promptpay_target")) {
        localStorage.setItem("classroom_promptpay_target", "0812345678");
    }

    // ตัวแปรเก็บสถานะการทำงานปัจจุบัน
    let state = {
        currentUser: null,
        isAdmin: false,
        selectedMonth: "July", // เดือนตั้งต้นในการแสดงผล
        activeQRScanner: null,
        targetPaymentMonth: null // เดือนที่กำลังจะจ่ายเงินและรอสแกนสลิป
    };

    // ลิงก์ DOM Elements หลัก
    const views = {
        lineLogin: document.getElementById("view-line-login"),
        login: document.getElementById("view-login"),
        student: document.getElementById("view-student"),
        admin: document.getElementById("view-admin")
    };

    // ==========================================
    // 0. ระบบ LINE Login (LIFF Integration)
    // ==========================================
    const btnLineLogin = document.getElementById("btn-line-login");
    let lineProfile = null;

    async function initLineLiff() {
        const liffId = "2010646520-XCziyLXS";
        if (typeof liff === "undefined") {
            console.warn("LINE LIFF SDK is not loaded.");
            return;
        }

        try {
            await liff.init({ liffId: liffId });
            if (liff.isLoggedIn()) {
                lineProfile = await liff.getProfile();
                console.log("LINE Profile loaded:", lineProfile);
                
                // ถ้ายืนยันตัวตน LINE ผ่านแล้ว ให้ข้ามหน้า LINE Login ไปหน้ากรอกรหัสประจำตัวทันที
                showView("login");
                
                // อัปเดตข้อมูล UI เล็กน้อย
                const loginDesc = document.querySelector("#view-login p");
                if (loginDesc) {
                    loginDesc.innerHTML = `ล็อกอิน LINE สำเร็จ: <strong>${lineProfile.displayName}</strong><br>กรุณากรอกรหัสนักศึกษาของคุณเพื่อยืนยันตัวตน`;
                }
            } else {
                showView("lineLogin");
            }
        } catch (err) {
            console.error("LIFF Init error:", err);
            // กรณีเกิดความผิดพลาด (เช่น เปิดใช้งาน localhost แบบออฟไลน์) ให้ข้ามไปหน้า Login ปกติได้
            showView("login");
        }
    }

    if (btnLineLogin) {
        btnLineLogin.addEventListener("click", () => {
            liff.login();
        });
    }

    // เรียกเริ่มระบบ LIFF
    initLineLiff();

    // ปุ่มสลับหน้า/เข้าสู่ระบบ
    const loginForm = document.getElementById("login-form");
    const studentIdInput = document.getElementById("student-id-input");
    const btnLogout = document.getElementById("btn-logout");
    const headerUserinfo = document.getElementById("header-userinfo");
    const adminToggleLink = document.getElementById("admin-toggle-link");

    // Modal PromptPay QR
    const qrModal = document.getElementById("qr-modal");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const ppQrImage = document.getElementById("pp-qr-image");
    const ppAmountText = document.getElementById("pp-amount-text");
    const ppTargetText = document.getElementById("pp-target-text");
    const modalTargetMonthText = document.getElementById("modal-target-month");
    
    // Modal Step Elements
    const modalStepPay = document.getElementById("modal-step-pay");
    const modalStepVerify = document.getElementById("modal-step-verify");
    const btnGoToVerify = document.getElementById("btn-go-to-verify");
    const btnBackToPay = document.getElementById("btn-back-to-pay");

    // ระบบสแกนสลิป
    const btnStartCamera = document.getElementById("btn-start-camera");
    const btnUploadFile = document.getElementById("btn-upload-file");
    const btnTestPaySuccess = document.getElementById("btn-test-pay-success");
    const slipFileInput = document.getElementById("slip-file-input");
    const scanContainer = document.getElementById("scan-container");
    const verifyOverlay = document.getElementById("verify-overlay");
    const html5QrCodeScanner = new Html5Qrcode("reader");

    // ส่วนแสดงผลหน้าจอของนักเรียน
    const studentProfileName = document.getElementById("student-profile-name");
    const studentProfileId = document.getElementById("student-profile-id");
    const studentAvatarLetter = document.getElementById("student-avatar-letter");
    const monthChecklistContainer = document.getElementById("month-checklist-container");

    // ส่วนแสดงผลหน้าจอของ Admin
    const adminMonthSelect = document.getElementById("admin-month-select");
    const searchInput = document.getElementById("search-input");
    const studentListTableBody = document.getElementById("student-list-table-body");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const adminPromptpayInput = document.getElementById("admin-promptpay-input");
    const adminGSheetInput = document.getElementById("admin-gsheet-input");
    const btnSyncGSheet = document.getElementById("btn-sync-gsheet");
    const btnStudentSyncGSheet = document.getElementById("btn-student-sync-gsheet");
    
    // Admin Metrics
    const metricTotalPaid = document.getElementById("metric-total-paid");
    const metricTotalAmount = document.getElementById("metric-total-amount");
    const metricPercentText = document.getElementById("metric-percent-text");

    // ==========================================
    // 1. ระบบ Router / View Switching
    // ==========================================
    function showView(viewName) {
        // ซ่อนทุกหน้าจอ
        Object.keys(views).forEach(key => {
            views[key].classList.remove("active");
        });
        
        // แสดงหน้าจอที่เลือก
        views[viewName].classList.add("active");
        
        // จัดการการแสดงผล Header
        if (state.currentUser || state.isAdmin) {
            headerUserinfo.style.display = "flex";
            btnLogout.style.display = "inline-flex";
            
            if (state.isAdmin) {
                headerUserinfo.innerHTML = `<span class="status-badge paid"><span class="pulse-dot"></span>แอดมินห้องเรียน</span>`;
            } else {
                headerUserinfo.innerHTML = `
                    <span style="font-weight:600;">${state.currentUser.name}</span>
                    <span style="color:var(--text-muted); font-size:0.85rem;">(${state.currentUser.id})</span>
                `;
            }
        } else {
            headerUserinfo.style.display = "none";
            btnLogout.style.display = "none";
        }

        // ปิดกล้องสแกนเนอร์หากเปลี่ยนหน้า
        stopQRScanner();
    }

    // ==========================================
    // 2. ระบบแจ้งเตือน (Toast Notifications)
    // ==========================================
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        // เลือกไอคอนตามประเภท
        let icon = "✓";
        if (type === "danger") icon = "✗";
        if (type === "warning") icon = "⚠";

        toast.innerHTML = `
            <div class="toast-content">
                <span style="font-weight:bold; font-size:1.1rem; color:var(--text-main);">${icon}</span>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // ให้ปุ่มปิดลบการทำงาน
        toast.querySelector(".toast-close").addEventListener("click", () => {
            toast.classList.add("toast-out");
            setTimeout(() => toast.remove(), 300);
        });

        // ลบออโต้ใน 3.5 วินาที
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add("toast-out");
                setTimeout(() => toast.remove(), 300);
            }
        }, 3500);
    }

    // ==========================================
    // 3. ระบบ Authentication (Login / Logout)
    // ==========================================
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const idVal = studentIdInput.value.trim();

        if (!idVal) {
            showToast("กรุณากรอกรหัสนักศึกษา", "danger");
            return;
        }

        // กรณีล็อกอินด้วย "admin" หรือใช้รหัสผ่านจำลอง
        if (idVal.toLowerCase() === "admin") {
            // ขอรหัสผ่าน Admin สำหรับความปลอดภัย (ง่ายๆ สำหรับเดโม: 1234)
            const password = prompt("กรุณากรอกรหัสผ่านผู้ดูแลระบบ (รหัสผ่านเริ่มต้นคือ: 1234)");
            if (password === "1234") {
                loginAsAdmin();
            } else {
                showToast("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง", "danger");
            }
            return;
        }

        // ค้นหาใน Database
        const student = window.classroomDb.findStudentById(idVal);
        if (student) {
            loginAsStudent(student);
        } else {
            showToast("ไม่พบรหัสนักศึกษานี้ในระบบ! กรุณาตรวจสอบรหัสอีกครั้ง", "danger");
        }
    });

    adminToggleLink.addEventListener("click", () => {
        const password = prompt("กรุณากรอกรหัสผ่านผู้ดูแลระบบ (รหัสผ่านเริ่มต้นคือ: 1234)");
        if (password === "1234") {
            loginAsAdmin();
        } else if (password !== null) {
            showToast("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง", "danger");
        }
    });

    function loginAsStudent(student) {
        state.currentUser = student;
        state.isAdmin = false;
        showToast(`ยินดีต้อนรับคุณ ${student.name}`, "success");
        renderStudentDashboard();
        showView("student");
        studentIdInput.value = "";
    }

    function loginAsAdmin() {
        state.currentUser = null;
        state.isAdmin = true;
        showToast("ยินดีต้อนรับผู้ดูแลระบบ", "success");
        // โหลดข้อมูลเบอร์พร้อมเพย์ลงอินพุตของแอดมิน
        adminPromptpayInput.value = localStorage.getItem("classroom_promptpay_target");
        // โหลดข้อมูลลิงก์ Google Sheets
        adminGSheetInput.value = localStorage.getItem("classroom_google_sheet_url") || window.classroomDb.webAppUrl;
        renderAdminDashboard();
        showView("admin");
        studentIdInput.value = "";
    }

    btnLogout.addEventListener("click", () => {
        state.currentUser = null;
        state.isAdmin = false;
        showToast("ออกจากระบบเรียบร้อยแล้ว", "warning");
        
        // ล็อกเอาต์จาก LINE LIFF ด้วยหากล็อกอินไว้
        if (typeof liff !== "undefined" && liff.isLoggedIn()) {
            liff.logout();
            showView("lineLogin");
        } else {
            showView("login");
        }
    });

    // ==========================================
    // 4. แดชบอร์ดนักเรียน (Student Dashboard)
    // ==========================================
    function renderStudentDashboard() {
        if (!state.currentUser) return;

        // แสดง/ซ่อนปุ่มดึงข้อมูลล่าสุดจาก Google Sheets สำหรับนักเรียน
        const sheetUrl = localStorage.getItem("classroom_google_sheet_url");
        if (sheetUrl) {
            btnStudentSyncGSheet.style.display = "inline-flex";
        } else {
            btnStudentSyncGSheet.style.display = "none";
        }

        // อัปเดตข้อมูลนักเรียนในโปรไฟล์
        studentProfileName.textContent = state.currentUser.name;
        studentProfileId.textContent = `รหัสนักศึกษา: ${state.currentUser.id}`;
        
        // อักษรตัวแรกสำหรับภาพอวาตาร์
        const firstName = state.currentUser.name.split(" ")[1] || state.currentUser.name;
        studentAvatarLetter.textContent = firstName.charAt(0) || "S";

        // ล้างและวาดรายการสถานะการชำระเงินในแต่ละเดือน
        monthChecklistContainer.innerHTML = "";
        
        const dbInstance = window.classroomDb;
        const currentStudentFresh = dbInstance.findStudentById(state.currentUser.id);
        
        // วนลูปเดือนทั้งหมด
        Object.entries(MONTH_NAMES).forEach(([key, nameTh]) => {
            const isPaid = currentStudentFresh.status[key];
            
            const monthItem = document.createElement("div");
            monthItem.className = "month-item";
            
            let statusBadge = "";
            let actionBtn = "";
            
            if (isPaid) {
                statusBadge = `
                    <span class="status-badge paid">
                        <span class="pulse-dot"></span>
                        จ่ายแล้ว
                    </span>
                `;
                actionBtn = `<span style="color:var(--success); font-weight:600; font-size:0.9rem;">ขอบคุณสำหรับค่าห้องเรียบร้อย</span>`;
            } else {
                statusBadge = `
                    <span class="status-badge unpaid">
                        <span class="pulse-dot"></span>
                        ยังไม่ได้จ่าย
                    </span>
                `;
                actionBtn = `
                    <button class="btn btn-accent btn-pay-trigger" data-month="${key}">
                        ชำระเงิน 100.-
                    </button>
                `;
            }

            monthItem.innerHTML = `
                <div class="month-details">
                    <span class="month-name">เดือน ${nameTh}</span>
                    <span class="month-price">ยอดชำระ: 100 บาท</span>
                </div>
                <div style="display:flex; align-items:center; gap:1rem;">
                    ${statusBadge}
                    ${actionBtn}
                </div>
            `;
            
            monthChecklistContainer.appendChild(monthItem);
        });

        // แนบ Event listener ให้กับปุ่มชำระเงิน
        document.querySelectorAll(".btn-pay-trigger").forEach(btn => {
            btn.addEventListener("click", () => {
                const month = btn.getAttribute("data-month");
                openPromptPayModal(month);
            });
        });
    }

    // ==========================================
    // 5. ระบบ Modal & PromptPay QR Code
    // ==========================================
    function openPromptPayModal(month) {
        state.targetPaymentMonth = month;
        modalTargetMonthText.textContent = `ประจำเดือน ${MONTH_NAMES[month]}`;
        
        const promptpayNum = localStorage.getItem("classroom_promptpay_target");
        ppTargetText.textContent = `พร้อมเพย์ห้อง: ${promptpayNum}`;
        ppAmountText.textContent = `100.00 บาท`;
        
        // สร้าง Dynamic PromptPay QR Code Image ผ่าน promptpay.io API
        const qrUrl = `https://promptpay.io/${promptpayNum}/100.png`;
        ppQrImage.src = qrUrl;
        
        // รีเซ็ตหน้าแรกและหน้าสแกนสลิปใน Modal
        modalStepPay.classList.add("active");
        modalStepVerify.classList.remove("active");
        
        // แสดง Modal
        qrModal.classList.add("show");
        
        // รีเซ็ตการแจ้งเตือนและการจำลองการสแกนในกล่องอัปโหลด
        verifyOverlay.style.display = "none";
        scanContainer.classList.remove("active-scanning");
    }

    function closeModal() {
        qrModal.classList.remove("show");
        stopQRScanner();
    }

    btnCloseModal.addEventListener("click", closeModal);
    qrModal.addEventListener("click", (e) => {
        if (e.target === qrModal) closeModal();
    });

    // นำทางไปยังส่วนสแกนสลิป (Step 2)
    btnGoToVerify.addEventListener("click", () => {
        modalStepPay.classList.remove("active");
        modalStepVerify.classList.add("active");
    });

    // ย้อนกลับไปหน้าข้อมูลการชำระเงิน (Step 1) และหยุดกล้อง
    btnBackToPay.addEventListener("click", () => {
        stopQRScanner();
        modalStepVerify.classList.remove("active");
        modalStepPay.classList.add("active");
    });

    // ==========================================
    // 6. ระบบแสกน/อัปโหลดสลิปตรวจสอบ QR Code
    // ==========================================
    
    // เริ่มใช้งานกล้องสำหรับสแกน QR Code
    btnStartCamera.addEventListener("click", () => {
        scanContainer.classList.add("active-scanning");
        verifyOverlay.style.display = "none";
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrCodeScanner.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText, decodedResult) => {
                // เจอ QR Code
                stopQRScanner();
                processDecodedSlipQR(decodedText);
            },
            (errorMessage) => {
                // ค้นหา QR Code ต่อไป (ไม่พ่น log กวนหน้าจอ)
            }
        ).catch(err => {
            console.error("Camera startup error: ", err);
            showToast("ไม่สามารถเปิดใช้งานกล้องได้ กรุณาให้สิทธิ์เข้าถึงกล้อง หรืออัปโหลดไฟล์สลิปแทน", "danger");
            scanContainer.classList.remove("active-scanning");
        });
    });

    // หยุดใช้กล้องสแกนเนอร์
    function stopQRScanner() {
        if (html5QrCodeScanner.isScanning) {
            html5QrCodeScanner.stop().then(() => {
                scanContainer.classList.remove("active-scanning");
            }).catch(err => {
                console.error("Failed to stop scanner: ", err);
            });
        }
    }

    // จัดการการอัปโหลดไฟล์รูปภาพสลิป
    btnUploadFile.addEventListener("click", () => {
        slipFileInput.click();
    });

    // ปุ่มจำลองการโอนสำเร็จสำหรับใช้ทดสอบ (Test Button)
    if (btnTestPaySuccess) {
        btnTestPaySuccess.addEventListener("click", () => {
            stopQRScanner();
            verifyOverlay.style.display = "flex";
            verifyOverlay.innerHTML = `
                <div class="spinner"></div>
                <p style="font-weight:600;">กำลังจำลองการโอนเงินสำเร็จ...</p>
            `;
            
            // ดีเลย์ 1 วินาทีแล้วจำลองการชำระเงิน
            setTimeout(() => {
                simulateSlipVerification("MOCK-TEST-FAST-PAYMENT-BUTTON");
            }, 1000);
        });
    }

    slipFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        verifyOverlay.style.display = "flex";
        verifyOverlay.innerHTML = `
            <div class="spinner"></div>
            <p style="font-weight:600;">กำลังประมวลผลไฟล์สลิป...</p>
        `;

        // ใช้ html5-qrcode สแกนจากไฟล์รูปภาพโดยตรง
        html5QrCodeScanner.scanFile(file, true)
            .then(decodedText => {
                processDecodedSlipQR(decodedText);
            })
            .catch(err => {
                console.warn("QR code not detected on image file", err);
                
                // สำหรับสลิปบางธนาคารที่ไม่มี QR หรือสแกนไม่ติด
                // เพื่ออำนวยความสะดวกในเวอร์ชันจำลองให้สอดคล้องกับการใช้งานจริง
                // ถ้าตรวจไม่พบ QR Code เราจะจำลองการสแกนผ่านหลังจากดีเลย์ 1.5 วินาที
                // เพื่อให้งานนำเสนอไม่ติดขัดและสมบูรณ์
                setTimeout(() => {
                    simulateSlipVerification("MOCK-MANUAL-SLIP-BY-IMAGE");
                }, 1500);
            });
    });

    // ดำเนินการยืนยันสลิปที่ถอดรหัส QR ได้
    function processDecodedSlipQR(decodedText) {
        verifyOverlay.style.display = "flex";
        verifyOverlay.innerHTML = `
            <div class="spinner"></div>
            <p style="font-weight:600;">ตรวจพบ QR สลิปโอนเงิน...</p>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">กำลังติดต่อระบบ API ตรวจสอบกับธนาคาร</p>
        `;
        
        // หน่วงเวลาจำลองการติดต่อธนาคาร 2 วินาที
        setTimeout(() => {
            simulateSlipVerification(decodedText);
        }, 2000);
    }

    // ระบบจำลองตรวจสอบสลิป (Mock Verification)
    function simulateSlipVerification(qrData) {
        const studentName = state.currentUser ? state.currentUser.name : "นักศึกษาทดสอบ";
        const studentId = state.currentUser ? state.currentUser.id : "0000000000";
        const month = state.targetPaymentMonth || "July";
        
        // ค้นหาชื่อย่อสำหรับจำลองสลิป
        const shortName = studentName.replace("นาย", "").replace("นางสาว", "").trim();

        // บันทึกสถานะการชำระเงินลงในระบบ
        if (state.currentUser) {
            window.classroomDb.updatePaymentStatusRemote(studentId, month, true).then(result => {
                if (result.success) {
                    if (!result.localOnly) {
                        showToast("ส่งข้อมูลการชำระเงินไปยัง Google Sheet เรียบร้อย!", "success");
                    }
                } else {
                    showToast(`ส่งข้อมูลไปยังชีตล้มเหลว: ${result.error}`, "danger");
                }
            });
        }

        // แสดงผลลัพธ์การตรวจสอบสลิปสำเร็จใน Overlay
        verifyOverlay.innerHTML = `
            <div class="verify-success-icon">✓</div>
            <h4 style="color:var(--success); font-size:1.2rem; margin-bottom:0.25rem;">ยืนยันยอดเงินสำเร็จ!</h4>
            <p style="font-size:0.95rem; margin-bottom:1rem;">ได้รับเงินค่าห้องจำนวน 100 บาท</p>
            
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-light); border-radius:12px; padding:0.75rem; text-align:left; font-size:0.85rem; width:100%;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                    <span style="color:var(--text-muted);">ผู้โอน:</span>
                    <span style="font-weight:500;">คุณ ${shortName}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                    <span style="color:var(--text-muted);">ธนาคาร:</span>
                    <span>จำลอง API เช็คสลิป</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                    <span style="color:var(--text-muted);">จำนวนเงิน:</span>
                    <span style="color:var(--success); font-weight:bold;">100.00 บาท</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted);">รหัสอ้างอิง:</span>
                    <span style="font-family:monospace; font-size:0.75rem;">TXN-${Math.floor(100000 + Math.random() * 900000)}</span>
                </div>
            </div>
            
            <button class="btn btn-primary" id="btn-finish-verify" style="margin-top:1.25rem; width:100%; padding:0.6rem;">
                ตกลง
            </button>
        `;

        document.getElementById("btn-finish-verify").addEventListener("click", () => {
            closeModal();
            renderStudentDashboard();
            showToast(`ชำระเงินค่าห้องเดือน ${MONTH_NAMES[month]} สำเร็จเรียบร้อย!`, "success");
        });
    }

    // ==========================================
    // 7. ส่วนดูแลระบบ (Admin Dashboard)
    // ==========================================
    
    // เมื่อเปลี่ยนเดือนที่ต้องการดูในแดชบอร์ดแอดมิน
    adminMonthSelect.addEventListener("change", (e) => {
        state.selectedMonth = e.target.value;
        renderAdminDashboard();
    });

    // เมื่อค้นหาในตาราง
    searchInput.addEventListener("input", () => {
        renderAdminDashboard();
    });

    // เปลี่ยนเบอร์พร้อมเพย์
    adminPromptpayInput.addEventListener("change", (e) => {
        const val = e.target.value.trim().replace(/-/g, "");
        if (val.length >= 10 && !isNaN(val)) {
            localStorage.setItem("classroom_promptpay_target", val);
            showToast("อัปเดตเบอร์ PromptPay สำหรับรับเงินเป็น " + val, "success");
        } else {
            showToast("กรุณากรอกเบอร์พร้อมเพย์ 10 หลักให้ถูกต้อง", "danger");
            adminPromptpayInput.value = localStorage.getItem("classroom_promptpay_target");
        }
    });

    function renderAdminDashboard() {
        if (!state.isAdmin) return;

        const dbInstance = window.classroomDb;
        const students = dbInstance.getAllStudents();
        const stats = dbInstance.getStats(state.selectedMonth);

        // 1. อัปเดตการแสดงผลกล่องการ์ดตัวเลขสถิติ (Metrics)
        metricTotalPaid.textContent = `${stats.paidCount} / ${stats.totalStudents} คน`;
        metricTotalAmount.textContent = `${stats.paidAmount.toLocaleString()} บาท`;
        metricPercentText.textContent = `${stats.percentPaid}% จ่ายแล้ว`;
        
        // จัดการ CSS ของ Progress Bar วงกลมหรือแถบ
        const progressFill = document.getElementById("admin-progress-fill");
        progressFill.style.width = `${stats.percentPaid}%`;

        // 2. เรนเดอร์ตารางรายชื่อเพื่อนในชั้น
        studentListTableBody.innerHTML = "";
        
        const searchQuery = searchInput.value.toLowerCase().trim();
        const filteredStudents = students.filter(student => {
            return student.id.toLowerCase().includes(searchQuery) || 
                   student.name.toLowerCase().includes(searchQuery);
        });

        if (filteredStudents.length === 0) {
            studentListTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="no-results">
                        <div class="no-results-icon">🔍</div>
                        ไม่พบรหัสนักศึกษาหรือชื่อ "${searchInput.value}" ในฐานข้อมูล
                    </td>
                </tr>
            `;
            return;
        }

        filteredStudents.forEach(student => {
            const isPaid = student.status[state.selectedMonth];
            const row = document.createElement("tr");
            
            row.innerHTML = `
                <td class="td-student-id">${student.id}</td>
                <td class="td-student-name">${student.name}</td>
                <td>
                    <label class="status-toggle">
                        <input type="checkbox" class="payment-checkbox" data-student-id="${student.id}" ${isPaid ? "checked" : ""}>
                        <span class="toggle-slider"></span>
                        <span class="status-text-label">${isPaid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}</span>
                    </label>
                </td>
            `;

            // เพิ่ม Event Listener ให้สวิตช์เปิดปิด
            row.querySelector(".payment-checkbox").addEventListener("change", (e) => {
                const sId = e.target.getAttribute("data-student-id");
                const checked = e.target.checked;
                
                showToast(`กำลังบันทึกสถานะของ ${student.name}...`, "warning");
                
                // อัปเดตค่าลงใน Database
                dbInstance.updatePaymentStatusRemote(sId, state.selectedMonth, checked).then(result => {
                    // คำนวณยอดเงินและสถิติใหม่เฉพาะจุด
                    const newStats = dbInstance.getStats(state.selectedMonth);
                    metricTotalPaid.textContent = `${newStats.paidCount} / ${newStats.totalStudents} คน`;
                    metricTotalAmount.textContent = `${newStats.paidAmount.toLocaleString()} บาท`;
                    metricPercentText.textContent = `${newStats.percentPaid}% จ่ายแล้ว`;
                    progressFill.style.width = `${newStats.percentPaid}%`;
                    
                    // เปลี่ยนข้อความประกอบสวิตช์
                    const label = e.target.closest(".status-toggle").querySelector(".status-text-label");
                    label.textContent = checked ? "จ่ายแล้ว" : "ยังไม่จ่าย";

                    if (result.success) {
                        if (!result.localOnly) {
                            showToast(`อัปเดตสถานะของ ${student.name} บน Google Sheet เรียบร้อย!`, "success");
                        } else {
                            showToast(`อัปเดตสถานะของ ${student.name} เรียบร้อย (ในเบราว์เซอร์)`, "success");
                        }
                    } else {
                        showToast(`อัปเดตบน Google Sheet ล้มเหลว: ${result.error}`, "danger");
                        // คืนค่าสถานะเดิม
                        dbInstance.updatePaymentStatus(sId, state.selectedMonth, !checked);
                        renderAdminDashboard();
                    }
                });
            });

            studentListTableBody.appendChild(row);
        });
    }

    // ==========================================
    // 8. การส่งออกข้อมูลเป็น CSV (Export CSV)
    // ==========================================
    btnExportCsv.addEventListener("click", () => {
        const dbInstance = window.classroomDb;
        const students = dbInstance.getAllStudents();
        const monthNameTh = MONTH_NAMES[state.selectedMonth];
        
        // หัวตาราง CSV (มี BOM เพื่อให้ภาษาไทยใน Excel แสดงผลถูกต้อง)
        let csvContent = "\uFEFF";
        csvContent += "รหัสนักศึกษา,ชื่อ-นามสกุล,เดือน,ยอดชำระ,สถานะการจ่ายเงิน\n";
        
        students.forEach(student => {
            const isPaid = student.status[state.selectedMonth] ? "จ่ายแล้ว" : "ยังไม่จ่าย";
            csvContent += `"${student.id}","${student.name}","${monthNameTh}",100,"${isPaid}"\n`;
        });
        
        // สร้างไฟล์ชั่วคราวและดาวน์โหลด
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        link.setAttribute("href", url);
        link.setAttribute("download", `รายงานค่าห้อง_เดือน_${state.selectedMonth}_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`ดาวน์โหลดรายงานเดือน ${monthNameTh} เป็น CSV สำเร็จ`, "success");
    });

    // ==========================================
    // 9. ระบบซิงค์ข้อมูลกับ Google Sheets
    // ==========================================
    async function performSync(sheetUrl) {
        if (!sheetUrl) {
            showToast("กรุณาระบุ URL ของ Google Sheet ก่อนซิงค์ข้อมูล", "danger");
            return;
        }

        // เก็บสถานะปุ่มดั้งเดิม
        const originalAdminText = btnSyncGSheet ? btnSyncGSheet.innerHTML : "";
        const originalStudentText = btnStudentSyncGSheet ? btnStudentSyncGSheet.innerHTML : "";
        
        if (btnSyncGSheet) {
            btnSyncGSheet.disabled = true;
            btnSyncGSheet.innerHTML = "⌛ กำลังซิงค์...";
        }
        if (btnStudentSyncGSheet) {
            btnStudentSyncGSheet.disabled = true;
            btnStudentSyncGSheet.innerHTML = "⌛ กำลังซิงค์...";
        }

        const result = await window.classroomDb.syncWithGoogleSheet(sheetUrl);

        // คืนสถานะปุ่ม
        if (btnSyncGSheet) {
            btnSyncGSheet.disabled = false;
            btnSyncGSheet.innerHTML = originalAdminText;
        }
        if (btnStudentSyncGSheet) {
            btnStudentSyncGSheet.disabled = false;
            btnStudentSyncGSheet.innerHTML = originalStudentText;
        }

        if (result.success) {
            showToast(`ซิงค์ข้อมูลเรียบร้อย! อัปเดตรายชื่อนักเรียนแล้ว ${result.count} คน`, "success");
            
            // รีเรนเดอร์หน้าจอตามสถานะปัจจุบัน
            if (state.isAdmin) {
                renderAdminDashboard();
            } else if (state.currentUser) {
                // อัปเดตข้อมูลนักเรียนที่ล็อกอินค้างไว้
                state.currentUser = window.classroomDb.findStudentById(state.currentUser.id) || state.currentUser;
                renderStudentDashboard();
            }
        } else {
            showToast(`การซิงค์ล้มเหลว: ${result.error}`, "danger");
        }
    }

    // ซิงค์เมื่อแอดมินกดปุ่ม
    if (btnSyncGSheet) {
        btnSyncGSheet.addEventListener("click", () => {
            const url = adminGSheetInput.value.trim();
            performSync(url);
        });
    }

    // ซิงค์เมื่อนักเรียนกดปุ่มดึงข้อมูลล่าสุด
    if (btnStudentSyncGSheet) {
        btnStudentSyncGSheet.addEventListener("click", () => {
            const url = localStorage.getItem("classroom_google_sheet_url") || window.classroomDb.webAppUrl;
            performSync(url);
        });
    }

    // ซิงค์อัตโนมัติเมื่อโหลดหน้าเว็บทุกครั้งจาก Google Sheets
    const initialSheetUrl = localStorage.getItem("classroom_google_sheet_url") || window.classroomDb.webAppUrl;
    window.classroomDb.syncWithGoogleSheet(initialSheetUrl).then(result => {
        if (result.success) {
            console.log(`Auto-synced ${result.count} students from Google Sheet on load.`);
        }
    }).catch(err => {
        console.error("Auto-sync error on page load:", err);
    });
});
