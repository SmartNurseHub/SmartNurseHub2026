// ======================================================================
// app.js — Front-end Controller for Patient & Nursing Records System
// ปรับโครงสร้างใหม่, อ่านง่ายขึ้น, เพิ่มคอมเมนต์ให้ทุกส่วน
// ======================================================================
// ======================================================================
// 0) GLOBAL CONFIG — ตัวแปรใช้งานทั่วระบบ
// ======================================================================
const API_BASE = "/api/sheet";       // base URL สำหรับเรียก API → เชื่อมกับ server.js
let patientsData = [];               // เก็บข้อมูลผู้ป่วยทั้งหมด (ใช้สำหรับ search และ autocomplete)
let nsrLocalCounter = 1;             // ตัวนับ NSR สำรอง หาก server ไม่สามารถออกเลข NSR ใหม่ได้
let nursingFormMode = "add";   // add | edit
let editingNSR = null;        // NSR ที่กำลังแก้ไข
let nursingRecordsCache = []; // ⭐ เก็บ nursing records ทั้งหมด
// ==========================
// VIEW STATE (scroll + tab)
// ==========================
let nursingViewState = {
  tab: null,
  scrollY: 0
};

// ======================================================================
// 1) UTILITIES — ฟังก์ชันช่วยให้เขียนโค้ดง่ายขึ้น
// ======================================================================
/** escapeHtml() — ป้องกัน XSS ตอนแสดงข้อมูลใน HTML */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** generateLocalNSR() — สร้างเลข NSR สำรองกรณี API ล้มเหลว */
function generateLocalNSR() {
  const d = new Date();
  const yyyy = d.getFullYear();                 // ปี 4 หลัก
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // เดือน 2 หลัก
  const seq = String(nsrLocalCounter++).padStart(5, "0");

  return `NSR${yyyy}${mm}-${seq}`;
}

/** $id() — shorthand document.getElementById() */
function $id(id) {
  return document.getElementById(id);
}
// ======================================================================
// 2) NAVIGATION (SPA Router) — โหลด view แบบ single-page
// ======================================================================
/**
 * navTo(view)
 * - กดปุ่ม sidebar → โหลดไฟล์ views/*.html
 * - dashboard ใช้ markup ตายตัว ( render ในนี้ )
 */
