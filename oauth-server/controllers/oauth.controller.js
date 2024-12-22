const crypto = require("crypto");
const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

class OAuthController {
    generateClientCredentials() {
        const clientId = crypto.randomBytes(24).toString("hex");
        const clientSecret = crypto.randomBytes(48).toString("hex");
        return { clientId, clientSecret };
    }

    async registerClient(req, res) {
        try {
            const { name, websiteUrl, redirectUri } = req.body;
            const userId = req.user.id;

            if (!name || !redirectUri) {
                return res.status(400).json({
                    error: "Name and redirect URI are required",
                });
            }

            const { clientId, clientSecret } = this.generateClientCredentials();

            const newClient = await db.one(
                `INSERT INTO oauth_clients 
                (client_id, client_secret, name, user_id, website_url, redirect_uri)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, client_id, client_secret, name, website_url, redirect_uri`,
                [clientId, clientSecret, name, userId, websiteUrl, redirectUri]
            );

            res.status(201).json({
                message: "OAuth client registered successfully",
                client: {
                    ...newClient,
                    clientSecret,
                },
            });
        } catch (error) {
            console.error("OAuth client registration error:", error);
            res.status(500).json({ error: "Failed to register OAuth client" });
        }
    }

    async getClientsByUser(req, res) {
        try {
            const userId = req.user.id;

            const clients = await db.any(
                `SELECT id, client_id, name, website_url, redirect_uri, client_secret
                FROM oauth_clients 
                WHERE user_id = $1`,
                [userId]
            );

            res.json({ clients });
        } catch (error) {
            console.error("Error fetching OAuth clients:", error);
            res.status(500).json({ error: "Failed to fetch OAuth clients" });
        }
    }

    async getClientById(req, res) {
        try {
            const { clientId } = req.params;
            const userId = req.user.id;

            const client = await db.oneOrNone(
                `SELECT id, client_id, name, website_url, redirect_uri, client_secret
                FROM oauth_clients 
                WHERE client_id = $1 AND user_id = $2`,
                [clientId, userId]
            );

            if (!client) {
                return res
                    .status(404)
                    .json({ error: "OAuth client not found" });
            }

            res.json({ client });
        } catch (error) {
            console.error("Error fetching OAuth client:", error);
            res.status(500).json({ error: "Failed to fetch OAuth client" });
        }
    }

    async updateClient(req, res) {
        try {
            const { clientId } = req.params;
            const userId = req.user.id;
            const { name, websiteUrl, redirectUri } = req.body;

            const existingClient = await db.oneOrNone(
                "SELECT id FROM oauth_clients WHERE client_id = $1 AND user_id = $2",
                [clientId, userId]
            );

            if (!existingClient) {
                return res
                    .status(404)
                    .json({ error: "OAuth client not found" });
            }

            const updatedClient = await db.one(
                `UPDATE oauth_clients 
                SET name = $1, website_url = $2, redirect_uri = $3
                WHERE client_id = $4
                RETURNING id, client_id, name, website_url, redirect_uri`,
                [name, websiteUrl, redirectUri, clientId]
            );

            res.json({ client: updatedClient });
        } catch (error) {
            console.error("Error updating OAuth client:", error);
            res.status(500).json({ error: "Failed to update OAuth client" });
        }
    }

    async initializeAuthorizationRequest(req, res) {
        try {
            const { client_id, redirect_uri, scope, state, response_type } =
                req.query;

            if (!client_id || !redirect_uri || response_type !== "code") {
                return res.status(400).render("error", {
                    layout: "oauth",
                    message: "Invalid request parameters",
                });
            }

            const client = await db.oneOrNone(
                "SELECT name, website_url FROM oauth_clients WHERE client_id = $1 AND redirect_uri = $2",
                [client_id, redirect_uri]
            );

            if (!client) {
                return res.status(400).render("error", {
                    layout: "oauth",
                    message: "Invalid client or redirect URI",
                });
            }

            if (!req.session.userId) {
                return res.redirect(
                    "/oauth/login?" + new URLSearchParams(req.query).toString()
                );
            }

            res.redirect(
                "/oauth/consent?" + new URLSearchParams(req.query).toString()
            );
        } catch (error) {
            console.error("Authorization request error:", error);
            res.status(500).render("error", {
                layout: "oauth",
                message: "Server error while processing request",
            });
        }
    }

