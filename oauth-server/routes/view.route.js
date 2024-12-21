const express = require("express");
const router = express.Router();
const ViewController = require("../controllers/view.controller");

router.get("/register", ViewController.showRegister);
router.get("/login", ViewController.showLogin);
router.get("/dashboard", ViewController.showDashboard);
router.get("/profile", ViewController.showProfile);
router.get("/register-client", ViewController.showRegisterClient);
router.get("/my-clients", ViewController.showClients);

module.exports = router;
