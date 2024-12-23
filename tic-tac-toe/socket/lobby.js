const db = require("../config/database");
const Game = require("../models/game");

class GameLobbyManager {
    constructor(io, onlineUsersManager) {
        this.io = io;
        this.onlineUsersManager = onlineUsersManager;
        this.gameRooms = new Map();
        this.gameStates = new Map();
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

        socket.on("disconnect", () => {
            this.handleDisconnect(socket);
        });

        socket.on("game:start", async (gameId) => {
            await this.handleGameStart(socket, gameId);
        });

        socket.on("game:turn_expired", async (gameId) => {
            await this.handleTurnExpired(socket, gameId);
        });

        socket.on("game:make_move", async (data) => {
            await this.handleGameMove(socket, data);
        });

        socket.on("game:request_state", async (gameId) => {
            await this.handleGameStateRequest(socket, gameId);
        });
    }

    async deleteGame(gameId) {
        try {
            const room = this.io.sockets.adapter.rooms.get(`game:${gameId}`);
            if (room) {
                this.io.to(`game:${gameId}`).emit("lobby:game_deleted");
            }

            await Game.deleteGame(gameId);
            this.gameRooms.delete(gameId);
        } catch (error) {
            console.error("Error deleting game:", error);
            throw error;
        }
    }

