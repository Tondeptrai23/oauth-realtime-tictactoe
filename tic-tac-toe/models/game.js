const db = require("../config/database");

class GameModel {
    static async findActiveGameByHostId(hostId) {
        return await db.oneOrNone(
            `SELECT id, host_id, board_size, status, allow_custom_settings
             FROM ${db.tables.games} 
             WHERE host_id = $1 
             AND status IN ('waiting', 'in_progress', 'ready')`,
            [hostId]
        );
    }

    static async create(
        hostId,
        { boardSize, turnTimeLimit, allowCustomSettings }
    ) {
        return await db.one(
            `INSERT INTO ${db.tables.games}
             (host_id, board_size, status, turn_time_limit, allow_custom_settings) 
             VALUES ($1, $2, 'waiting', $3, $4) 
             RETURNING id, host_id, board_size, turn_time_limit, allow_custom_settings`,
            [hostId, boardSize, turnTimeLimit, allowCustomSettings]
        );
    }

    static validateBoardSize(size) {
        const validSizes = [3, 5];
        return validSizes.includes(parseInt(size));
    }

    static validateTurnTimeLimit(timeLimit) {
        const limit = parseInt(timeLimit);
        return limit >= 10 && limit <= 120;
    }

    static async getGameWithPlayers(gameId) {
        return await db.oneOrNone(
            `SELECT g.*, 
                host.username as host_username,
                host.avatar_url as host_avatar_url,
                host.rating as host_rating,
                host.game_piece as host_game_piece,
                guest.username as guest_username,
                guest.avatar_url as guest_avatar_url,
                guest.rating as guest_rating,
                guest.game_piece as guest_game_piece,
                host.board_color as host_board_color,
                guest.board_color as guest_board_color
            FROM ${db.tables.games} g
            JOIN ${db.tables.users} host ON g.host_id = host.id
            LEFT JOIN ${db.tables.users} guest ON g.guest_id = guest.id
            WHERE g.id = $1`,
            [gameId]
        );
    }

    static async deleteGame(gameId) {
        await db.none(`DELETE FROM ${db.tables.games} WHERE id = $1`, [gameId]);
    }

    static async findUserActiveGame(userId) {
        return await db.oneOrNone(
            `SELECT id FROM ${db.tables.games}
             WHERE (host_id = $1 OR guest_id = $1) 
             AND status IN ('waiting', 'in_progress', 'ready')`,
            [userId]
        );
    }

    static async getGameAndUserForJoinRequest(gameId, userId) {
        const game = await db.one(
            `SELECT * FROM ${db.tables.games} WHERE id = $1`,
            [gameId]
        );
        const user = await db.one(
            `SELECT * FROM ${db.tables.users} WHERE id = $1`,
            [userId]
        );
        return { game, user };
    }

    static async approveJoinRequest(gameId, hostId, userId) {
        // Verify host ownership
        const game = await db.one(
            `SELECT * FROM ${db.tables.games} WHERE id = $1 AND host_id = $2`,
            [gameId, hostId]
        );

        if (!game) {
            throw new Error("Unauthorized action");
        }

        // Update game with new guest
        await db.none(
            `UPDATE ${db.tables.games} SET guest_id = $1, status = 'ready' WHERE id = $2`,
            [userId, gameId]
        );

        // Get updated game info
        return await db.one(
            `SELECT g.*, 
                guest.username as guest_username,
                guest.avatar_url as guest_avatar_url,
                guest.rating as guest_rating
            FROM ${db.tables.games} g
            JOIN ${db.tables.users} guest ON g.guest_id = guest.id
            WHERE g.id = $1`,
            [gameId]
        );
    }