function navTo(view) {
  const container = document.getElementById('view-container');

  // Dashboard เป็นหน้า static ไม่โหลดไฟล์แยก
  if (view === 'dashboard') {
    container.innerHTML = `
      <div>
        <div class="d-flex gap-3 align-items-start flex-wrap">
          <div class="card card-compact" style="width: 320px;">
            <div class="card-body">
              <h6>ยอดผู้รับบริการวันนี้</h6>
              <h2 id="countToday">–</h2>
            </div>
          </div>
          <div class="flex-grow-1">
            <div class="card card-compact">
              <div class="card-body">
                <h6>กราฟสรุปการให้บริการ (7 วันล่าสุด)</h6>
                <canvas id="chartServices" height="100"></canvas>
              </div>
            </div>
          </div>
        </div>

        <div class="card mt-3">
          <div class="card-body">
            <h6>ข้อมูลจาก Google Sheet</h6>
            <div id="tableArea">กำลังโหลด...</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // view อื่นโหลดจาก /views/xxxx.html
  fetch(`views/${view}.html`)
  .then(res => res.text())
  .then(html => {
    container.innerHTML = html;

    if (view === "nursingRecords") {
  setupNursingForm();
  setupNursingTabs();
  setupAutoResizeTextarea();

  loadPatients().then(() => {
    setupPatientSearch();
  });

  // ✅ รอ DOM render ก่อน
  setTimeout(() => {
    loadNursingRecords();
    restoreNursingViewState();
  }, 0);
}




    if (view === "patients") {
      loadPatients();
    }
  })
  .catch(() => {
    container.innerHTML = `<p class="text-danger">ไม่สามารถโหลดหน้า ${view}</p>`;
  });

}

/** toggleSidebar() — ซ่อน/แสดง sidebar */
function toggleSidebar() {
  $id("sidebar")?.classList.toggle("collapsed");
}

/** logout() — ปัจจุบันเป็น placeholder */
function logout() {
  alert("ออกจากระบบแล้ว");
}





/**
 * setupPatientSearch()
 * - Search box ด้าน nursing form → ค้นหาผู้ป่วยจาก patientsData
 * - คลิกชื่อ → เติมฟอร์ม nursing โดยอิง ID ในหน้า view
 */
// ======================================================================
// 3) LOAD PATIENTS + SEARCH (แก้ไข)
// ======================================================================

async function loadPatients() {
  const div = $id("patientsTable");
  if (div) div.textContent = "กำลังโหลด...";

  try {
    const res = await fetch(`${API_BASE}/Patients`);
    if (!res.ok) throw new Error("โหลดข้อมูลผิดพลาด");

    const json = await res.json();
    if (!json.success || !Array.isArray(json.data))
      throw new Error("ข้อมูลไม่ถูกต้อง");

    // 1️⃣ เก็บข้อมูลหลัก
    window.patientsData = json.data;

    // 2️⃣ BUILD SEARCH INDEX (FAST 🔥)
    window.patientIndex = window.patientsData.map((p, i) => ({
      i,
      text: [
        p.HN,
        p.NAME,
        p.LNAME,
        p.PID,
        p.CID
      ].filter(Boolean).join(" ").toLowerCase()
    }));

    console.log("Patients loaded:", window.patientsData.length);
    console.log("Index built:", window.patientIndex.length);

    // 3️⃣ render table (ถ้ามี)
    if (div) {
      div.innerHTML = `
        <table class="table table-striped table-sm">
          <tbody>
            ${window.patientsData.map(p => `
              <tr>
                <td>${escapeHtml(p.HN)}</td>
                <td>${escapeHtml(p.NAME)}</td>
                <td>${escapeHtml(p.LNAME)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

  } catch (err) {
    console.error(err);
    if (div) div.textContent = "โหลดข้อมูลไม่สำเร็จ";
  }
}


let patientSearchInitialized = false;

function setupPatientSearch() {
  if (patientSearchInitialized) return;
  patientSearchInitialized = true;

  const input = $id("patientSearch");
  const list  = $id("searchResults");
  const btn   = $id("btnSearchPatient");
  if (!input || !list) return;

  let timer = null;

const doSearch = () => {
  const q = input.value.trim();
  if (!q) {
    list.style.display = "none";
    list.innerHTML = "";
    return;
  }

  if (!window.patientIndex) return;

  const matches = searchPatientsFast(q);

  if (!matches.length) {
    list.innerHTML = `<div class="list-group-item text-muted">ไม่พบข้อมูล</div>`;
    list.style.display = "block";
    return;
  }

  list.innerHTML = matches.map(i => {
    const p = window.patientsData[i];
    return `
      <button type="button"
        class="list-group-item list-group-item-action"
        data-i="${i}">
        <b>${escapeHtml(p.NAME)} ${escapeHtml(p.LNAME)}</b>
        <div style="font-size:12px;color:#666;">
          HN: ${escapeHtml(p.HN)}
          | เลขบัตร: ${escapeHtml(p.PID || p.CID)}
        </div>
      </button>
    `;
  }).join("");

  list.style.display = "block";
};


  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(doSearch, 200);
  });

  input.addEventListener("click", e => e.stopPropagation());
  list.addEventListener("click", e => e.stopPropagation());

  btn?.addEventListener("click", doSearch);

  list.addEventListener("click", e => {
    const row = e.target.closest("[data-i]");
    if (!row) return;

    const p = window.patientsData[row.dataset.i];
    if (!p) return;

    $id("HN")        && ($id("HN").value = p.HN || "");
$id("CID")       && ($id("CID").value = p.CID || p.PID || "");
$id("NAME")      && ($id("NAME").value = p.NAME || "");
$id("LNAME")     && ($id("LNAME").value = p.LNAME || "");
$id("TELEPHONE") && ($id("TELEPHONE").value = p.TELEPHONE || p.TEL || "");


    input.value = `${p.NAME} ${p.LNAME}`;
    list.style.display = "none";
  });

  document.addEventListener("click", () => {
    list.style.display = "none";
  });
}


function searchPatientsFast(query, limit = 20) {
  const q = query.toLowerCase();
  const result = [];

  for (const item of window.patientIndex) {
    if (item.text.includes(q)) {
      result.push(item.i);
      if (result.length >= limit) break;
    }
  }
  return result;
}



// ======================================================================
// 4) LOAD NURSING RECORDS TABLE
// ======================================================================

/**
 * loadNursingRecords()
 * - โหลดข้อมูลเวชระเบียนพยาบาลจาก API
 * - แสดงลงตารางใน view → nursingRecords.html
 */
async function loadNursingRecords() {
  const tbody = document.getElementById("nursingTableBody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center">กำลังโหลด...</td>
    </tr>
  `;

  try {
    const res = await fetch(`${API_BASE}/NursingRecords`);
    if (!res.ok) throw new Error("โหลดข้อมูลผิดพลาด");

    const json = await res.json();
    if (!json.success || !Array.isArray(json.data))
      throw new Error("ข้อมูลไม่ถูกต้อง");

    // ⭐ จุดเชื่อมที่หายไป
    nursingRecordsCache = json.data; // ⭐ cache ไว้ใช้ปริ้น
    renderNursingRecords(json.data);

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger">
          โหลดข้อมูลล้มเหลว
        </td>
      </tr>
    `;
  }
}




// ======================================================================
// 5) SUBMIT NURSING FORM — บันทึกเวชระเบียนพยาบาล
// ======================================================================

/**
 * setupNursingForm()
 * - ผูก event submit กับฟอร์ม Nursing
 * - ส่งข้อมูลไปที่ API /NursingRecords (POST)
 * - server.js จะทำการ append row ใหม่ใน sheet
 */
function setupNursingForm() {
  const form = $id("nursingForm");
  if (!form) return;

  const nsr = $id("NSR");
  const stamp = $id("Stamp");
  const hn = $id("HN");

  // default mode
  nursingFormMode = "add";
  editingNSR = null;

  fetchNextNSR().then(next => {
    if (!nsr.value) nsr.value = next;
  });

  stamp.value = new Date().toISOString();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    stamp.value = new Date().toISOString();

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      let res, json;

      // =========================
      // ⭐ EDIT MODE
      // =========================
      if (nursingFormMode === "edit" && editingNSR) {
  data._mode = "edit";       // ⭐ สำคัญ
  data._key  = editingNSR;   // ⭐ สำคัญ (NSR)

  res = await fetch(`${API_BASE}/NursingRecords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

      // =========================
      // ⭐ ADD MODE
      // =========================
      else {
        res = await fetch(`${API_BASE}/NursingRecords`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(data)
        });
      }

      json = await res.json();
      if (!json.success) {
        alert("บันทึกไม่สำเร็จ");
        return;
      }

      // =========================
      // หลังบันทึก
      // =========================
      alert(nursingFormMode === "edit" ? "อัปเดตข้อมูลสำเร็จ" : "บันทึกสำเร็จ");
      
// ⭐ จำ tab + scroll ก่อน reload view
saveNursingViewState();

// 🔄 reload เฉพาะ view nursingRecords
setTimeout(() => {
  navTo("nursingRecords");
}, 300);



     
      hn.focus();

    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล");
    }
  });
}


