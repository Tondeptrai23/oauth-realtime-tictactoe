const db = require("../config/database");

class GameLobbyManager {
    constructor(io, onlineUsersManager) {
        this.io = io;
        this.onlineUsersManager = onlineUsersManager;
        this.gameRooms = new Map();
    }

    initialize() {
        this.io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }

    async deleteGame(gameId) {
        try {
            const room = this.io.sockets.adapter.rooms.get(`game:${gameId}`);
            if (room) {
                this.io.to(`game:${gameId}`).emit("lobby:game_deleted");
            }

            await db.none("DELETE FROM ttt_games WHERE id = $1", [gameId]);

            this.gameRooms.delete(gameId);
        } catch (error) {
            console.error("Error deleting game:", error);
            throw error;
        }
    }

    async handleConnection(socket) {
        const userId = socket.request.session.passport?.user;
        if (!userId) {
            socket.disconnect();
            return;
        }

        socket.on("lobby:join", async (gameId) => {
            await this.handleLobbyJoin(socket, gameId);
        });

        socket.on("lobby:join_request", async (gameId) => {
            await this.handleJoinRequest(socket, gameId);
        });

        socket.on("lobby:approve_join", async (data) => {
            await this.handleApproveJoin(socket, data);
        });

        socket.on("lobby:reject_join", async (data) => {
            await this.handleRejectJoin(socket, data);
        });

        socket.on("lobby:force_join_request", async (gameId) => {
            await this.handleForceJoinRequest(socket, gameId);
        });

        socket.on("lobby:host_leave", async (gameId) => {
            await this.handleHostLeave(socket, gameId);
        });

        socket.on("lobby:guest_leave", async (gameId) => {
            await this.handleGuestLeave(socket, gameId);
        });

        socket.on("game:start", async (gameId) => {
            await this.handleGameStart(socket, gameId);
        });

        socket.on("disconnect", () => {
            this.handleDisconnect(socket);
        });
    }

