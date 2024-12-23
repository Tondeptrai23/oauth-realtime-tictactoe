const db = require("../config/database");

class OAuthModel {
    async createClient(
        clientId,
        clientSecret,
        name,
        userId,
        websiteUrl,
        redirectUri,
        scopes
    ) {
        return db.one(
            `INSERT INTO ${db.tables.clients}
            (client_id, client_secret, name, user_id, website_url, redirect_uri, allowed_scopes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, client_id, client_secret, name, website_url, redirect_uri, allowed_scopes`,
            [
                clientId,
                clientSecret,
                name,
                userId,
                websiteUrl,
                redirectUri,
                scopes,
            ]
        );
    }

    async getClientsByUserId(userId) {
        return db.any(
            `SELECT id, client_id, name, website_url, redirect_uri, client_secret, allowed_scopes
            FROM ${db.tables.clients}
            WHERE user_id = $1`,
            [userId]
        );
    }

    async getClientByClientId(clientId, userId) {
        return db.oneOrNone(
            `SELECT id, client_id, name, website_url, redirect_uri, client_secret, allowed_scopes
            FROM ${db.tables.clients}
            WHERE client_id = $1 AND user_id = $2`,
            [clientId, userId]
        );
    }

    async updateClient(
        clientId,
        userId,
        name,
        websiteUrl,
        redirectUri,
        scopes
    ) {
        return db.one(
            `UPDATE ${db.tables.clients}
            SET name = $1, website_url = $2, redirect_uri = $3, allowed_scopes = $4
            WHERE client_id = $5 AND user_id = $6
            RETURNING id, client_id, name, website_url, redirect_uri, allowed_scopes`,
            [name, websiteUrl, redirectUri, scopes, clientId, userId]
        );
    }

    async getClientForAuth(clientId, redirectUri) {
        return db.oneOrNone(
            `SELECT name, website_url, allowed_scopes FROM ${db.tables.clients} 
            WHERE client_id = $1 AND redirect_uri = $2`,
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
            `SELECT id, allowed_scopes FROM ${db.tables.clients} 
            WHERE client_id = $1 AND client_secret = $2`,
            [clientId, clientSecret]
        );
    }

    async validateRequestedScopes(clientId, requestedScopes) {
        const client = await db.oneOrNone(
            `SELECT allowed_scopes FROM ${db.tables.clients} WHERE client_id = $1`,
            [clientId]
        );

        if (!client) return false;

        const allowedScopes = new Set(client.allowed_scopes);
        return requestedScopes.every((scope) => allowedScopes.has(scope));
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