// ==============================
// SHOW / HIDE Nursing Table
// ==============================
function showNursingTable(show = true) {
  const section = document.getElementById("nursingTableSection");
  if (!section) return;

  section.style.display = show ? "block" : "none";
}


// ======================================================================
// 6) FILE UPLOAD — อัปโหลด Excel/CSV ผู้ป่วยและเวชระเบียน
// ======================================================================

/**
 * setupNursingUploadForm()
 * - ฟอร์มอัปโหลดไฟล์ → ส่งไฟล์ไป API /upload
 * - API จะอ่านไฟล์ → append หรือ update ข้อมูลใน Google Sheet
 */
function setupNursingUploadForm() {
  const form = $id("nursingUploadForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);

    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
      const json = await res.json();

      alert(json.success ? "อัปโหลดสำเร็จ" : "อัปโหลดล้มเหลว");
      if (json.success) form.reset();

    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการอัปโหลด");
    }
  });
}


// ======================================================================
// 7) TABS — UI tab switching ใน NursingRecords
// ======================================================================

/**
 * setupNursingTabs()
 * - ควบคุมการกดสลับแท็บใน nursingRecords.html
 */
function setupNursingTabs() {
  const btns = document.querySelectorAll(".nr-tab-btn");
  const panels = document.querySelectorAll(".nr-tab-panel");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      panels.forEach(p => (p.style.display = "none"));

      btn.classList.add("active");
      const target = btn.dataset.tabTarget;

      document.querySelector(`.nr-tab-panel[data-tab="${target}"]`).style.display = "block";
    });
  });
}



