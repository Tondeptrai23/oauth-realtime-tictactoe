const db = require("../config/database");

class GameModel {
    static async findActiveGameByHostId(hostId) {
        return await db.oneOrNone(
            `SELECT id, host_id, board_size, status, allow_custom_settings
             FROM ttt_games 
             WHERE host_id = $1 
             AND status IN ('waiting', 'in_progress')`,
            [hostId]
        );
    }

    static async create(
        hostId,
        { boardSize, turnTimeLimit, allowCustomSettings }
    ) {
        console.log("hostId", hostId);

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
}

module.exports = GameModel;
