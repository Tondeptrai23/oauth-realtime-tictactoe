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

            await db.none(
                `INSERT INTO ttt_moves 
                (game_id, user_id, position_x, position_y, move_number) 
                VALUES ($1, $2, $3, $4, $5)`,
                [gameId, userId, col, row, gameState.moveCount]
            );

            const isWin = this.checkWin(gameState.board, { row, col }, piece);
            const isDraw = !isWin && this.checkDraw(gameState.board);

            if (isWin || isDraw) {
                await db.none(
                    `UPDATE ttt_games 
                    SET status = $1, winner_id = $2
                    WHERE id = $3`,
                    [
                        isWin ? "completed" : "draw",
                        isWin ? userId : null,
                        gameId,
                    ]
                );

                if (isWin) {
                    const winner = userId === game.host_id ? "host" : "guest";
                    const loser = winner === "host" ? "guest" : "host";
                    const winnerRating = game[`${winner}_rating`];
                    const loserRating = game[`${loser}_rating`];

                    const newWinnerRating = winnerRating + 10;
                    const newLoserRating = Math.max(0, loserRating - 10);

                    await db.none(
                        `UPDATE ttt_users 
                        SET rating = CASE 
                            WHEN id = $1 THEN $3
                            WHEN id = $2 THEN $4
                        END
                        WHERE id IN ($1, $2)`,
                        [
                            game[`${winner}_id`],
                            game[`${loser}_id`],
                            newWinnerRating,
                            newLoserRating,
                        ]
                    );
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

                await db.none(
                    `UPDATE ttt_games 
                    SET current_turn = $1, last_move_time = CURRENT_TIMESTAMP
                    WHERE id = $2`,
                    [nextTurn, gameId]
                );

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

    async handleGameStart(socket, gameId) {
        try {
            const game = await Game.getGameWithPlayers(gameId);

            if (!game) {
                socket.emit("game:error", "Game not found");
                return;
            }

            if (
                !socket.request.session.passport ||
                socket.request.session.passport.user !== game.host_id
            ) {
                socket.emit("game:error", "Only the host can start the game");
                return;
            }

            if (!game.guest_id) {
                socket.emit(
                    "game:error",
                    "Cannot start game without a second player"
                );
                return;
            }

            await db.none(
                `
                UPDATE ttt_games 
                SET status = 'in_progress',
                    current_turn = $1,
                    last_move_time = CURRENT_TIMESTAMP
                WHERE id = $2
            `,
                [game.host_id, gameId]
            );

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
            socket.emit("game:error", "Failed to start game");
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

            await db.none(
                `
                UPDATE ttt_games 
                SET current_turn = $1,
                    last_move_time = CURRENT_TIMESTAMP
                WHERE id = $2
            `,
                [nextTurn, gameId]
            );

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

    async getGameMovesAndState(gameId) {
        try {
            const moves = await db.manyOrNone(
                `
                SELECT m.*, 
                       u.game_piece as piece
                FROM ttt_moves m
                JOIN ttt_users u ON m.user_id = u.id
                WHERE m.game_id = $1 
                ORDER BY m.move_number ASC
            `,
                [gameId]
            );

            const game = await Game.getGameWithPlayers(gameId);
            if (!game) return null;

            const gameState = {
                board: Array(game.board_size)
                    .fill(null)
                    .map(() => Array(game.board_size).fill(null)),
                currentTurn: game.current_turn,
                turnTimeLimit: game.turn_time_limit,
                lastMoveTime: game.last_move_time,
                moveCount: moves.length,
                gameId: gameId,
                boardSize: game.board_size,
                allowCustomSettings: game.allow_custom_settings,
            };

            moves.forEach((move) => {
                gameState.board[move.position_y][move.position_x] = move.piece;
            });

            this.gameStates.set(gameId.toString(), gameState);

            return {
                gameState,
                moves,
                game,
            };
        } catch (error) {
            console.error("Error getting game moves:", error);
            return null;
        }
    }

    async handleLobbyJoin(socket, gameId) {
        try {
            const game = await db.one(
                `
                SELECT g.*, 
                    host.username as host_username, 
                    host.avatar_url as host_avatar_url,
                    guest.username as guest_username,
                    guest.avatar_url as guest_avatar_url
                FROM ttt_games g
                JOIN ttt_users host ON g.host_id = host.id
                LEFT JOIN ttt_users guest ON g.guest_id = guest.id
                WHERE g.id = $1
            `,
                [gameId]
            );

            socket.gameId = gameId;
            socket.join(`game:${gameId}`);

            if (!this.gameRooms.has(gameId)) {
                this.gameRooms.set(gameId, new Set());
            }
            this.gameRooms.get(gameId).add(socket.id);

            if (game.status === "in_progress") {
                const gameData = await this.getGameMovesAndState(gameId);
                if (gameData) {
                    socket.emit("game:state_sync", {
                        gameState: gameData.gameState,
                        currentTurn: gameData.game.current_turn,
                        hostUsername: gameData.game.host_username,
                        guestUsername: gameData.game.guest_username,
                        turnTimeLimit: gameData.game.turn_time_limit,
                        hostGamePiece: gameData.game.host_game_piece,
                        guestGamePiece: gameData.game.guest_game_piece,
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
