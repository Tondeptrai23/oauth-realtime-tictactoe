const db = require("../config/database");

class LobbyMessageManager {
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
        socket.on("lobby:join", async (gameId) => {
            socket.join(`game:${gameId}`);
            console.log(`User joined game:${gameId} chat room`);
        });

        socket.on("lobby:message", async (data) => {
            await this.handleMessage(socket, data);
        });

        socket.on("lobby:request_messages", async () => {
            await this.sendMessageHistory(socket);
        });
    }

    async handleMessage(socket, data) {
        const userId = socket.request.session.passport?.user;
        if (!userId) return;

        const { gameId, message } = data;

        try {
            const result = await db.one(
                `INSERT INTO ttt_chat_messages 
                (user_id, game_id, message) 
                VALUES ($1, $2, $3) 
                RETURNING id, created_at`,
                [userId, gameId, message]
            );

            const user = await db.one(
                `SELECT id, username, nickname, avatar_url 
                FROM ttt_users WHERE id = $1`,
                [userId]
            );

            const messageData = {
                id: result.id,
                user_id: user.id,
                username: user.username,
                nickname: user.nickname,
                avatar_url: user.avatar_url,
                message: message,
                created_at: result.created_at,
            };

            this.io.to(`game:${gameId}`).emit("lobby:new_message", messageData);
        } catch (error) {
            console.error("Error handling lobby message:", error);
            socket.emit("lobby:error", "Failed to send message");
        }
    }

    async sendMessageHistory(socket) {
        const gameId = this.getGameIdFromSocket(socket);
        if (!gameId) return;

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
                WHERE cm.game_id = $1
                ORDER BY cm.created_at ASC
                LIMIT 50`,
                [gameId]
            );

            socket.emit("lobby:message_history", messages);
        } catch (error) {
            console.error("Error fetching lobby chat history:", error);
            socket.emit("lobby:error", "Failed to load chat history");
        }
    }

    getGameIdFromSocket(socket) {
        const roomsSet = socket.rooms;
        for (const room of roomsSet) {
            if (room.startsWith("game:")) {
                return room.split(":")[1];
            }
        }
        return null;
    }
}

module.exports = { LobbyMessageManager };
