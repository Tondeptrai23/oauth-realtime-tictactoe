const ChatMessages = require("../models/chat-messages");

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
            const result = await ChatMessages.create(userId, message, gameId);
            const user = await ChatMessages.getUserInfo(userId);

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
            const messages = await ChatMessages.getGameMessages(gameId);
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
