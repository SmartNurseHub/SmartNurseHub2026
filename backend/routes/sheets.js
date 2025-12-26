/********************************************************************
 * routes/sheets.js — PRODUCTION FINAL
 ********************************************************************/
const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/********************************************************************
 * ENV
 ********************************************************************/
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/********************************************************************
 * GOOGLE CLIENT (Singleton)
 ********************************************************************/
let sheetsClient = null;
async function getSheets() {
  if (sheetsClient) return sheetsClient;

  const auth = await google.auth.getClient({ scopes: SCOPES });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/********************************************************************
 * UTIL
 ********************************************************************/
function rowsToObjects(rows = []) {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
    return obj;
  });
}

/********************************************************************
 * NSR GENERATOR
 ********************************************************************/
async function generateNextNSR() {
  const sheets = await getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "NursingRecords"
  });

  const rows = resp.data.values || [];
  const headers = rows[0];
  const idx = headers.indexOf("NSR");

  let max = 0;
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, "0");

  rows.slice(1).forEach(r => {
    const v = r[idx];
    if (v?.startsWith(`NSR${y}`)) {
      const n = parseInt(v.split("-")[1], 10);
      if (n > max) max = n;
    }
  });

  return `NSR${y}${m}-${String(max + 1).padStart(5, "0")}`;
}

/********************************************************************
 * ROUTES
 ********************************************************************/

// GET /api/sheet/:sheetName
router.get("/:sheet", async (req, res) => {
  try {
    const sheets = await getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: req.params.sheet
    });
    res.json({ success: true, data: rowsToObjects(resp.data.values) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sheet/new/nsr
router.get("/new/nsr", async (req, res) => {
  try {
    const next = await generateNextNSR();
    res.json({ success: true, next });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// POST /api/sheet/NursingRecords/save
router.post("/NursingRecords/save", async (req, res) => {
  try {
    const data = req.body;
    data.NSR = await generateNextNSR();
    data.Stamp = new Date().toISOString();

    const sheets = await getSheets();
    const meta = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords!1:1"
    });

    const headers = meta.data.values[0];
    const row = headers.map(h => data[h] || "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [row] }
    });

    res.json({ success: true, nsr: data.NSR });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/********************************************************************
 * EXPORT
 ********************************************************************/
async function readSheet(sheetName) {
  const sheets = await getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName
  });
  return rowsToObjects(resp.data.values);
}

module.exports = { router, readSheet };
