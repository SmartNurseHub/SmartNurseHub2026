// ============================================================================
// routes/sheets.js (Full version with unified NSR function + logging)
// ============================================================================
//
// COMMENT TYPE A: อธิบายการทำงานของโค้ดแบบละเอียด
// COMMENT TYPE B: อธิบายความสัมพันธ์กับ view / HTML / API / Google Sheets
//
// ============================================================================

// ============================================================================
// SECTION 1 — IMPORT MODULES
// ============================================================================
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// ============================================================================
// SECTION 2 — ENVIRONMENT CONFIG
// ============================================================================
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
if (!SPREADSHEET_ID) console.error('Please set SPREADSHEET_ID in .env');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// ============================================================================
// SECTION 3 — GOOGLE SHEETS CLIENT (Singleton)
// ============================================================================
let sheetsClient = null;
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = await google.auth.getClient({ scopes: SCOPES });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// ============================================================================
// SECTION 4 — HELPER FUNCTIONS
// ============================================================================
function rowsToObjects(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map(h => String(h ?? '').trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] ?? '');
    return obj;
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function alignRowToHeaders(row, headersLen) {
  const r = Array.isArray(row) ? [...row] : [];
  while (r.length < headersLen) r.push('');
  return r.slice(0, headersLen);
}

function safeReadFileUtf8(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  return raw.replace(/^\uFEFF/, '');
}

// ============================================================================
// SECTION 5 — NSR UTILITY FUNCTION (Unified)
// ============================================================================
async function generateNextNSR(sheetName = 'NursingRecords') {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName
  });

  const rows = resp.data.values || [];
  if (!rows.length) return null;

  const header = rows[0].map(h => (h || '').trim());
  const nsrIndex = header.findIndex(h => h === 'NSR');
  if (nsrIndex === -1) throw new Error('NSR column not found');

  console.log(`📊 [NSR] Total rows in ${sheetName}:`, rows.length);
  console.log('🧾 [NSR] Logging all NSR values:');
  rows.slice(1).forEach((row, i) => console.log(i + 2, row[nsrIndex]));

  let maxSeq = 0;
  const today = new Date();
  const yyyy = today.getFullYear().toString();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yearlyPrefix = `NSR${yyyy}`;
  const displayPrefix = `NSR${yyyy}${mm}-`;

  rows.slice(1).forEach(row => {
    const nsr = (row[nsrIndex] || '').trim();
    if (!nsr) return;
    if (nsr.startsWith(yearlyPrefix)) {
      const seq = parseInt(nsr.split('-')[1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  return displayPrefix + String(maxSeq + 1).padStart(5, '0');
}

// ============================================================================
// SECTION 6 — ROUTES
// ============================================================================

// GET /api/sheet/new/nsr
router.get('/new/nsr', async (req, res) => {
  try {
    const nextNSR = await generateNextNSR('NursingRecords');
    res.json({ success: true, next: nextNSR });
  } catch (err) {
    console.error('[NSR] generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sheet/NursingRecords/save
router.post('/NursingRecords/save', async (req, res) => {
  try {
    const form = req.body || {};
    if (!isNonEmptyString(form.HN) && !isNonEmptyString(form.CID))
      return res.status(400).json({ success: false, error: 'Missing HN or CID' });

    const nextNSR = await generateNextNSR('NursingRecords');
    form.NSR = nextNSR;
    form.Stamp = new Date().toISOString();

    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'NursingRecords!1:1'
    });
    const headers = meta.data.values?.[0] || [];

    const newRow = headers.map(h => form[h] || '');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'NursingRecords',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [newRow] }
    });

    res.json({ success: true, nsr: nextNSR });

  } catch (err) {
    console.error('[NSR] save error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sheet/upload (Patients)
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('กรุณาเลือกไฟล์');
  const tmpPath = req.file.path;

  try {
    let content = safeReadFileUtf8(tmpPath);
    let delimiter = req.body?.delimiter || ',';
    if (!req.body?.delimiter) {
      const sample = content.split(/\r?\n/).find(l => l.trim() !== '');
      if (sample && sample.includes('|') &&
          sample.split('|').length > sample.split(',').length)
        delimiter = '|';
    }

    const newRows = content
      .split(/\r?\n/)
      .filter(l => l.trim() !== '')
      .map(l => l.split(delimiter).map(x => x.trim()));

    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Patients!1:1'
    });
    const headers = meta.data.values?.[0] || [];
    const alignedRows =
      headers.length ? newRows.map(r => alignRowToHeaders(r, headers.length))
                     : newRows;

    const exist = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Patients!A:B'
    });
    const existingRows = exist.data.values || [];
    const colBMap = new Map();
    existingRows.forEach((row, idx) => { if (row[1]) colBMap.set(row[1], idx + 1); });

    const updates = [];
    const inserts = [];

    alignedRows.forEach(r => {
      const key = r[1];
      if (key && colBMap.has(key)) updates.push({ rowIndex: colBMap.get(key), values: r });
      else inserts.push(r);
    });

    for (const u of updates) {
      const finalRow = alignRowToHeaders(u.values, headers.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Patients!A${u.rowIndex}`,
        valueInputOption: 'RAW',
        resource: { values: [finalRow] }
      });
    }

    if (inserts.length > 0) {
      const finalInsert = inserts.map(r => alignRowToHeaders(r, headers.length));
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Patients',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: finalInsert }
      });
    }

    res.status(200).json({
      success: true,
      totalRows: alignedRows.length,
      newRows: inserts.length,
      updatedRows: updates.length
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Upload failed');
  } finally {
    fs.unlink(tmpPath, () => {});
  }
});


// GET /api/sheet/NursingRecords/:nsr
router.get('/NursingRecords/:nsr', async (req, res) => {
  try {
    const { nsr } = req.params;

    const sheets = await getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'NursingRecords'
    });

    const rows = resp.data.values || [];
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Sheet empty' });
    }

    const headers = rows[0].map(h => String(h || '').trim());
    const nsrIndex = headers.indexOf('NSR');
    if (nsrIndex === -1) {
      return res.status(500).json({ success: false, error: 'NSR column not found' });
    }

    const row = rows.slice(1).find(r => (r[nsrIndex] || '').trim() === nsr);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const record = {};
    headers.forEach((h, i) => record[h] = row[i] ?? '');

    res.json({ success: true, data: record });

  } catch (err) {
    console.error('Get NursingRecord by NSR error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET /api/sheet/:sheetName
router.get('/:sheetName([A-Za-z0-9_]+)', async (req, res) => {
  try {
    const sheetName = req.params.sheetName;
    const sheets = await getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName
    });
    res.json({ success: true, data: rowsToObjects(resp.data.values || []) });
  } catch (err) {
    console.error('Error fetching sheet:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// SECTION 7 — EXPORTS
// ============================================================================
async function readSheet(sheetName) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName
  });
  return rowsToObjects(resp.data.values || []);
}

module.exports = { router, readSheet };
