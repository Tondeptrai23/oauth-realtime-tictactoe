const AuthMiddleware = require("../middleware/auth.middleware");

class ViewController {
    showRegister(req, res) {
        res.render("register");
    }

    showLogin(req, res) {
        res.render("login");
    }

    showDashboard(req, res) {
        res.render("dashboard");
    }

    showProfile(req, res) {
        res.render("profile");
    }

    showRegisterClient(req, res) {
        res.render("register-client");
    }
}

module.exports = new ViewController();
