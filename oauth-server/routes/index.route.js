const express = require("express");
const router = express.Router();
const viewRoute = require("./view.route");

router.use("/", viewRoute);

module.exports = router;
