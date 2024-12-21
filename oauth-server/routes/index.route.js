const express = require("express");
const router = express.Router();
const viewRoute = require("./view.route");
const authRoute = require("./auth.route");

router.use("/", viewRoute);
router.use("/api/auth", authRoute);

router.get("/", (req, res) => {
    res.redirect("/login");
});
module.exports = router;
