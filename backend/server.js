/********************************************************************
 * SERVER.JS — PRODUCTION FINAL (SmartNurseHub2026)
 ********************************************************************/
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");

const { router: sheetsRouter, readSheet } = require("./routes/sheets");

/********************************************************************
 * INIT
 ********************************************************************/
const app = express();
const PORT = process.env.PORT || 3000;

/********************************************************************
 * CORS — สำคัญมาก (ต้องอยู่บนสุด)
 ********************************************************************/
app.use(cors({
  origin: [
    "https://smartnursehub.github.io",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/********************************************************************
 * SECURITY & LOGGING
 ********************************************************************/
app.use(helmet());
app.use(morgan("combined"));

/********************************************************************
 * BODY PARSER
 ********************************************************************/
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/********************************************************************
 * HEALTH CHECK
 ********************************************************************/
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SmartNurseHub Backend" });
});

/********************************************************************
 * ROUTES
 ********************************************************************/
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
 * 404 HANDLER (API เท่านั้น)
 ********************************************************************/
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API Not Found" });
});

/********************************************************************
 * START SERVER
 ********************************************************************/
app.listen(PORT, () => {
  console.log(`🚀 SmartNurseHub Backend running on port ${PORT}`);
});
