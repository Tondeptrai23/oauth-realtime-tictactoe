const User = require("../models/user");

class OnlineUsersManager {
    constructor(io) {
        this.io = io;
        this.onlineUsers = new Map();
    }

    initialize() {
        this.io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }

    async handleConnection(socket) {
        const userId = socket.request.session.passport?.user;
        if (!userId) {
            socket.disconnect();
            return;
        }

        try {
            const user = await User.findById(userId);

            this.onlineUsers.set(socket.id, {
                ...user,
                socketId: socket.id,
                status: "online",
                currentGame: null,
            });

            this.broadcastOnlineUsers();

            socket.on("disconnect", () => {
                this.handleDisconnect(socket.id);
            });

            socket.on("user:status", (status) => {
                this.updateUserStatus(socket.id, status);
            });

            socket.on("user:joinGame", (gameId) => {
                this.updateUserGame(socket.id, gameId);
            });

            socket.on("user:leaveGame", () => {
                this.updateUserGame(socket.id, null);
            });
        } catch (error) {
            console.error("Error handling socket connection:", error);
            socket.disconnect();
        }
    }

    handleDisconnect(socketId) {
        this.onlineUsers.delete(socketId);
        this.broadcastOnlineUsers();
    }

    updateUserStatus(socketId, status) {
        const user = this.onlineUsers.get(socketId);
        if (user) {
            user.status = status;
            this.onlineUsers.set(socketId, user);
            this.broadcastOnlineUsers();
        }
    }

    updateUserGame(socketId, gameId) {
        const user = this.onlineUsers.get(socketId);
        if (user) {
            user.currentGame = gameId;
            this.onlineUsers.set(socketId, user);
            this.broadcastOnlineUsers();
        }
    }

    broadcastOnlineUsers() {
        const usersList = Array.from(this.onlineUsers.values()).map((user) => ({
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
            rating: user.rating,
            status: user.status,
            currentGame: user.currentGame,
        }));

        this.io.emit("users:update", usersList);
    }

    getUserBySocketId(socketId) {
        return this.onlineUsers.get(socketId);
    }

    getOnlineUsers() {
        return Array.from(this.onlineUsers.values());
    }

    isUserOnline(userId) {
        return Array.from(this.onlineUsers.values()).some(
            (user) => user.id === userId
        );
    }
}

module.exports = { OnlineUsersManager };