// ======================================================================
// 8) REAL-TIME UPLOAD (XMLHttpRequest)
// ======================================================================
// ใช้สำหรับแสดง progress bar ระหว่างอัปโหลดไฟล์

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'submitFile') {

    const fileInput = $id('fileInput');
    const fileName = $id('fileName');
    const progressContainer = $id('uploadProgressContainer');
    const progressBar = $id('uploadProgress');
    const uploadStatus = $id('uploadStatus');
    const totalRowsEl = $id('totalRows');
    const newRowsEl = $id('newRows');
    const updatedRowsEl = $id('updatedRows');

    if (!fileInput || !fileInput.files.length)
      return alert("กรุณาเลือกไฟล์");

    const file = fileInput.files[0];

    // รีเซ็ต UI
    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    uploadStatus.textContent = "สถานะ: กำลังอัปโหลด...";

    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`, true); // server.js → POST /upload

    // แสดงเปอร์เซ็นต์อัปโหลดแบบเรียลไทม์
    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        const percent = Math.round((ev.loaded / ev.total) * 100);
        progressBar.style.width = percent + "%";
        progressBar.textContent = percent + "%";
      }
    });

    // เมื่ออัปโหลดเสร็จ
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        try {
          const json = JSON.parse(xhr.responseText);

          if (json.success) {
            totalRowsEl.textContent = json.totalRows || 0;
            newRowsEl.textContent = json.newRows || 0;
            updatedRowsEl.textContent = json.updatedRows || 0;

            uploadStatus.textContent = "สถานะ: อัปโหลดสำเร็จ ✅";
            progressBar.style.width = "100%";
            progressBar.textContent = "100%";

            fileInput.value = "";
            fileName.textContent = "ยังไม่ได้เลือกไฟล์";

            loadPatients();

          } else {
            uploadStatus.textContent = "สถานะ: ล้มเหลว ❌ - " + (json.message || "");
          }

        } catch (err) {
          console.error(err);
          uploadStatus.textContent = "สถานะ: ล้มเหลว ❌ - response parse error";
        }
      }
    };

    xhr.onerror = () => {
      uploadStatus.textContent = "สถานะ: ล้มเหลว ❌ - network error";
    };

    xhr.send(fd);
  }
});



// ======================================================================
// 9) FILE NAME UI UPDATE (change event)
// ======================================================================

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'fileInput') {
    const fileName = $id('fileName');
    fileName.textContent =
      e.target.files.length > 0 ? e.target.files[0].name : "ยังไม่ได้เลือกไฟล์";
  }
});



// ======================================================================
// 10) AUTO RESIZE TEXTAREA — ใช้ในแบบฟอร์ม Nursing
// ======================================================================

function setupAutoResizeTextarea() {
  document.querySelectorAll(".auto-resize").forEach(t => {
    t.addEventListener("input", () => {
      t.style.height = "auto";
      t.style.height = t.scrollHeight + "px";
    });
  });
}



// ======================================================================
// 11) fetchNextNSR() — ขอเลข NSR ใหม่จาก API
// ======================================================================

async function fetchNextNSR() {
  try {
    const res = await fetch(`${API_BASE}/new/nsr`);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const json = await res.json();
    if (json.success && json.next)
      return json.next;

    return generateLocalNSR();

  } catch (err) {
    console.warn("fetchNextNSR failed → fallback local:", err);
    return generateLocalNSR();
  }
}

// ===========================
// FIX: เปิดแท็บจาก dropdown แม้โหลด view ทีหลัง
// ===========================
document.addEventListener("click", function (e) {
  const btn = e.target.closest(".open-tab");
  if (!btn) return;

  e.preventDefault();

  const tab = btn.getAttribute("data-target-tab");
  if (!tab) return;

  // ซ่อนทุก panel
  document.querySelectorAll(".nr-tab-panel").forEach(p => {
    p.style.display = "none";
  });

  // แสดง panel เป้าหมาย
  const target = document.querySelector(`.nr-tab-panel[data-tab="${tab}"]`);
  if (target) {
    target.style.display = "block";
  }
});

// ==============================
// ฟังก์ชันโหลดข้อมูลบันทึกลงฟอร์ม
// ==============================
async function loadNursingRecord(nsrNo) {
  console.log("🟡 loadNursingRecord NSR =", JSON.stringify(nsrNo));
  try {
    const res = await fetch(`${API_BASE}/NursingRecords/${encodeURIComponent(nsrNo)}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
    }

    const text = await res.text();

    // 🛑 ถ้า server ส่ง HTML กลับมา
    if (text.trim().startsWith("<")) {
      console.error("HTML returned instead of JSON:", text);
      alert("API ผิดพลาด: server ส่ง HTML กลับมา");
      return;
    }

    const json = JSON.parse(text);

    if (!json.success || !json.data) {
      throw new Error("ไม่พบข้อมูลบันทึก");
    }

    const data = json.data;
    // =========================
    // ⭐ SET EDIT MODE
    // =========================
    nursingFormMode = "edit";
    editingNSR = nsrNo;

    // เปลี่ยนข้อความปุ่ม
    const submitBtn = document.querySelector("#nursingForm button[type='submit']");
    if (submitBtn) {
      submitBtn.textContent = "💾 อัปเดตข้อมูล";
      submitBtn.classList.remove("btn-primary");
      submitBtn.classList.add("btn-warning");
    }

    // ล็อก NSR ห้ามแก้
    document.getElementById("NSR").readOnly = true;


    // เติมค่าในฟอร์ม
    document.getElementById("NSR").value = data.NSR || "";
    document.getElementById("Stamp").value = data.Stamp || "";
    document.getElementById("HN").value = data.HN || "";
    document.getElementById("CID").value = data.CID || "";
    document.getElementById("NAME").value = data.NAME || "";
    document.getElementById("LNAME").value = data.LNAME || "";
    document.getElementById("TELEPHONE").value = data.TELEPHONE || "";
    document.getElementById("DateService").value = data.DateService || "";
    document.getElementById("Activity").value = data.Activity || "";
    document.getElementById("Objective").value = data.Objective || "";
    document.getElementById("HealthInform").value = data.HealthInform || "";
    document.getElementById("HealthAdvice").value = data.HealthAdvice || "";

    // Follow-ups
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`DateFollow${i}`).value = data[`DateFollow${i}`] || "";
      document.getElementById(`TimeFollow${i}`).value = data[`TimeFollow${i}`] || "";
      document.getElementById(`RouteFollow${i}`).value = data[`RouteFollow${i}`] || "";
      document.getElementById(`Provider${i}`).value = data[`Provider${i}`] || "";
      document.getElementById(`Response${i}`).value = data[`Response${i}`] || "";
    }

    // แสดง tab online
    document.querySelectorAll(".nr-tab-panel").forEach(panel => panel.style.display = "none");
    document.querySelector('[data-tab="online"]').style.display = "block";

  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
  }
}
function saveNursingViewState() {
  // tab ที่ active
  const activeTabBtn = document.querySelector(".nr-tab-btn.active");
  nursingViewState.tab = activeTabBtn?.dataset.tabTarget || null;

  // scroll position
  nursingViewState.scrollY = window.scrollY || 0;
}