    async handleForceJoinRequest(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const activeGame = await Game.findUserActiveGame(userId);

            if (activeGame) {
                await this.deleteGame(activeGame.id);
            }

            await this.handleJoinRequest(socket, gameId);
        } catch (error) {
            console.error("Error handling force join:", error);
            socket.emit("lobby:error", "Failed to join game");
        }
    }

    async handleJoinRequest(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const activeGame = await Game.findUserActiveGame(userId);

            if (activeGame && activeGame.id !== gameId) {
                socket.emit("lobby:error", "existing_game");
                return;
            }

            const { game, user } = await Game.getGameAndUserForJoinRequest(
                gameId,
                userId
            );

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
            const updatedGame = await Game.approveJoinRequest(
                gameId,
                hostId,
                userId
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

    async handleGameStart(socket, gameId) {
        try {
            const hostId = socket.request.session.passport?.user;
            if (!hostId) {
                socket.emit("game:error", "Authentication required");
                return;
            }

            const game = await Game.startGame(gameId, hostId);

            const gameState = {
                board: Array(game.board_size)
                    .fill(null)
                    .map(() => Array(game.board_size).fill(null)),
                currentTurn: game.host_id,
                turnTimeLimit: game.turn_time_limit,
                lastMoveTime: new Date().toISOString(),
                moveCount: 0,
                gameId: gameId,
                boardSize: game.board_size,
                allowCustomSettings: game.allow_custom_settings,
            };

            this.gameStates.set(gameId.toString(), gameState);

            this.io.to(`game:${gameId}`).emit("game:started", {
                gameState,
                currentTurn: game.host_id,
                hostUsername: game.host_username,
                guestUsername: game.guest_username,
                turnTimeLimit: game.turn_time_limit,
                hostGamePiece: game.host_game_piece,
                guestGamePiece: game.guest_game_piece,
            });

            this.io.to(`game:${gameId}`).emit("game:turn_timer_start", {
                currentTurn: game.host_id,
                turnTimeLimit: game.turn_time_limit,
            });
        } catch (error) {
            console.error("Error starting game:", error);
            socket.emit("game:error", error.message || "Failed to start game");
        }
    }

    async handleTurnExpired(socket, gameId) {
        try {
            const game = await Game.getGameWithPlayers(gameId);
            if (!game || game.status !== "in_progress") return;

            const nextTurn =
                game.current_turn === game.host_id
                    ? game.guest_id
                    : game.host_id;
            await Game.updateTurn(gameId, nextTurn);

            const gameState = this.gameStates.get(gameId.toString());
            if (gameState) {
                gameState.currentTurn = nextTurn;
                gameState.lastMoveTime = new Date().toISOString();
                this.gameStates.set(gameId.toString(), gameState);
            }

            this.io.to(`game:${gameId}`).emit("game:turn_change", {
                currentTurn: nextTurn,
                reason: "timer_expired",
            });

            this.io.to(`game:${gameId}`).emit("game:turn_timer_start", {
                currentTurn: nextTurn,
                turnTimeLimit: game.turn_time_limit,
            });
        } catch (error) {
            console.error("Error handling turn expiration:", error);
            socket.emit("game:error", "Failed to process turn expiration");
        }
    }

    async handleGameMove(socket, data) {
        try {
            const userId = socket.request.session.passport.user;
            const { gameId, row, col, piece } = data;

            const game = await Game.getGameWithPlayers(gameId);
            if (!game || game.status !== "in_progress") {
                socket.emit("game:error", "Invalid game state");
                return;
            }

            if (game.current_turn !== userId) {
                socket.emit("game:error", "Not your turn");
                return;
            }

            const gameState = this.gameStates.get(gameId.toString());
            if (!gameState) {
                socket.emit("game:error", "Game state not found");
                return;
            }

            if (gameState.board[row][col] !== null) {
                socket.emit("game:error", "Invalid move");
                return;
            }

            gameState.board[row][col] = piece;
            gameState.moveCount++;
            await Game.recordMove(
                gameId,
                userId,
                row,
                col,
                gameState.moveCount
            );

            const isWin = this.checkWin(gameState.board, { row, col }, piece);
            const isDraw = !isWin && this.checkDraw(gameState.board);

            if (isWin || isDraw) {
                if (isWin) {
                    await Game.updateGameAfterWin(gameId, userId);
                } else {
                    await Game.updateGameAfterDraw(gameId);
                }

                this.io.to(`game:${gameId}`).emit("game:ended", {
                    gameState,
                    winner: isWin ? userId : null,
                    winnerName: isWin
                        ? userId === game.host_id
                            ? game.host_username
                            : game.guest_username
                        : null,
                    isDraw,
                });

                setTimeout(() => {
                    this.gameStates.delete(gameId.toString());
                }, 1000);
            } else {
                const nextTurn =
                    userId === game.host_id ? game.guest_id : game.host_id;
                await Game.updateTurn(gameId, nextTurn);

                gameState.currentTurn = nextTurn;
                gameState.lastMoveTime = new Date().toISOString();
                this.gameStates.set(gameId.toString(), gameState);

                this.io.to(`game:${gameId}`).emit("game:move_made", {
                    gameState,
                    move: { row, col, piece, userId },
                });

                this.io.to(`game:${gameId}`).emit("game:turn_change", {
                    currentTurn: nextTurn,
                    turnTimeLimit: game.turn_time_limit,
                });

                this.io.to(`game:${gameId}`).emit("game:turn_timer_start", {
                    currentTurn: nextTurn,
                    turnTimeLimit: game.turn_time_limit,
                });
            }
        } catch (error) {
            console.error("Error handling game move:", error);
            socket.emit("game:error", "Failed to process move");
        }
    }

    checkWin(board, lastMove, piece) {
        const { row, col } = lastMove;
        const size = board.length;

        if (board[row].every((cell) => cell === piece)) return true;

        if (board.every((row) => row[col] === piece)) return true;

        if (row === col) {
            if (board.every((row, i) => row[i] === piece)) return true;
        }

        if (row + col === size - 1) {
            if (board.every((row, i) => row[size - 1 - i] === piece))
                return true;
        }

        return false;
    }

    checkDraw(board) {
        return board.every((row) => row.every((cell) => cell !== null));
    }

    async handleGameStateRequest(socket, gameId) {
        try {
            const gameData = await Game.getGameMovesAndState(gameId);
            if (gameData) {
                const { moves, game } = gameData;
                const gameState = this.gameStates.get(gameId.toString());

                socket.emit("game:state_sync", {
                    gameState,
                    currentTurn: game.current_turn,
                    hostGamePiece: game.host_game_piece,
                    guestGamePiece: game.guest_game_piece,
                    movesHistory: moves,
                });
            }
        } catch (error) {
            console.error("Error handling game state request:", error);
            socket.emit("game:error", "Failed to get game state");
        }
    }

    async handleLobbyJoin(socket, gameId) {
        try {
            const game = await Game.getGameWithPlayers(gameId);

            socket.gameId = gameId;
            socket.join(`game:${gameId}`);

            if (!this.gameRooms.has(gameId)) {
                this.gameRooms.set(gameId, new Set());
            }
            this.gameRooms.get(gameId).add(socket.id);

            if (game.status === "in_progress") {
                const gameData = await Game.getGameMovesAndState(gameId);
                if (gameData) {
                    const { moves, game } = gameData;
                    socket.emit("game:state_sync", {
                        gameState: this.gameStates.get(gameId.toString()),
                        currentTurn: game.current_turn,
                        hostUsername: game.host_username,
                        guestUsername: game.guest_username,
                        turnTimeLimit: game.turn_time_limit,
                        hostGamePiece: game.host_game_piece,
                        guestGamePiece: game.guest_game_piece,
                        movesHistory: moves,
                    });
                }
            }

            this.broadcastLobbyState(gameId);
        } catch (error) {
            console.error("Error joining lobby:", error);
            socket.emit("lobby:error", "Failed to join game lobby");
        }
    }

    async handleJoinRequest(socket, gameId) {
        const userId = socket.request.session.passport.user;

        try {
            const activeGame = await Game.findUserActiveGame(userId);

            if (activeGame && activeGame.id !== gameId) {
                socket.emit("lobby:error", "existing_game");
                return;
            }

            const { game, user } = await Game.getGameAndUserForJoinRequest(
                gameId,
                userId
            );

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
            const updatedGame = await Game.approveJoinRequest(
                gameId,
                hostId,
                userId
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

    handleRejectJoin(socket, data) {
        const { gameId, userId } = data;
        this.io.emit("lobby:join_rejected", { gameId, userId });
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
        }
    }
    async broadcastLobbyState(gameId) {
        try {
            const game = await Game.getGameWithPlayers(gameId);
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
            const game = await Game.getGameWithPlayers(gameId);
            if (!game || game.host_id !== userId) {
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
            const wasInProgress = await Game.handleGuestLeave(gameId, userId);

            this.gameStates.delete(gameId.toString());

            this.io.to(`game:${gameId}`).emit("lobby:guest_left", {
                gameId,
                wasInProgress,
            });

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
