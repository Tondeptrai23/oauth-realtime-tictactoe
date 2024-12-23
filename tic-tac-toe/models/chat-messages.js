const db = require("../config/database");

class ChatMessages {
    static async create(userId, message, gameId = null) {
        return await db.one(
            `INSERT INTO ${db.tables.chat_messages}
            (user_id, game_id, message) 
            VALUES ($1, $2, $3) 
            RETURNING id, created_at`,
            [userId, gameId, message]
        );
    }

    static async getHomeMessages() {
        return await db.manyOrNone(
            `SELECT 
                cm.id,
                cm.message,
                cm.created_at,
                u.id as user_id,
                u.username,
                u.nickname,
                u.avatar_url
            FROM ${db.tables.chat_messages} cm
            JOIN ${db.tables.users} u ON cm.user_id = u.id
            WHERE cm.game_id IS NULL
            ORDER BY cm.created_at ASC
            LIMIT 50
            FOR UPDATE`
        );
    }

    static async getGameMessages(gameId) {
        return await db.manyOrNone(
            `SELECT 
                cm.id,
                cm.message,
                cm.created_at,
                u.id as user_id,
                u.username,
                u.nickname,
                u.avatar_url
            FROM ${db.tables.chat_messages} cm
            JOIN ${db.tables.users} u ON cm.user_id = u.id
            WHERE cm.game_id = $1
            ORDER BY cm.created_at ASC
            LIMIT 50`,
            [gameId]
        );
    }

    static async getUserInfo(userId) {
        return await db.one(
            `SELECT id, username, nickname, avatar_url 
            FROM ${db.tables.users} WHERE id = $1`,
            [userId]
        );
    }
}

module.exports = ChatMessages;