    async handleGameStart(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const game = await db.oneOrNone(
                "SELECT * FROM ttt_games WHERE id = $1 AND host_id = $2 AND status = 'waiting'",
                [gameId, userId]
            );

            if (!game) {
                socket.emit(
                    "lobby:error",
                    "Unauthorized action or invalid game state"
                );
                return;
            }

            if (!game.guest_id) {
                socket.emit(
                    "lobby:error",
                    "Cannot start game without second player"
                );
                return;
            }

            await db.none(
                "UPDATE ttt_games SET status = 'in_progress', current_turn = $1, last_move_time = CURRENT_TIMESTAMP WHERE id = $2",
                [game.host_id, gameId]
            );

            this.io.to(`game:${gameId}`).emit("game:started");
        } catch (error) {
            console.error("Error starting game:", error);
            socket.emit("lobby:error", "Failed to start game");
        }
    }

    async handleForceJoinRequest(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const activeGame = await db.oneOrNone(
                `SELECT id FROM ttt_games 
                 WHERE (host_id = $1 OR guest_id = $1) 
                 AND status IN ('waiting', 'in_progress', 'ready')`,
                [userId]
            );

            if (activeGame) {
                await this.deleteGame(activeGame.id);
            }

            await this.handleJoinRequest(socket, gameId);
        } catch (error) {
            console.error("Error handling force join:", error);
            socket.emit("lobby:error", "Failed to join game");
        }
    }

    async handleLobbyJoin(socket, gameId) {
        try {
            const game = await db.one(
                `SELECT g.*, 
                    host.username as host_username, 
                    host.avatar_url as host_avatar_url,
                    guest.username as guest_username,
                    guest.avatar_url as guest_avatar_url
                FROM ttt_games g
                JOIN ttt_users host ON g.host_id = host.id
                LEFT JOIN ttt_users guest ON g.guest_id = guest.id
                WHERE g.id = $1`,
                [gameId]
            );

            socket.gameId = gameId;
            socket.join(`game:${gameId}`);

            if (!this.gameRooms.has(gameId)) {
                this.gameRooms.set(gameId, new Set());
            }
            this.gameRooms.get(gameId).add(socket.id);

            this.broadcastLobbyState(gameId);
        } catch (error) {
            console.error("Error joining lobby:", error);
            socket.emit("lobby:error", "Failed to join game lobby");
        }
    }

    async handleJoinRequest(socket, gameId) {
        const userId = socket.request.session.passport.user;

        const activeGame = await db.oneOrNone(
            `SELECT id FROM ttt_games 
             WHERE (host_id = $1 OR guest_id = $1) 
             AND status IN ('waiting', 'in_progress', 'ready')`,
            [userId]
        );

        if (activeGame && activeGame.id !== gameId) {
            socket.emit("lobby:error", "existing_game");
            return;
        }

        try {
            const game = await db.one("SELECT * FROM ttt_games WHERE id = $1", [
                gameId,
            ]);

            if (game.status !== "waiting") {
                socket.emit(
                    "lobby:error",
                    "This game is no longer accepting players"
                );
                return;
            }

            if (game.guest_id) {
                socket.emit("lobby:error", "This game already has two players");
                return;
            }

            const user = await db.one("SELECT * FROM ttt_users WHERE id = $1", [
                userId,
            ]);

            this.io.to(`game:${gameId}`).emit("lobby:join_request", {
                userId: user.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                rating: user.rating,
            });
        } catch (error) {
            console.error("Error handling join request:", error);
            socket.emit("lobby:error", "Failed to send join request");
        }
    }

    async handleApproveJoin(socket, data) {
        const hostId = socket.request.session.passport.user;
        const { gameId, userId } = data;

        try {
            const game = await db.one(
                "SELECT * FROM ttt_games WHERE id = $1 AND host_id = $2",
                [gameId, hostId]
            );

            if (!game) {
                socket.emit("lobby:error", "Unauthorized action");
                return;
            }

            await db.none(
                "UPDATE ttt_games SET guest_id = $1, status = 'ready' WHERE id = $2",
                [userId, gameId]
            );

            const updatedGame = await db.one(
                `SELECT g.*, 
                    guest.username as guest_username,
                    guest.avatar_url as guest_avatar_url,
                    guest.rating as guest_rating
                FROM ttt_games g
                JOIN ttt_users guest ON g.guest_id = guest.id
                WHERE g.id = $1`,
                [gameId]
            );

            this.io.to(`game:${gameId}`).emit("lobby:player_joined", {
                gameId,
                guest: {
                    id: updatedGame.guest_id,
                    username: updatedGame.guest_username,
                    avatarUrl: updatedGame.guest_avatar_url,
                    rating: updatedGame.guest_rating,
                },
            });

            this.io.emit("lobby:join_approved", { userId, gameId });
        } catch (error) {
            console.error("Error approving join:", error);
            socket.emit("lobby:error", "Failed to approve player");
        }
    }

    async handleRejectJoin(socket, data) {
        const { gameId, userId } = data;

        this.io.emit("lobby:join_rejected", {
            gameId,
            userId,
        });
    }

    handleDisconnect(socket) {
        if (socket.gameId) {
            const gameRoom = this.gameRooms.get(socket.gameId);
            if (gameRoom) {
                gameRoom.delete(socket.id);
                if (gameRoom.size === 0) {
                    this.gameRooms.delete(socket.gameId);
                }
            }
            this.broadcastLobbyState(socket.gameId);

            const wasSpectator = socket.rooms?.has(
                `spectators:${socket.gameId}`
            );
            if (wasSpectator) {
                this.handleSpectatorLeave(socket, socket.gameId);
            }
        }
    }

    async broadcastLobbyState(gameId) {
        try {
            const game = await db.one(
                `SELECT g.*, 
                    host.username as host_username,
                    host.avatar_url as host_avatar_url,
                    host.rating as host_rating,
                    guest.username as guest_username,
                    guest.avatar_url as guest_avatar_url,
                    guest.rating as guest_rating
                FROM ttt_games g
                JOIN ttt_users host ON g.host_id = host.id
                LEFT JOIN ttt_users guest ON g.guest_id = guest.id
                WHERE g.id = $1`,
                [gameId]
            );

            const roomUsers = Array.from(this.gameRooms.get(gameId) || []);

            this.io.to(`game:${gameId}`).emit("lobby:state", {
                game,
                connectedUsers: roomUsers.length,
            });
        } catch (error) {
            console.error("Error broadcasting lobby state:", error);
        }
    }
    async handleHostLeave(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const game = await db.oneOrNone(
                "SELECT * FROM ttt_games WHERE id = $1 AND host_id = $2",
                [gameId, userId]
            );

            if (!game) {
                socket.emit("lobby:error", "Unauthorized action");
                return;
            }

            await this.deleteGame(gameId);

            this.io.to(`game:${gameId}`).emit("lobby:game_deleted");

            const room = this.io.sockets.adapter.rooms.get(`game:${gameId}`);
            if (room) {
                for (const socketId of room) {
                    const socket = this.io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.leave(`game:${gameId}`);
                    }
                }
            }

            this.gameRooms.delete(gameId);

            this.io.emit("games:refresh");
        } catch (error) {
            console.error("Error handling host leave:", error);
            socket.emit("lobby:error", "Failed to leave game");
        }
    }

    async handleGuestLeave(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const game = await db.oneOrNone(
                "SELECT * FROM ttt_games WHERE id = $1 AND guest_id = $2",
                [gameId, userId]
            );

            if (!game) {
                socket.emit("lobby:error", "Unauthorized action");
                return;
            }

            await db.none(
                "UPDATE ttt_games SET guest_id = NULL, status = 'waiting' WHERE id = $1",
                [gameId]
            );

            this.io.to(`game:${gameId}`).emit("lobby:guest_left");

            await this.broadcastLobbyState(gameId);

            socket.leave(`game:${gameId}`);

            const gameRoom = this.gameRooms.get(gameId);
            if (gameRoom) {
                gameRoom.delete(socket.id);
            }

            socket.emit("lobby:redirect_home");
        } catch (error) {
            console.error("Error handling guest leave:", error);
            socket.emit("lobby:error", "Failed to leave game");
        }
    }
}

module.exports = { GameLobbyManager };
