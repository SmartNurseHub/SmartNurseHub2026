/********************************************************************
 * SERVER.JS — FULL VERSION (NSR Sequencing + All APIs)
 ********************************************************************/

/********************************************************************
 * SECTION 1 — LOAD CORE MODULES
 ********************************************************************/
require("dotenv").config();
const express = require("express");
const path = require("path");
const morgan = require("morgan");
const fs = require("fs");
const multer = require("multer");
const { google } = require("googleapis");
const { router: sheetsRouter, readSheet } = require("./routes/sheets");

/********************************************************************
 * SECTION 2 — GLOBAL CONFIG
 ********************************************************************/
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_PATIENTS = "Patients";
const SHEET_NURSING = "NursingRecords";
const upload = multer({ dest: "uploads/" });

/********************************************************************
 * SECTION 3 — INITIALIZE EXPRESS APP
 ********************************************************************/
const app = express();

/********************************************************************
 * SECTION 4 — ENVIRONMENT DEBUG
 ********************************************************************/
console.log(">>> ENV CHECK");
console.log("SPREADSHEET_ID =", SPREADSHEET_ID);
console.log("CREDENTIAL =", process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log("Exists =", fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));
console.log("<<< END ENV CHECK");

/********************************************************************
 * SECTION 5 — MIDDLEWARE
 ********************************************************************/
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/sheet", sheetsRouter);



/********************************************************************
 * SECTION 6 — HELPERS
 ********************************************************************/
function parseTxt(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const obj = {};
  lines.forEach(line => {
    const [k, ...rest] = line.split("=");
    if (!k) return;
    const v = rest.join("=").trim();
    if (v) obj[k.trim()] = v;
  });
  return obj;
}

function findHeaderIndex(headers = [], target) {
  let i = headers.findIndex(h => String(h).trim() === target);
  if (i !== -1) return i;
  const lower = headers.map(h => String(h).trim().toLowerCase());
  return lower.indexOf(target.toLowerCase());
}

/********************************************************************
 * SECTION 7 — updatePatientsSheet()
 ********************************************************************/
