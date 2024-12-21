const express = require("express");
const router = express.Router();
const ViewController = require("../controllers/view.controller");

router.get("/register", ViewController.showRegister);
router.get("/login", ViewController.showLogin);
router.get("/", (req, res) => {
    res.redirect("/login");
});

module.exports = router;
