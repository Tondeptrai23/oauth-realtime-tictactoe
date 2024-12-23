const db = require("../config/database");

class HomeChatManager {
    constructor(io, onlineUsersManager) {
        this.io = io;
        this.onlineUsersManager = onlineUsersManager;
    }

    initialize() {
        this.io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }

    handleConnection(socket) {
        setTimeout(async () => {
            if (socket.connected) {
                await this.sendChatHistory(socket);
            }
        }, 100);

        socket.on("chat:message", async (message) => {
            await this.handleChatMessage(socket, message);
        });

        socket.on("chat:history", async () => {
            await this.sendChatHistory(socket);
        });
    }

    async handleChatMessage(socket, message) {
        const user = this.onlineUsersManager.getUserBySocketId(socket.id);
        if (!user) return;

        try {
            const result = await db.one(
                `INSERT INTO ttt_chat_messages 
                (user_id, message) 
                VALUES ($1, $2) 
                RETURNING id, created_at`,
                [user.id, message]
            );

            this.io.emit("chat:message", {
                id: result.id,
                user_id: user.id,
                username: user.username,
                nickname: user.nickname,
                avatar_url: user.avatar_url,
                message: message,
                created_at: result.created_at,
            });
        } catch (error) {
            console.error("Error handling chat message:", error);
            socket.emit("chat:error", "Failed to send message");
        }
    }

    async sendChatHistory(socket) {
        try {
            const messages = await db.manyOrNone(
                `SELECT 
                    cm.id,
                    cm.message,
                    cm.created_at,
                    u.id as user_id,
                    u.username,
                    u.nickname,
                    u.avatar_url
                FROM ttt_chat_messages cm
                JOIN ttt_users u ON cm.user_id = u.id
                WHERE cm.game_id IS NULL
                ORDER BY cm.created_at ASC
                LIMIT 50
                FOR UPDATE`
            );

            socket.emit("chat:history", messages);
        } catch (error) {
            console.error("Error fetching chat history:", error);
            socket.emit("chat:error", "Failed to load chat history");
        }
    }
}

module.exports = { HomeChatManager };
