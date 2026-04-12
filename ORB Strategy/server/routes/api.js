var Method = require("../controllers/method");

const express = require("express");
const router = express.Router();

require("dotenv").config();

// Auth
router.post("/login", Method.login);

// Stream lifecycle
router.post("/stream/start", Method.startStream);
router.get("/stream/health", Method.streamHealth);
router.get("/market/status", Method.marketStatus);

// Algorithm management
router.get("/algos", Method.listAlgos);         // list all available algos
router.post("/algo", Method.setAlgo);           // switch active algo while stream runs

module.exports = router;
