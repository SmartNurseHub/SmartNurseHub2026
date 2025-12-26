/********************************************************************
 * server.js — SmartNurseHub2026 (Render Production)
 ********************************************************************/
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");

const { router: sheetsRouter, readSheet } = require("./routes/sheets");

const PORT = process.env.PORT || 3000;
const app = express();

/* =========================
   CORS — GitHub Pages OK
========================= */
app.use(cors({
  origin: [
    "https://smartnursehub.github.io",
    "http://localhost:3000"
  ]
}));

/* =========================
   Security / Logging
========================= */
app.use(helmet());
app.use(morgan("combined"));

/* =========================
   Body Parser
========================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   Health Check
========================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SmartNurseHub Backend" });
});

/* =========================
   API Routes
========================= */
app.use("/api/sheet", sheetsRouter);

/* =========================
   SEARCH Patients (used in app.js)
========================= */
app.get("/api/patients", async (req, res) => {
  try {
    const q = (req.query.search || "").toLowerCase();
    if (!q) return res.json({ success: true, data: [] });

    const data = await readSheet("Patients");
    const result = data.filter(p =>
      `${p.NAME || ""}${p.LNAME || ""}${p.HN || ""}${p.CID || ""}`
        .toLowerCase()
        .includes(q)
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   Error Handler
========================= */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

/* =========================
   Start Server
========================= */
app.listen(PORT, () => {
  console.log(`🚀 SmartNurseHub Backend running on port ${PORT}`);
});
