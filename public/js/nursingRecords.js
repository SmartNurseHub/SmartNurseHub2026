// =========================================================
// JS สำหรับหน้า Nursing Records (แบบ delegated event)
// ทำงานแม้โหลด nursingRecords.html เข้ามาทีหลัง
// =========================================================


// -------------------------
// 1) เปิด TAB จาก dropdown
// -------------------------
document.addEventListener("click", function (e) {
    const item = e.target.closest(".open-tab");
    if (!item) return;

    e.preventDefault();
    const tab = item.dataset.targetTab;

    document.querySelectorAll(".nr-tab-panel")
        .forEach(p => p.style.display = "none");

    const targetPanel = document.querySelector(`.nr-tab-panel[data-tab="${tab}"]`);
    if (targetPanel) targetPanel.style.display = "block";
});


// -------------------------
// 2) เปิด TAB จากปุ่มด้านบน nr-tab-btn
// -------------------------
document.addEventListener("click", function (e) {
    const btn = e.target.closest(".nr-tab-btn");
    if (!btn) return;

    document.querySelectorAll('.nr-tab-btn')
        .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');

    const tab = btn.dataset.tabTarget;

    document.querySelectorAll('.nr-tab-panel')
        .forEach(panel => panel.style.display = 'none');

    const targetPanel = document.querySelector(`.nr-tab-panel[data-tab="${tab}"]`);
    if (targetPanel) targetPanel.style.display = 'block';
});



// --------------------------------------------------------
// 3) FORM SUBMIT (บันทึกออนไลน์)
// --------------------------------------------------------
document.addEventListener("submit", async function (e) {
    const form = e.target.closest("#nursingForm");
    if (!form) return;

    e.preventDefault();

    const formData = new FormData(form);
    const json = Object.fromEntries(formData.entries());

    try {
        const res = await fetch('/api/NursingRecords/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
        });

        const data = await res.json();

        if (!data.success) {
            alert("บันทึกผิดพลาด: " + (data.error || "Unknown"));
            return;
        }

        alert("บันทึกสำเร็จ — NSR: " + data.nsr);
        loadNursingRecords();

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาด");
    }
});



// --------------------------------------------------------
// 4) โหลดตารางบันทึกทั้งหมด
// --------------------------------------------------------
async function loadNursingRecords() {
    try {
        const res = await fetch('/api/nursingRecords');
        const data = await res.json();

        const tbody = document.getElementById('nursingTableBody');
        if (!tbody) return; // view ยังไม่ถูกโหลด

        tbody.innerHTML = '';

        data.forEach(record => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${record.NSR}</td>
                <td>${record.DateService}</td>
                <td>${record.HN}</td>
                <td>${record.NAME} ${record.LNAME}</td>
                <td>${record.Activity}</td>
                <td>${record.Provider1 || ''}</td>
            `;

            tbody.appendChild(tr);
            
        });

    } catch (err) {
        console.error("โหลดข้อมูลผิดพลาด:", err);
    }
}
// หลังโหลดตาราง
document.querySelectorAll(".edit-record").forEach(btn=>{
  btn.addEventListener("click", e=>{
    e.preventDefault();
    const NSR = btn.dataset.nsr;
    if(NSR) loadNursingRecordToForm(NSR);
  });
});
nursingForm.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const formData = new FormData(nursingForm);
  const obj = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/NursingRecords/save`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(obj)
    });
    const result = await res.json();
    if(result.success){
      alert("บันทึกสำเร็จ");
      loadNursingRecords(); // โหลดตารางใหม่
      nursingForm.reset();
    } else {
      alert("เกิดข้อผิดพลาด: "+result.message);
    }
  } catch(err){
    console.error(err);
    alert("ไม่สามารถบันทึกข้อมูลได้");
  }
});

// --------------------------------------------------------
// 6) เรียกโหลดตารางเมื่อ view ถูกโหลดเสร็จ
// --------------------------------------------------------
document.addEventListener("view-loaded-nursingRecords", function () {
    loadNursingRecords();
});
