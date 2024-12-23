const Game = require("../models/game");

class GamesManager {
    constructor(io, onlineUsersManager) {
        this.io = io;
        this.onlineUsersManager = onlineUsersManager;
    }

    initialize() {
        this.io.on("connection", (socket) => {
            this.sendActiveGames(socket);

            socket.on("games:request", () => {
                this.sendActiveGames(socket);
            });

            socket.on("game:deleted", () => {
                this.broadcastGamesList();
            });
        });

        this.io.on("games:refresh", () => {
            this.broadcastGamesList();
        });
    }

    async sendActiveGames(socket) {
        try {
            const games = await Game.getActiveGames();
            socket.emit("games:list", games);
        } catch (error) {
            console.error("Error fetching games:", error);
            socket.emit("games:error", "Failed to fetch games list");
        }
    }

    async broadcastGamesList() {
        try {
            const games = await Game.getActiveGames();
            this.io.emit("games:list", games);
        } catch (error) {
            console.error("Error broadcasting games:", error);
            this.io.emit("games:error", "Failed to update games list");
        }
    }
}

module.exports = { GamesManager };
