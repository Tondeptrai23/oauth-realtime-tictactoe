const db = require("../config/database");

class OAuthModel {
    async createClient(
        clientId,
        clientSecret,
        name,
        userId,
        websiteUrl,
        redirectUri
    ) {
        return db.one(
            `INSERT INTO ${db.tables.clients}
            (client_id, client_secret, name, user_id, website_url, redirect_uri)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, client_id, client_secret, name, website_url, redirect_uri`,
            [clientId, clientSecret, name, userId, websiteUrl, redirectUri]
        );
    }

    async getClientsByUserId(userId) {
        return db.any(
            `SELECT id, client_id, name, website_url, redirect_uri, client_secret
            FROM ${db.tables.clients}
            WHERE user_id = $1`,
            [userId]
        );
    }

    async getClientByClientId(clientId, userId) {
        return db.oneOrNone(
            `SELECT id, client_id, name, website_url, redirect_uri, client_secret
            FROM ${db.tables.clients}
            WHERE client_id = $1 AND user_id = $2`,
            [clientId, userId]
        );
    }

    async updateClient(clientId, userId, name, websiteUrl, redirectUri) {
        return db.one(
            `UPDATE ${db.tables.clients}
            SET name = $1, website_url = $2, redirect_uri = $3
            WHERE client_id = $4 AND user_id = $5
            RETURNING id, client_id, name, website_url, redirect_uri`,
            [name, websiteUrl, redirectUri, clientId, userId]
        );
    }

    async getClientForAuth(clientId, redirectUri) {
        return db.oneOrNone(
            `SELECT name, website_url FROM ${db.tables.clients} WHERE client_id = $1 AND redirect_uri = $2`,
            [clientId, redirectUri]
        );
    }

    async createAuthorizationCode(code, clientId, userId, expiresAt, scope) {
        return db.none(
            `INSERT INTO ${db.tables.codes}
            (code, client_id, user_id, expires_at, scope) 
            VALUES ($1, $2, $3, $4, $5)`,
            [code, clientId, userId, expiresAt, scope]
        );
    }

    async validateClientCredentials(clientId, clientSecret) {
        return db.oneOrNone(
            `SELECT id FROM ${db.tables.clients} WHERE client_id = $1 AND client_secret = $2`,
            [clientId, clientSecret]
        );
    }

    async getValidAuthorizationCode(code, clientId) {
        return db.oneOrNone(
            `SELECT user_id, scope FROM ${db.tables.codes}
            WHERE code = $1 AND client_id = $2 AND expires_at > NOW()`,
            [code, clientId]
        );
    }

    async deleteAuthorizationCode(code) {
        return db.none(`DELETE FROM ${db.tables.codes} WHERE code = $1`, [
            code,
        ]);
    }
}

module.exports = new OAuthModel();
