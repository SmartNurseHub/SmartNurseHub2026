/********************************************************************
 * routes/sheets.js — FINAL PRODUCTION
 ********************************************************************/
const express = require("express");
const { google } = require("googleapis");

const router = express.Router();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
if (!SPREADSHEET_ID) {
  throw new Error("❌ SPREADSHEET_ID not set");
}

/********************************************************************
 * GOOGLE AUTH (Service Account)
 ********************************************************************/
const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

/********************************************************************
 * HELPERS
 ********************************************************************/
function rowsToObjects(rows = []) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h || "").trim());
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

/********************************************************************
 * GET /api/sheet/:sheetName
 ********************************************************************/
router.get("/:sheetName", async (req, res) => {
  try {
    const { sheetName } = req.params;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName
    });

    res.json({
      success: true,
      data: rowsToObjects(resp.data.values || [])
    });
  } catch (err) {
    console.error("GET sheet error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/********************************************************************
 * GET /api/sheet/NursingRecords/:nsr
 ********************************************************************/
router.get("/NursingRecords/:nsr", async (req, res) => {
  try {
    const nsr = req.params.nsr;

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords"
    });

    const rows = resp.data.values || [];
    const headers = rows[0];
    const idx = headers.indexOf("NSR");
    if (idx === -1) throw new Error("NSR column not found");

    const row = rows.slice(1).find(r => r[idx] === nsr);
    if (!row) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ""));

    res.json({ success: true, data: obj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/********************************************************************
 * GET /api/sheet/new/nsr
 ********************************************************************/
router.get("/new/nsr", async (req, res) => {
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "NursingRecords!A:A"
    });

    const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
    const prefix = `NSR${yearMonth}-`;

    let max = 0;
    (resp.data.values || []).forEach(r => {
      if (r[0]?.startsWith(prefix)) {
        const n = parseInt(r[0].split("-")[1], 10);
        if (n > max) max = n;
      }
    });

    res.json({
      success: true,
      next: prefix + String(max + 1).padStart(5, "0")
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router };
