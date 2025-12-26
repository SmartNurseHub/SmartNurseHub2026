/********************************************************************
 * routes/sheets.js — SmartNurseHub2026
 ********************************************************************/
const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let sheetsClient = null;
async function getSheets() {
  if (sheetsClient) return sheetsClient;
  const auth = await google.auth.getClient({ scopes: SCOPES });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/* =========================
   Helpers
========================= */
function rowsToObjects(rows = []) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] || ""));
    return o;
  });
}

/* =========================
   GET Sheet (Patients / NursingRecords)
   app.js → /api/sheet/Patients
========================= */
router.get("/:sheetName([A-Za-z0-9_]+)", async (req, res) => {
  try {
    const sheets = await getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: req.params.sheetName
    });

    res.json({
      success: true,
      data: rowsToObjects(resp.data.values || [])
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   GET New NSR
   app.js → /api/sheet/new/nsr
========================= */
router.get("/new/nsr", async (req, res) => {
  try {
    const sheets = await getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords"
    });

    const rows = resp.data.values || [];
    const headers = rows[0] || [];
    const nsrIndex = headers.indexOf("NSR");

    let max = 0;
    rows.slice(1).forEach(r => {
      const n = parseInt((r[nsrIndex] || "").split("-")[1], 10);
      if (!isNaN(n) && n > max) max = n;
    });

    const d = new Date();
    const nsr =
      `NSR${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}-` +
      String(max + 1).padStart(5, "0");

    res.json({ success: true, next: nsr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   SAVE Nursing Record
   app.js → /api/sheet/NursingRecords/save
========================= */
router.post("/NursingRecords/save", async (req, res) => {
  try {
    const sheets = await getSheets();

    const meta = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords!1:1"
    });

    const headers = meta.data.values[0];
    const row = headers.map(h => req.body[h] || "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [row] }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   Upload Patients CSV
========================= */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const content = fs.readFileSync(req.file.path, "utf8");
    fs.unlinkSync(req.file.path);

    const rows = content
      .split(/\r?\n/)
      .filter(l => l.trim())
      .map(l => l.split(","));

    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Patients",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: rows }
    });

    res.json({ success: true, totalRows: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   EXPORT
========================= */
async function readSheet(sheetName) {
  const sheets = await getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName
  });
  return rowsToObjects(resp.data.values || []);
}

module.exports = { router, readSheet };
