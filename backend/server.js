/********************************************************************
 * SERVER.JS — PRODUCTION READY (SmartNurseHub2026)
 ********************************************************************/
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const helmet = require("helmet");
const multer = require("multer");
const { google } = require("googleapis");

const { router: sheetsRouter, readSheet } = require("./routes/sheets");

/********************************************************************
 * GLOBAL CONFIG
 ********************************************************************/
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const SHEET_PATIENTS = "Patients";
const SHEET_NURSING = "NursingRecords";

/********************************************************************
 * INIT EXPRESS
 ********************************************************************/
const app = express();

/********************************************************************
 * SECURITY & LOGGING
 ********************************************************************/
app.use(helmet());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

/********************************************************************
 * MIDDLEWARE
 ********************************************************************/
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/********************************************************************
 * UPLOAD CONFIG
 ********************************************************************/
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/********************************************************************
 * GOOGLE AUTH (PRODUCTION SAFE)
 ********************************************************************/
const googleAuth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheetsAPI = google.sheets({
  version: "v4",
  auth: googleAuth
});

/********************************************************************
 * ROUTES
 ********************************************************************/
app.use("/api/sheet", sheetsRouter);

/********************************************************************
 * API: UPLOAD PATIENTS FILE
 ********************************************************************/
app.post("/api/patients/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: "ไม่มีไฟล์" });
    }

    const content = fs.readFileSync(req.file.path, "utf8");
    fs.unlink(req.file.path, () => {});

    const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) {
      return res.json({ success: false, message: "ไฟล์ไม่มีข้อมูล" });
    }

    const headers = lines[0].split(/\||,/).map(h => h.trim());
    const seenCID = new Set();
    const newDataList = [];

    lines.slice(1).forEach(line => {
      const values = line.split(/\||,/);
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i] || ""));
      if (!obj.CID || seenCID.has(obj.CID)) return;
      seenCID.add(obj.CID);
      newDataList.push(obj);
    });

    // 👉 ฟังก์ชันนี้ควรอยู่ใน sheets service
    // const report = await updatePatientsSheet(newDataList);

    res.json({ success: true, count: newDataList.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/********************************************************************
 * API: SEARCH PATIENTS
 ********************************************************************/
app.get("/api/patients", async (req, res) => {
  try {
    const q = (req.query.search || "").trim().toLowerCase();
    if (!q) return res.json({ success: true, data: [] });

    const data = await readSheet(SHEET_PATIENTS);
    if (!Array.isArray(data)) {
      return res.json({ success: false, data: [] });
    }

    const result = data.filter(p => {
      const name = `${p.NAME || ""}${p.LNAME || ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (p.HN && p.HN.includes(q)) ||
        (p.CID && p.CID.includes(q))
      );
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/********************************************************************
 * HELPER: GENERATE NEXT NSR (SAFE)
 ********************************************************************/
async function generateNextNSR() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const ym = `${yyyy}${mm}`;
  const prefix = `NSR${ym}-`;

  const resp = await sheetsAPI.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "NSR_SEQUENCE!A:B"
  });

  const rows = resp.data.values || [];
  let rowIndex = -1;
  let lastSeq = 0;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === ym) {
      rowIndex = i + 1;
      lastSeq = parseInt(rows[i][1] || "0", 10);
      break;
    }
  }

  const nextSeq = lastSeq + 1;

  if (rowIndex > -1) {
    await sheetsAPI.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `NSR_SEQUENCE!B${rowIndex}`,
      valueInputOption: "RAW",
      resource: { values: [[nextSeq]] }
    });
  } else {
    await sheetsAPI.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "NSR_SEQUENCE!A:B",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [[ym, nextSeq]] }
    });
  }

  return prefix + String(nextSeq).padStart(5, "0");
}

/********************************************************************
 * API: GET NEW NSR
 ********************************************************************/
app.get("/api/sheet/new/nsr", async (req, res) => {
  try {
    const next = await generateNextNSR();
    res.json({ success: true, next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/********************************************************************
 * ROOT & SPA FALLBACK
 ********************************************************************/
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SmartNurseHub Backend" });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
console.log("📌 Mounted routes:");
console.log("/api/sheet/*");
/********************************************************************
 * GLOBAL ERROR HANDLER
 ********************************************************************/
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

/********************************************************************
 * START SERVER
 ********************************************************************/
app.listen(PORT, () => {
  console.log(`🚀 SmartNurseHub2026 running on port ${PORT}`);
});
