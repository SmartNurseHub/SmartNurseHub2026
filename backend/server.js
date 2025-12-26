/********************************************************************
 * server.js — FINAL PRODUCTION (Render + GitHub Pages)
 ********************************************************************/
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");

const { router: sheetsRouter } = require("./routes/sheets");

const app = express();
const PORT = process.env.PORT || 3000;

/********************************************************************
 * SECURITY + CORS
 ********************************************************************/
app.use(helmet());

app.use(cors({
  origin: [
    "https://smartnursehub.github.io",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

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
  res.json({
    status: "ok",
    service: "SmartNurseHub Backend",
    time: new Date().toISOString()
  });
});

/********************************************************************
 * API ROUTES
 ********************************************************************/
app.use("/api/sheet", sheetsRouter);

/********************************************************************
 * 404 HANDLER (สำคัญมาก)
 ********************************************************************/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found"
  });
});

/********************************************************************
 * ERROR HANDLER
 ********************************************************************/
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

/********************************************************************
 * START SERVER
 ********************************************************************/
app.listen(PORT, () => {
  console.log(`🚀 SmartNurseHub Backend running on port ${PORT}`);
});
