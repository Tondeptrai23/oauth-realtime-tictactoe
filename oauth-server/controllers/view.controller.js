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
}

module.exports = new ViewController();
