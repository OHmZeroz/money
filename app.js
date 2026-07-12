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
    const ppNoteText = document.getElementById("pp-note-text");
    const modalTargetMonthText = document.getElementById("modal-target-month");
    
    // Modal Step Elements
    const modalStepPay = document.getElementById("modal-step-pay");
    const btnReportTransfer = document.getElementById("btn-report-transfer");
    
    // ตั้งค่าหน้าจอ Admin
    const btnAdminLockMonth = document.getElementById("btn-admin-lock-month");

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
    
    // Admin Login Modal Elements
    const adminLoginModal = document.getElementById("admin-login-modal");
    const btnCloseAdminModal = document.getElementById("btn-close-admin-modal");
    const adminLoginForm = document.getElementById("admin-login-form");
    const adminPasswordInput = document.getElementById("admin-password-input");
    const btnTogglePasswordVisibility = document.getElementById("btn-toggle-password-visibility");
    const adminLoginError = document.getElementById("admin-login-error");
    const btnAdminLoginSubmit = document.getElementById("btn-admin-login-submit");

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
    loginForm.addEventListener("submit", async (e) => {
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
            // ป้องกันการสวมรอย: ตรวจสอบ/ผูกมัด LINE ID กับรหัสนักศึกษา
            if (lineProfile && lineProfile.userId) {
                showToast("กำลังตรวจสอบข้อมูลความปลอดภัยบัญชี LINE...", "info");
                
                // แสดงสถานะการโหลด
                const submitBtn = loginForm.querySelector("button[type='submit']");
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = "กำลังตรวจสอบ...";
                
                try {
                    const bindResult = await window.classroomDb.bindLineIdRemote(idVal, lineProfile.userId);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                    
                    if (bindResult.success) {
                        student.lineId = lineProfile.userId;
                        loginAsStudent(student);
                    } else {
                        showToast(bindResult.error || "รหัสนักศึกษานี้ถูกลงทะเบียนด้วยบัญชี LINE อื่นแล้ว!", "danger");
                    }
                } catch (err) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                    showToast("เกิดข้อผิดพลาดในการยืนยันตัวตน LINE ID: " + err.message, "danger");
                }
            } else {
                // หากไม่ได้ผ่านหน้า LINE Login (เช่น กดข้ามกรณี Error) ให้ล็อกอินปกติ
                loginAsStudent(student);
            }
        } else {
            showToast("ไม่พบรหัสนักศึกษานี้ในระบบ! กรุณาตรวจสอบรหัสอีกครั้ง", "danger");
        }
    });

    // ตัวแปรและฟังก์ชันเกี่ยวกับการล็อกอินของแอดมินและการล็อกเอาต์เมื่อกรอกผิด
    let adminFailedAttempts = 0;
    let adminLockoutTimer = null;
    let adminLockoutEndTime = 0;

    function closeAdminModal() {
        adminLoginModal.classList.remove("show");
        if (adminLockoutTimer) {
            clearTimeout(adminLockoutTimer);
        }
    }

    function startAdminLockoutCooldown() {
        adminPasswordInput.disabled = true;
        btnAdminLoginSubmit.disabled = true;
        btnTogglePasswordVisibility.disabled = true;
        
        const updateTimer = () => {
            const timeLeft = Math.max(0, Math.round((adminLockoutEndTime - Date.now()) / 1000));
            if (timeLeft > 0) {
                adminLoginError.textContent = `🔒 สิทธิ์เข้าใช้งานถูกล็อกชั่วคราว ลองใหม่ในอีก ${timeLeft} วินาที`;
                adminLockoutTimer = setTimeout(updateTimer, 1000);
            } else {
                adminPasswordInput.disabled = false;
                btnAdminLoginSubmit.disabled = false;
                btnTogglePasswordVisibility.disabled = false;
                adminFailedAttempts = 0;
                adminLoginError.style.display = "none";
                adminPasswordInput.focus();
            }
        };
        updateTimer();
    }

    // แสดงหน้าต่างล็อกอินแอดมิน
    adminToggleLink.addEventListener("click", () => {
        // ตรวจสอบว่าอยู่ระหว่างล็อกดาวน์หรือไม่
        const now = Date.now();
        if (now < adminLockoutEndTime) {
            adminLoginError.style.display = "block";
            startAdminLockoutCooldown();
        } else {
            adminPasswordInput.value = "";
            adminPasswordInput.disabled = false;
            btnAdminLoginSubmit.disabled = false;
            btnTogglePasswordVisibility.disabled = false;
            adminLoginError.style.display = "none";
            adminPasswordInput.type = "password";
            btnTogglePasswordVisibility.textContent = "👁️";
        }
        
        adminLoginModal.classList.add("show");
        setTimeout(() => adminPasswordInput.focus(), 100);
    });

    // ปิดหน้าต่างล็อกอินแอดมิน
    btnCloseAdminModal.addEventListener("click", closeAdminModal);
    adminLoginModal.addEventListener("click", (e) => {
        if (e.target === adminLoginModal) closeAdminModal();
    });

    // ปุ่มเปิด/ปิดตาแสดงรหัสผ่าน
    btnTogglePasswordVisibility.addEventListener("click", () => {
        if (adminPasswordInput.disabled) return;
        if (adminPasswordInput.type === "password") {
            adminPasswordInput.type = "text";
            btnTogglePasswordVisibility.textContent = "🙈";
        } else {
            adminPasswordInput.type = "password";
            btnTogglePasswordVisibility.textContent = "👁️";
        }
    });

    // ยืนยันฟอร์มล็อกอินแอดมิน
    adminLoginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const now = Date.now();
        if (now < adminLockoutEndTime) return;

        const password = adminPasswordInput.value;
        if (password === "1234") {
            adminFailedAttempts = 0;
            closeAdminModal();
            loginAsAdmin();
        } else {
            adminFailedAttempts++;
            adminLoginError.style.display = "block";
            adminPasswordInput.value = "";
            adminPasswordInput.focus();
            
            if (adminFailedAttempts >= 5) {
                adminLockoutEndTime = Date.now() + 30000;
                startAdminLockoutCooldown();
            } else {
                adminLoginError.textContent = `❌ รหัสผ่านไม่ถูกต้อง (กรอกผิดอีก ${5 - adminFailedAttempts} ครั้งระบบจะล็อก)`;
            }
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
            const status = currentStudentFresh.status[key] || "unpaid";
            const isLocked = dbInstance.isMonthLocked(key);
            
            const monthItem = document.createElement("div");
            monthItem.className = "month-item";
            
            let statusBadge = "";
            let actionBtn = "";
            
            if (status === "paid" || status === true || status === "true") {
                statusBadge = `
                    <span class="status-badge paid">
                        <span class="pulse-dot"></span>
                        จ่ายแล้ว
                    </span>
                `;
                actionBtn = `<span style="color:var(--success); font-weight:600; font-size:0.9rem;">ชำระเงินเสร็จสิ้น ขอบคุณครับ</span>`;
            } else if (status === "pending" || status === "waiting") {
                statusBadge = `
                    <span class="status-badge pending" style="background:#eab308; border-color:#f59e0b; color:#fff; display:inline-flex; align-items:center; gap:0.25rem;">
                        <span class="pulse-dot" style="background:#fff;"></span>
                        รออนุมัติ
                    </span>
                `;
                actionBtn = `<span style="color:#eab308; font-weight:600; font-size:0.9rem;">แจ้งโอนแล้ว รอแอดมินอนุมัติ...</span>`;
            } else {
                if (isLocked) {
                    statusBadge = `
                        <span class="status-badge locked" style="background:#4b5563; border-color:#374151; color:#d1d5db; display:inline-flex; align-items:center; gap:0.25rem;">
                            🔒 ล็อกชำระ
                        </span>
                    `;
                    actionBtn = `<span style="color:#6b7280; font-weight:600; font-size:0.9rem;">ปิดรับชำระเงิน</span>`;
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
        
        // แสดงคำแนะนำให้บันทึกชื่อผู้โอนในแอปธนาคาร
        if (state.currentUser && state.currentUser.name) {
            ppNoteText.style.display = "block";
            ppNoteText.textContent = `📝 แนะนำใส่บันทึกช่วยจำ: ค่าห้องของ ${state.currentUser.name}`;
        } else {
            ppNoteText.style.display = "none";
        }
        
        // รีเซ็ตหน้าแรกใน Modal
        modalStepPay.classList.add("active");
        
        // แสดง Modal
        qrModal.classList.add("show");
    }

    function closeModal() {
        qrModal.classList.remove("show");
    }

    btnCloseModal.addEventListener("click", closeModal);
    qrModal.addEventListener("click", (e) => {
        if (e.target === qrModal) closeModal();
    });

    // ==========================================
    // 6. ระบบรายงานการโอนเงินของนักศึกษา (Report Transfer)
    // ==========================================
    if (btnReportTransfer) {
        btnReportTransfer.addEventListener("click", () => {
            const studentId = state.currentUser ? state.currentUser.id : null;
            const month = state.targetPaymentMonth;
            if (!studentId || !month) return;
            
            showToast("กำลังส่งข้อมูลแจ้งโอนเงินให้ผู้ดูแลระบบ...", "warning");
            
            window.classroomDb.updatePaymentStatusRemote(studentId, month, "pending").then(result => {
                if (result.success) {
                    showToast(`แจ้งโอนเงินของเดือน ${MONTH_NAMES[month]} สำเร็จแล้ว! รอแอดมินอนุมัติการตรวจสอบ`, "success");
                } else {
                    showToast(`เกิดข้อผิดพลาดในการส่งข้อมูล: ${result.error}`, "danger");
                }
                closeModal();
                renderStudentDashboard();
            });
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

    // ปุ่มล็อก/ปลดล็อกเดือนชำระเงินสำหรับแอดมิน
    if (btnAdminLockMonth) {
        btnAdminLockMonth.addEventListener("click", () => {
            const dbInstance = window.classroomDb;
            const isCurrentlyLocked = dbInstance.isMonthLocked(state.selectedMonth);
            const newLockState = !isCurrentlyLocked;
            
            showToast(`กำลังบันทึกการตั้งค่าล็อกเดือน...`, "warning");
            
            dbInstance.updatePaymentStatusRemote("CONFIG_LOCKED_MONTHS", state.selectedMonth, newLockState ? "locked" : "unpaid").then(result => {
                if (result.success) {
                    showToast(`ทำการ${newLockState ? "ล็อก" : "เปิดรับ"}การชำระเงินของเดือน ${MONTH_NAMES[state.selectedMonth]} เรียบร้อย!`, "success");
                } else {
                    showToast(`การตั้งค่าล้มเหลว: ${result.error}`, "danger");
                }
                renderAdminDashboard();
            });
        });
    }

    // ฟังก์ชันช่วยของแอดมินในการอัปเดตสถานะของนักเรียนแบบแมนนวล
    function updateStudentStatusAdmin(studentId, newStatus, studentName) {
        const dbInstance = window.classroomDb;
        showToast(`กำลังบันทึกสถานะของ ${studentName}...`, "warning");
        
        dbInstance.updatePaymentStatusRemote(studentId, state.selectedMonth, newStatus).then(result => {
            if (result.success) {
                showToast(`อัปเดตสถานะของ ${studentName} เรียบร้อย!`, "success");
            } else {
                showToast(`อัปเดตบน Google Sheet ล้มเหลว: ${result.error}`, "danger");
            }
            renderAdminDashboard();
        });
    }

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
        const students = dbInstance.getAllStudents().filter(s => s.id !== "CONFIG_LOCKED_MONTHS");
        const stats = dbInstance.getStats(state.selectedMonth);

        // 1. อัปเดตการแสดงผลปุ่มล็อกเดือน
        const isLocked = dbInstance.isMonthLocked(state.selectedMonth);
        if (btnAdminLockMonth) {
            if (isLocked) {
                btnAdminLockMonth.innerHTML = "🔒 ปิดรับชำระเงินอยู่ (คลิกเพื่อเปิด)";
                btnAdminLockMonth.style.background = "#ef4444";
                btnAdminLockMonth.style.color = "white";
                btnAdminLockMonth.style.border = "none";
            } else {
                btnAdminLockMonth.innerHTML = "🔓 เปิดรับชำระเงินอยู่ (คลิกเพื่อปิด)";
                btnAdminLockMonth.style.background = "#10b981";
                btnAdminLockMonth.style.color = "white";
                btnAdminLockMonth.style.border = "none";
            }
        }

        // 2. อัปเดตการแสดงผลกล่องการ์ดตัวเลขสถิติ (Metrics)
        metricTotalPaid.textContent = `${stats.paidCount} / ${stats.totalStudents} คน`;
        metricTotalAmount.textContent = `${stats.paidAmount.toLocaleString()} บาท`;
        metricPercentText.textContent = `${stats.percentPaid}% จ่ายแล้ว`;
        
        // จัดการ CSS ของ Progress Bar วงกลมหรือแถบ
        const progressFill = document.getElementById("admin-progress-fill");
        if (progressFill) {
            progressFill.style.width = `${stats.percentPaid}%`;
        }

        // 3. เรนเดอร์ตารางรายชื่อเพื่อนในชั้น
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
            const status = student.status[state.selectedMonth] || "unpaid";
            const row = document.createElement("tr");
            
            let statusControlHTML = "";
            if (status === "paid" || status === true || status === "true") {
                statusControlHTML = `
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="status-badge paid" style="font-size:0.8rem; padding:0.25rem 0.5rem; border-radius:6px;">จ่ายแล้ว</span>
                        <button class="btn btn-secondary btn-admin-toggle-status" data-student-id="${student.id}" data-action="unpay" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius:6px; cursor:pointer;">
                            ยกเลิกจ่าย
                        </button>
                    </div>
                `;
            } else if (status === "pending" || status === "waiting") {
                statusControlHTML = `
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="status-badge pending" style="background:#eab308; border-color:#f59e0b; color:#fff; font-size:0.8rem; padding:0.25rem 0.5rem; border-radius:6px;">รออนุมัติ</span>
                        <button class="btn btn-accent btn-admin-approve" data-student-id="${student.id}" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; background:linear-gradient(90deg, #10b981, #059669); border:none; color:white; font-weight:600; cursor:pointer; border-radius:6px; transition:transform 0.1s;">
                            ✅ อนุมัติการโอน
                        </button>
                        <button class="btn btn-secondary btn-admin-toggle-status" data-student-id="${student.id}" data-action="unpay" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius:6px; cursor:pointer;">
                            ปฏิเสธ
                        </button>
                    </div>
                `;
            } else {
                statusControlHTML = `
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="status-badge unpaid" style="font-size:0.8rem; padding:0.25rem 0.5rem; border-radius:6px;">ยังไม่จ่าย</span>
                        <button class="btn btn-primary btn-admin-toggle-status" data-student-id="${student.id}" data-action="pay" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius:6px; cursor:pointer;">
                            ทำจ่าย
                        </button>
                    </div>
                `;
            }

            row.innerHTML = `
                <td class="td-student-id">${student.id}</td>
                <td class="td-student-name">${student.name}</td>
                <td>
                    ${statusControlHTML}
                </td>
            `;

            // ผูกฟังก์ชันการทำงานปุ่มต่างๆ ในแถวแอดมิน
            const approveBtn = row.querySelector(".btn-admin-approve");
            if (approveBtn) {
                approveBtn.addEventListener("click", () => {
                    updateStudentStatusAdmin(student.id, "paid", student.name);
                });
            }

            row.querySelectorAll(".btn-admin-toggle-status").forEach(btn => {
                btn.addEventListener("click", () => {
                    const action = btn.getAttribute("data-action");
                    const newStatus = action === "pay" ? "paid" : "unpaid";
                    updateStudentStatusAdmin(student.id, newStatus, student.name);
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
        const students = dbInstance.getAllStudents().filter(s => s.id !== "CONFIG_LOCKED_MONTHS");
        const monthNameTh = MONTH_NAMES[state.selectedMonth];
        
        // หัวตาราง CSV (มี BOM เพื่อให้ภาษาไทยใน Excel แสดงผลถูกต้อง)
        let csvContent = "\uFEFF";
        csvContent += "รหัสนักศึกษา,ชื่อ-นามสกุล,เดือน,ยอดชำระ,สถานะการจ่ายเงิน\n";
        
        students.forEach(student => {
            const status = student.status[state.selectedMonth] || "unpaid";
            let statusText = "ยังไม่จ่าย";
            if (status === "paid" || status === true || status === "true") {
                statusText = "จ่ายแล้ว";
            } else if (status === "pending" || status === "waiting") {
                statusText = "รออนุมัติ";
            }
            csvContent += `"${student.id}","${student.name}","${monthNameTh}",100,"${statusText}"\n`;
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