    static async startGame(gameId, hostId) {
        const game = await this.getGameWithPlayers(gameId);

        if (!game || game.host_id !== hostId) {
            throw new Error("Unauthorized action");
        }

        if (!game.guest_id) {
            throw new Error("Cannot start game without a second player");
        }

        await db.none(
            `UPDATE ${db.tables.games}
            SET status = 'in_progress',
                current_turn = $1,
                last_move_time = CURRENT_TIMESTAMP
            WHERE id = $2`,
            [game.host_id, gameId]
        );

        return game;
    }

    static async recordMove(gameId, userId, row, col, moveNumber) {
        await db.none(
            `INSERT INTO ${db.tables.moves}
            (game_id, user_id, position_x, position_y, move_number) 
            VALUES ($1, $2, $3, $4, $5)`,
            [gameId, userId, col, row, moveNumber]
        );
    }

    static async updateGameAfterWin(gameId, winnerId) {
        const game = await this.getGameWithPlayers(gameId);

        await db.none(
            `UPDATE ${db.tables.games}
            SET status = $1, winner_id = $2
            WHERE id = $3`,
            ["completed", winnerId, gameId]
        );

        // Update ratings
        const winner = winnerId === game.host_id ? "host" : "guest";
        const loser = winner === "host" ? "guest" : "host";
        const winnerRating = game[`${winner}_rating`];
        const loserRating = game[`${loser}_rating`];

        const newWinnerRating = winnerRating + 10;
        const newLoserRating = Math.max(0, loserRating - 10);

        await db.none(
            `UPDATE ${db.tables.users}
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

    static async updateGameAfterDraw(gameId) {
        await db.none(
            `UPDATE ${db.tables.games}
            SET status = 'draw', winner_id = NULL
            WHERE id = $1`,
            [gameId]
        );
    }

    static async updateTurn(gameId, nextTurn) {
        await db.none(
            `UPDATE ${db.tables.games}
            SET current_turn = $1, last_move_time = CURRENT_TIMESTAMP
            WHERE id = $2`,
            [nextTurn, gameId]
        );
    }

    static async getGameMovesAndState(gameId) {
        const moves = await db.manyOrNone(
            `SELECT m.*, 
                   u.game_piece as piece
            FROM ${db.tables.moves} m
            JOIN ${db.tables.users} u ON m.user_id = u.id
            WHERE m.game_id = $1 
            ORDER BY m.move_number ASC`,
            [gameId]
        );

        const game = await this.getGameWithPlayers(gameId);
        if (!game) return null;

        return { moves, game };
    }

    static async handleGuestLeave(gameId, userId) {
        const game = await db.oneOrNone(
            `SELECT * FROM ${db.tables.games} WHERE id = $1 AND guest_id = $2`,
            [gameId, userId]
        );

        if (!game) {
            throw new Error("Unauthorized action");
        }

        if (game.status === "in_progress") {
            await db.none(`DELETE FROM ${db.tables.moves} WHERE game_id = $1`, [
                gameId,
            ]);
        }

        await db.none(
            `UPDATE ${db.tables.games}
             SET guest_id = NULL, 
                 status = 'waiting', 
                 current_turn = NULL, 
                 last_move_time = NULL
             WHERE id = $1`,
            [gameId]
        );

        return game.status === "in_progress";
    }

    static async getActiveGames() {
        return await db.manyOrNone(
            `SELECT g.*, 
                    host.username as host_username,
                    host.avatar_url as host_avatar_url,
                    host.game_piece as host_piece,
                    COALESCE(
                        (SELECT COUNT(*) 
                         FROM ${db.tables.users} u 
                         WHERE u.id = ANY(
                             SELECT DISTINCT user_id 
                             FROM ${db.tables.chat_messages}
                             WHERE game_id = g.id
                         )
                        ), 
                        0
                    ) as spectator_count
             FROM ${db.tables.games} g
             JOIN ${db.tables.users} host ON g.host_id = host.id
             WHERE g.status IN ('waiting', 'in_progress', 'ready')
             ORDER BY g.created_at DESC`
        );
    }
}

module.exports = GameModel;
