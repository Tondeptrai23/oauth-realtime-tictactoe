const express = require("express");
const router = express.Router();
const viewRoute = require("./view.route");
const authRoute = require("./auth.route");
const profileRoute = require("./profile.route");
const clientRoute = require("./client.route");
const oauthRoute = require("./oauth.route");

router.use("/", viewRoute);
router.use("/oauth", oauthRoute);
router.use("/api/auth", authRoute);
router.use("/api/profile", profileRoute);
router.use("/api/oauth", clientRoute);

router.get("/", (req, res) => {
    res.redirect("/login");
});
module.exports = router;
