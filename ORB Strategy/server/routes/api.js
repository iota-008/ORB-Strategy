var Method = require("../controllers/method");

const express = require("express");
const router = express.Router();

require("dotenv").config();

router.get("/login/:requestToken", Method.login);
router.get("/data/:accessToken", Method.getData);
module.exports = router;
