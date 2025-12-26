/********************************************************************
 * SERVER.JS — PRODUCTION FINAL (SmartNurseHub2026)
 ********************************************************************/
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");

const { router: sheetsRouter, readSheet } = require("./routes/sheets");

/********************************************************************
 * CONFIG
 ********************************************************************/
const PORT = process.env.PORT || 3000;
const app = express();

/********************************************************************
 * SECURITY & LOGGING
 ********************************************************************/
app.use(helmet());
app.use(morgan("combined"));
app.use(cors({ origin: "*" })); // GitHub Pages ใช้ได้ทันที

/********************************************************************
 * BODY PARSER
 ********************************************************************/
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/********************************************************************
 * UPLOAD CONFIG
 ********************************************************************/
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});

/********************************************************************
 * ROUTES
 ********************************************************************/
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SmartNurseHub Backend" });
});

app.use("/api/sheet", sheetsRouter);

/********************************************************************
 * API: SEARCH PATIENTS
 ********************************************************************/
app.get("/api/patients", async (req, res) => {
  try {
    const q = (req.query.search || "").trim().toLowerCase();
    if (!q) return res.json({ success: true, data: [] });

    const data = await readSheet("Patients");
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
  console.log(`🚀 SmartNurseHub Backend running on port ${PORT}`);
});