async function updatePatientsSheet(newDataList) {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_PATIENTS}!A1:AG`
  });

  const rows = resp.data.values || [];
  if (!rows.length) throw new Error("Patients sheet empty");

  const header = rows[0];
  const cidIndex = header.findIndex(h => h === "CID");
  if (cidIndex === -1) throw new Error("CID column not found");

  const cidMap = {};
  for (let i = 1; i < rows.length; i++) {
    const cid = rows[i][cidIndex] || "";
    if (cid) cidMap[cid] = i + 1;
  }

  const updateRequests = [];
  const appendRows = [];

  for (const newData of newDataList) {
    const row = header.map(h => newData[h] || "");
    if (cidMap[newData.CID]) {
      updateRequests.push({
        range: `${SHEET_PATIENTS}!A${cidMap[newData.CID]}`,
        values: [row]
      });
    } else {
      appendRows.push(row);
    }
  }

  if (updateRequests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { valueInputOption: "RAW", data: updateRequests }
    });
  }

  if (appendRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_PATIENTS}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: appendRows }
    });
  }

  return {
    totalRows: newDataList.length,
    newRows: appendRows.length,
    updatedRows: updateRequests.length
  };
}

/********************************************************************
 * SECTION 8 — API: Upload Patients File
 ********************************************************************/
app.post("/api/patients/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, message: "ไม่มีไฟล์" });
    const content = fs.readFileSync(req.file.path, "utf8");
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
    fs.unlink(req.file.path, () => {});

    if (lines.length < 2) return res.json({ success: false, message: "ไฟล์ว่างหรือไม่มีข้อมูล" });

    const headers = lines[0].split(/\||,/).map(h => h.trim());
    const seenCID = new Set();
    const newDataList = [];

    lines.slice(1).forEach(line => {
      const values = line.split(/\||,/);
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || "");
      if (!obj.CID) return;
      if (seenCID.has(obj.CID)) return;
      seenCID.add(obj.CID);
      newDataList.push(obj);
    });

    const report = await updatePatientsSheet(newDataList);
    res.json({ success: true, ...report });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

/********************************************************************
 * SECTION 9 — API: Search Patients
 ********************************************************************/
app.get("/api/patients", async (req, res) => {
  try {
    const q = (req.query.search || "").trim().toLowerCase();
    if (!q) return res.json({ success: true, data: [] });
    const data = await readSheet("Patients");
    if (!Array.isArray(data)) return res.json({ success: false, data: [] });

    const result = data.filter(p => {
      const name = `${p.NAME || ""}${p.LNAME || ""}`.toLowerCase();
      return name.includes(q)
        || (p.HN && p.HN.includes(q))
        || (p.CID && p.CID.includes(q));
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/********************************************************************
 * SECTION 10 — HELPER: Generate next NSR (เรียกได้ทั้ง GET + POST)
 ********************************************************************/
async function generateNextNSR_SAFE() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const ym = `${yyyy}${mm}`;
  const prefix = `NSR${ym}-`;

  // 1️⃣ อ่าน sequence sheet
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "NSR_SEQUENCE!A:B"
  });

  const rows = resp.data.values || [];
  let rowIndex = -1;
  let lastSeq = 0;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === ym) {
      rowIndex = i + 1; // row จริงใน sheet
      lastSeq = parseInt(rows[i][1] || "0", 10);
      break;
    }
  }

  const nextSeq = lastSeq + 1;

  // 2️⃣ update หรือ append
  if (rowIndex > -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `NSR_SEQUENCE!B${rowIndex}`,
      valueInputOption: "RAW",
      resource: { values: [[nextSeq]] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "NSR_SEQUENCE!A:B",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [[ym, nextSeq]] }
    });
  }

  const nsr = prefix + String(nextSeq).padStart(5, "0");
  console.log("🔒 [NSR SAFE]", nsr);
  return nsr;
}



/********************************************************************
 * SECTION 11 — API: GET new NSR
 ********************************************************************/
app.get("/api/sheet/new/nsr", async (req, res) => {
  const nextNSR = await generateNextNSR_SAFE();
  res.json({ success: true, next: nextNSR });
});


/********************************************************************
 * SECTION 12 — API: POST Save NursingRecord
 ********************************************************************/
app.post("/api/sheet/NursingRecords", async (req, res) => {
  console.log("🧨 RAW BODY =", req.body);
  console.log("🧨 MODE =", JSON.stringify(req.body._mode));
  console.log("🧨 KEY  =", JSON.stringify(req.body._key));
  try {
    const data = req.body || {};
    const mode = String(data._mode || "add").trim().toLowerCase();
    const keyNSR = data._key || data.NSR;

    if (!keyNSR) {
      return res.status(400).json({ success: false, message: "NSR missing" });
    }

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NURSING
    });

    const rows = resp.data.values || [];
    if (rows.length === 0) throw new Error("NursingRecords empty");

    const header = rows[0];
    const nsrIndex = header.indexOf("NSR");
    if (nsrIndex === -1) throw new Error("NSR column not found");

    // เตรียม row ใหม่จาก header
    const newRow = header.map(h => data[h] || "");

    // ==========================
    // ✏️ EDIT MODE
    // ==========================
    if (mode === "edit") {
      let targetRow = -1;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][nsrIndex] === keyNSR) {
          targetRow = i + 1; // row จริงใน sheet
          break;
        }
      }

      if (targetRow === -1) {
        return res.json({ success: false, message: "NSR not found" });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NURSING}!A${targetRow}`,
        valueInputOption: "RAW",
        resource: { values: [newRow] }
      });

      console.log("✏️ [NSR UPDATED]", keyNSR);
      return res.json({ success: true, NSR: keyNSR });
    }

    // ==========================
    // ➕ ADD MODE
    // ==========================
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NURSING}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [newRow] }
    });

    console.log("➕ [NSR ADDED]", keyNSR);
    res.json({ success: true, NSR: keyNSR });

  } catch (err) {
    console.error("💥 Nursing Save Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});





/********************************************************************
 * SECTION 13 — API: Load all NursingRecords
 ********************************************************************/
app.get("/api/sheet/NursingRecords", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NURSING
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) return res.json({ success: true, data: [] });

    const header = rows[0];
    const data = rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i] || ""; });
      return obj;
    });

    res.json({ success: true, data });

  } catch (err) {
    console.error("Load Nursing Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/********************************************************************
 * SECTION 14 — SPA FALLBACK (ROOT index.html)
 ********************************************************************/

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false });
  }
  res.sendFile(path.join(__dirname, "index.html"));
});


/********************************************************************
 * SECTION 15 — START SERVER
 ********************************************************************/
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
