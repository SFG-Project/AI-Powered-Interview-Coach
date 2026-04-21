require("dotenv").config();

const cors = require("cors");
const express = require("express");
const { initializeFirebaseAdmin } = require("./config/firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

initializeFirebaseAdmin();

app.get("/api/health", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

