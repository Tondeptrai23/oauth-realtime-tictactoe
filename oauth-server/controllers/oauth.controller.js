const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const OAuthModel = require("../models/oauth.model");
const UserModel = require("../models/user.model");

class OAuthController {
    generateClientCredentials() {
        const clientId = crypto.randomBytes(24).toString("hex");
        const clientSecret = crypto.randomBytes(48).toString("hex");
        return { clientId, clientSecret };
    }

    async registerClient(req, res) {
        try {
            const { name, websiteUrl, redirectUri, scopes } = req.body;
            const userId = req.user.id;

            if (!name || !redirectUri || !scopes || !scopes.length) {
                return res.status(400).json({
                    error: "Name, redirect URI, and at least one scope are required",
                });
            }

            const validScopes = ["profile:basic", "profile:full"];
            const invalidScopes = scopes.filter(
                (scope) => !validScopes.includes(scope)
            );
            if (invalidScopes.length > 0) {
                return res.status(400).json({
                    error: `Invalid scopes: ${invalidScopes.join(", ")}`,
                });
            }

            if (!scopes.includes("profile:basic")) {
                return res.status(400).json({
                    error: "profile:basic scope is required",
                });
            }

            const { clientId, clientSecret } = this.generateClientCredentials();

            const newClient = await OAuthModel.createClient(
                clientId,
                clientSecret,
                name,
                userId,
                websiteUrl,
                redirectUri,
                scopes
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
            const clients = await OAuthModel.getClientsByUserId(req.user.id);
            res.json({ clients });
        } catch (error) {
            console.error("Error fetching OAuth clients:", error);
            res.status(500).json({ error: "Failed to fetch OAuth clients" });
        }
    }

    async getClientById(req, res) {
        try {
            const client = await OAuthModel.getClientByClientId(
                req.params.clientId,
                req.user.id
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
            const { name, websiteUrl, redirectUri, scopes } = req.body;

            if (!name || !redirectUri) {
                return res.status(400).json({
                    error: "Name and redirect URI are required",
                });
            }

            if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
                return res.status(400).json({
                    error: "At least one scope is required",
                });
            }

            const validScopes = ["profile:basic", "profile:full"];
            const invalidScopes = scopes.filter(
                (scope) => !validScopes.includes(scope)
            );
            if (invalidScopes.length > 0) {
                return res.status(400).json({
                    error: `Invalid scopes: ${invalidScopes.join(", ")}`,
                });
            }

            if (!scopes.includes("profile:basic")) {
                return res.status(400).json({
                    error: "profile:basic scope is required",
                });
            }

            const updatedClient = await OAuthModel.updateClient(
                clientId,
                userId,
                name,
                websiteUrl,
                redirectUri,
                scopes
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

            const client = await OAuthModel.getClientForAuth(
                client_id,
                redirect_uri
            );

            if (!client) {
                return res.status(400).render("error", {
                    layout: "oauth",
                    message: "Invalid client or redirect URI",
                });
            }

            const requestedScopes = scope
                ? scope.split(" ")
                : ["profile:basic"];
            const isValidScope = await OAuthModel.validateRequestedScopes(
                client_id,
                requestedScopes
            );

            if (!isValidScope) {
                return res.status(400).render("error", {
                    layout: "oauth",
                    message: "Invalid or unauthorized scope requested",
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
        const user = await UserModel.getUserByUsername(username);
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

            const client = await OAuthModel.getClientForAuth(
                client_id,
                redirect_uri
            );

            if (!client) {
                return res.status(400).render("error", {
                    layout: "oauth",
                    message: "Invalid client or redirect URI",
                });
            }

            const user = await UserModel.getUserById(req.session.userId);
            const requestedScopes = scope
                ? scope.split(" ")
                : ["profile:basic"];

            const scopeDescriptions = {
                "profile:basic":
                    "Basic profile information (username, fullname)",
                "profile:full":
                    "Full profile access (including profile picture)",
            };

            res.render("authorize", {
                layout: "oauth",
                client,
                scopes: requestedScopes.map((scope) => ({
                    name: scope,
                    description: scopeDescriptions[scope],
                })),
                client_id,
                redirect_uri,
                state,
                user,
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

            await OAuthModel.createAuthorizationCode(
                code,
                client_id,
                req.session.userId,
                expiresAt,
                scope ? scope.split(",") : ["profile:full"]
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

            const client = await OAuthModel.validateClientCredentials(
                client_id,
                client_secret
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

            const authCode = await OAuthModel.getValidAuthorizationCode(
                code,
                client_id
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

            await OAuthModel.deleteAuthorizationCode(code);

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
