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

    showClients(req, res) {
        res.render("my-clients");
    }
}

module.exports = new ViewController();
