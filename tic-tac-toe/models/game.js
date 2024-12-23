const db = require("../config/database");

class GameModel {
    static async findActiveGameByHostId(hostId) {
        return await db.oneOrNone(
            `SELECT id, host_id, board_size, status, allow_custom_settings
             FROM ttt_games 
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
            `INSERT INTO ttt_games 
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
            `
            SELECT g.*, 
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
            FROM ttt_games g
            JOIN ttt_users host ON g.host_id = host.id
            LEFT JOIN ttt_users guest ON g.guest_id = guest.id
            WHERE g.id = $1
        `,
            [gameId]
        );
    }
}

module.exports = GameModel;
