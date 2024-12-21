const express = require("express");
const router = express.Router();
const OAuthController = require("../controllers/oauth.controller");
const crypto = require("crypto");

router.get("/authorize", async (req, res, next) => {
    const { client_id, redirect_uri, scope, response_type } = req.query;

    const state = req.query.state || crypto.randomBytes(16).toString("hex");

    req.session.authRequest = {
        client_id,
        redirect_uri,
        scope,
        state,
        response_type,
    };

    req.session.save((err) => {
        if (err) {
            console.error("Session save error:", err);
            return next(err);
        }
        OAuthController.initializeAuthorizationRequest(req, res);
    });
});

router.get("/login", (req, res) => {
    const authRequest = req.session.authRequest || {};
    res.render("oauth-login", {
        layout: "oauth",
        authRequest,
    });
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await OAuthController.authenticateUser(username, password);

        if (user) {
            req.session.userId = user.id;
            const authRequest = req.session.authRequest || {};
            const queryString = new URLSearchParams(authRequest).toString();

            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return next(err);
                }
                res.redirect(`/oauth/authorize?${queryString}`);
            });
        } else {
            res.render("oauth-login", {
                layout: "oauth",
                error: "Invalid credentials",
                authRequest: req.session.authRequest || {},
            });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.render("oauth-login", {
            layout: "oauth",
            error: "An error occurred during login",
            authRequest: req.session.authRequest || {},
        });
    }
});

router.get(
    "/consent",
    async (req, res, next) => {
        if (!req.session.userId) {
            return res.redirect(
                "/oauth/login?" + new URLSearchParams(req.query).toString()
            );
        }

        const storedRequest = req.session.authRequest || {};
        if (req.query.state !== storedRequest.state) {
            return res.status(400).render("error", {
                layout: "oauth",
                message: "Invalid state parameter",
            });
        }

        next();
    },
    OAuthController.showAuthorizationForm.bind(OAuthController)
);

router.post(
    "/authorize",
    async (req, res, next) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const storedRequest = req.session.authRequest || {};
        if (req.query.state !== storedRequest.state) {
            return res.status(400).json({ error: "Invalid state parameter" });
        }

        next();
    },
    OAuthController.handleAuthorization.bind(OAuthController)
);

router.post("/token", OAuthController.generateToken.bind(OAuthController));

module.exports = router;
