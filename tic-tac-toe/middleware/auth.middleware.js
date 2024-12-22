function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.session.passport?.oauth) {
            req.user.accessToken = req.session.passport.oauth.accessToken;
            req.user.scope = req.session.passport.oauth.tokenScope;
        } else {
            req.user.scope = ["profile:full"];
        }
        return next();
    }
    res.redirect("/login");
}

function isNotAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect("/");
}

module.exports = {
    isAuthenticated,
    isNotAuthenticated,
};