    async authenticateUser(username, password) {
        const user = await db.oneOrNone(
            "SELECT id, password_hash FROM users WHERE username = $1",
            [username]
        );

        if (!user) return null;

        const validPassword = await bcrypt.compare(
            password,
            user.password_hash
        );
        if (!validPassword) return null;

        return user;
    }

    async showAuthorizationForm(req, res) {
        try {
            const { client_id, redirect_uri, scope, state } = req.query;

            const client = await db.oneOrNone(
                "SELECT name, website_url FROM oauth_clients WHERE client_id = $1 AND redirect_uri = $2",
                [client_id, redirect_uri]
            );

            if (!client) {
                return res.status(400).render("error", {
                    layout: "oauth",
                    message: "Invalid client or redirect URI",
                });
            }

            const requestedScopes = scope ? scope.split(" ") : ["profile:full"];

            res.render("authorize", {
                layout: "oauth",
                client,
                scope: requestedScopes,
                client_id,
                redirect_uri,
                state,
            });
        } catch (error) {
            console.error("Consent page error:", error);
            res.status(500).render("error", {
                layout: "oauth",
                message: "Server error while processing request",
            });
        }
    }

    async handleAuthorization(req, res) {
        try {
            const { client_id, redirect_uri, scope, state } = req.query;
            const { approve } = req.body;

            if (!approve) {
                res.setHeader(
                    "Location",
                    `${redirect_uri}?error=access_denied&state=${state}`
                );
                return res.status(302).end();
            }

            const code = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            const userId = req.session.userId;

            await db.none(
                `INSERT INTO authorization_codes 
                (code, client_id, user_id, expires_at, scope) 
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    code,
                    client_id,
                    userId,
                    expiresAt,
                    scope ? scope.split(",") : ["profile:full"],
                ]
            );

            const redirectUrl = new URL(redirect_uri);
            redirectUrl.searchParams.set("code", code);
            if (state) {
                redirectUrl.searchParams.set("state", state);
            }

            res.setHeader("Location", redirectUrl.toString());
            return res.status(302).end();
        } catch (error) {
            console.error("Authorization handling error:", error);
            res.status(500).render("error", {
                message: "Server error while processing authorization",
            });
        }
    }

    async generateToken(req, res) {
        try {
            const { grant_type, code, client_id, client_secret } = req.body;

            const client = await db.oneOrNone(
                "SELECT id FROM oauth_clients WHERE client_id = $1 AND client_secret = $2",
                [client_id, client_secret]
            );

            if (!client) {
                return res
                    .status(401)
                    .json({ error: "Invalid client credentials" });
            }

            if (grant_type !== "authorization_code") {
                return res
                    .status(400)
                    .json({ error: "Unsupported grant type" });
            }

            const authCode = await db.oneOrNone(
                `SELECT user_id, scope FROM authorization_codes 
                WHERE code = $1 AND client_id = $2 AND expires_at > NOW()`,
                [code, client_id]
            );

            if (!authCode) {
                return res
                    .status(400)
                    .json({ error: "Invalid or expired authorization code" });
            }

            const scope = authCode.scope || ["profile:full"];

            const accessToken = jwt.sign(
                {
                    user_id: authCode.user_id,
                    client_id,
                    scope: scope,
                },
                process.env.OAUTH_JWT_SECRET,
                { expiresIn: "1h" }
            );

            await db.none("DELETE FROM authorization_codes WHERE code = $1", [
                code,
            ]);

            res.json({
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: 3600,
                scope: Array.isArray(scope) ? scope.join(" ") : scope,
            });
        } catch (error) {
            console.error("Token generation error:", error);
            res.status(500).json({
                error: "Server error while generating token",
            });
        }
    }
}

module.exports = new OAuthController();
