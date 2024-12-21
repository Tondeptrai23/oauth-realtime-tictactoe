const crypto = require("crypto");
const db = require("../config/database");

class OAuthController {
    generateClientCredentials() {
        const clientId = crypto.randomBytes(24).toString("hex");
        const clientSecret = crypto.randomBytes(48).toString("hex");
        return { clientId, clientSecret };
    }

    async registerClient(req, res) {
        try {
            const { name, description, websiteUrl, redirectUri } = req.body;
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
}

module.exports = new OAuthController();