function restoreNursingViewState() {
  // restore tab
  if (nursingViewState.tab) {
    const btn = document.querySelector(
      `.nr-tab-btn[data-tab-target="${nursingViewState.tab}"]`
    );
    btn?.click();
  }

  // restore scroll (รอ DOM render เสร็จ)
  setTimeout(() => {
    window.scrollTo({
      top: nursingViewState.scrollY,
      behavior: "instant"
    });
  }, 50);
}

// ==============================
// เติม data-nsr ให้แต่ละรายการในตาราง
// ==============================
function renderNursingRecords(records) {
  const tbody = document.getElementById("nursingTableBody");
  tbody.innerHTML = "";

  records.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-center">${r.NSR}</td>
      <td class="text-center">${r.DateService}</td>
      <td class="text-center">${r.HN}</td>
      <td>${r.NAME} ${r.LNAME}</td>
      <td>${r.Activity}</td>
      <td>${r.Provider1 || ""}</td>
      <td class="text-center">
  <button type="button" class="btn btn-sm btn-info"
  onclick="printStickerByNSR('${r.NSR}')">
  🖨️
</button>

<button type="button" class="btn btn-sm btn-warning edit-record"
  data-nsr="${r.NSR}">
  ✏️
</button>

</td>

    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("click", function(e) {
  if (e.target && e.target.classList.contains("edit-record")) {
    e.preventDefault();
    const nsrNo = e.target.getAttribute("data-nsr");
    if (!nsrNo) {
      alert("ไม่พบ NSR ของบันทึกนี้");
      return;
    }
    loadNursingRecord(nsrNo); // ฟังก์ชันโหลดข้อมูลลงฟอร์ม
  }
});

// ======================================================================
// TEXTAREA SUGGEST (รองรับ SPA / navTo / dynamic view)
// ======================================================================

(() => {
  const SUGGEST = {
    inform: [
      "จากผลการตรวจทางห้องปฏิบัติการ สงสัยภาวะโลหิตจาง",
      "จากผลการตรวจทางห้องปฏิบัติการ ไม่พบภาวะโลหิตจาง",
      "Hb =   g/dL, Hct =  % อยู่ในเกณฑ์ปกติ",
      "Hb =   g/dL, Hct =  % ต่ำกว่าเกณฑ์ปกติ",
      "MCV =  fL (< 80 fL) ภาวะขาดธาตุเหล็ก",
      "MCV =  fL (80–100 fL) โลหิตจางระยะแรก",
      "MCV =  fL (> 100 fL) ภาวะขาดวิตามิน B12 หรือโฟเลต",
    ],
    advice: [
      "แนะนำเสริมอาหารที่มีธาตุเหล็ก และเฝ้าระวังอาการอ่อนเพลีย เวียนศีรษะ",
      "แนะนำการดูแลสุขภาพเบื้องต้นที่บ้าน",
      "แนะนำควบคุมอาหารและออกกำลังกายสม่ำเสมอ",
      "แนะนำสังเกตอาการผิดปกติและมาพบแพทย์ทันที"
    ],
    response: [
      "ผู้รับบริการเข้าใจคำแนะนำ และปฏิบัติตามได้",
      "ไม่พบอาการผิดปกติเพิ่มเติม"
    ],
    provider: [
      "ธนชนัญ เกณฑ์คง",
    ]
  };

  let activeIndex = -1;
  let items = [];
  let activeTextarea = null;

  function getBox() {
    return document.getElementById("textarea-suggest");
  }

  function closeBox() {
    const box = getBox();
    if (!box) return;
    box.style.display = "none";
    activeIndex = -1;
    items = [];
  }

  function highlight() {
    items.forEach((el, i) =>
      el.classList.toggle("active", i === activeIndex)
    );
  }

  // ======================
  // INPUT
  // ======================
  document.addEventListener("input", e => {
    const t = e.target;
    if (!t.matches("textarea[data-type]")) return;

    const box = getBox();
    if (!box) return;

    activeTextarea = t;
    const type = t.dataset.type;
    const lines = t.value.split("\n");
    const val = lines[lines.length - 1].trim(); // 🔑 เอาแค่บรรทัดล่าสุด


    box.innerHTML = "";
    if (!val || !SUGGEST[type]) return closeBox();

    const matches = SUGGEST[type].filter(x => x.includes(val));
    if (!matches.length) return closeBox();

    matches.forEach(text => {
      const div = document.createElement("div");
      div.className = "list-group-item list-group-item-action";
      div.textContent = text;
      div.onclick = () => {
  appendSuggestion(t, text);
  closeBox();
  t.focus();
};

      box.appendChild(div);
    });

    items = [...box.children];
    const r = t.getBoundingClientRect();
    box.style.left = r.left + "px";
    box.style.top = r.bottom + window.scrollY + "px";
    box.style.width = r.width + "px";
    box.style.display = "block";
  });

  // ======================
  // KEYBOARD ↑ ↓ Enter
  // ======================
  document.addEventListener("keydown", e => {
    const box = getBox();
    if (!box || box.style.display !== "block") return;
    if (e.key === "Enter" && activeIndex === -1) {
  closeBox();
}

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlight();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlight();
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].click();
    }
    if (e.key === "Escape") closeBox();
  });

  // ======================
  // CLICK OUTSIDE
  // ======================
  document.addEventListener("click", e => {
    const box = getBox();
    if (!box) return;
    if (!box.contains(e.target)) closeBox();
  });
})();
function appendSuggestion(textarea, text) {
  const lines = textarea.value.split("\n");

  // กันซ้ำทั้ง textarea
  if (textarea.value.includes(text)) return;

  // 🔑 แทนเฉพาะบรรทัดล่าสุด
  lines[lines.length - 1] = text;

  textarea.value = lines.join("\n") + "\n";

  textarea.dispatchEvent(new Event("input"));
}

function printStickerByNSR(nsr) {
  const record = nursingRecordsCache.find(r => r.NSR === nsr);

  if (!record) {
    alert("ไม่พบข้อมูลเวชระเบียน");
    return;
  }

  openStickerPrint(record);
}
async function openStickerPrint(r) {
  try {
    let res = await fetch("/views/sticker.html");
    let html = await res.text();

    // รายการฟิลด์ทั้งหมดจากฟอร์ม
    const fields = [
      "NSR","Stamp","CID","HN","NAME","LNAME","TELEPHONE","DateService",
      "Activity","Objective","HealthInform","HealthAdvice",
      "DateFollow1","TimeFollow1","RouteFollow1","Response1","Provider1",
      "DateFollow2","TimeFollow2","RouteFollow2","Response2","Provider2",
      "DateFollow3","TimeFollow3","RouteFollow3","Response3","Provider3",
      "FollowCancel1","FollowCancel2","FollowCancel3"
    ];

    fields.forEach(f => {
      html = html.replaceAll(`{{${f}}}`, r[f] || "");
    });

    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  } catch (err) {
    console.error("Error opening sticker:", err);
  }
}



// ======================================================================
// END OF FILE
// ======================================================================
