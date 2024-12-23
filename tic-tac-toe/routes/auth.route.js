const express = require("express");
const passport = require("passport");
const crypto = require("crypto");
const router = express.Router();

router.get("/auth/login", (req, res, next) => {
    req.session.regenerate((err) => {
        if (err) {
            console.error("Session regeneration error:", err);
            return next(err);
        }

        const state = crypto.randomBytes(16).toString("hex");
        req.session.oauthState = state;

        passport.authenticate("oauth2", {
            state: state,
            session: true,
        })(req, res, next);
    });
});

router.get("/auth/callback", (req, res, next) => {
    const receivedState = req.query.state;

    passport.authenticate("oauth2", { state: false }, (err, user, info) => {
        if (err) {
            console.error("Auth error:", err);
            return res.redirect("/login?error=auth_error");
        }

        if (!user) {
            const errorMessage = req.session.messages
                ? req.session.messages[0]
                : "Authentication failed";
            console.error("No user:", info);
            return res.redirect("/login?error=no_user");
        }

        if (req.session.oauthState !== receivedState) {
            console.error("State mismatch:", {
                session: req.session.oauthState,
                received: receivedState,
            });
            return res.redirect("/login?error=state_mismatch");
        }

        delete req.session.oauthState;

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error("Login error:", loginErr);
                return res.redirect("/login?error=login_error");
            }

            req.session.passport = {
                ...req.session.passport,
                user: user.id,
                oauth: {
                    accessToken: info.accessToken,
                    tokenScope: info.scope,
                },
            };

            res.redirect("/");
        });
    })(req, res, next);
});

router.get("/login", (req, res) => {
    res.render("login", {
        message: req.session.messages ? req.session.messages[0] : "",
    });
});

router.get("/auth/logout", (req, res, next) => {
    if (req.session.passport) {
        delete req.session.passport.oauth;
    }
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    });
});

module.exports = router;
