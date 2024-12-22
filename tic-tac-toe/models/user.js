const db = require("../config/database");

const UserModel = {
    async findById(id) {
        return db.oneOrNone("SELECT * FROM ttt_users WHERE id = $1", [id]);
    },

    async findByOAuthId(oauthId) {
        return db.oneOrNone("SELECT * FROM ttt_users WHERE oauth_id = $1", [
            oauthId,
        ]);
    },

    async updateProfile(userId, updates) {
        const validFields = [
            "nickname",
            "avatar_url",
            "game_piece",
            "board_color",
        ];
        const setClause = Object.keys(updates)
            .filter((key) => validFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(", ");

        const values = [
            userId,
            ...Object.keys(updates)
                .filter((key) => validFields.includes(key))
                .map((key) => updates[key]),
        ];

        return db.one(
            `UPDATE ttt_users 
             SET ${setClause} 
             WHERE id = $1 
             RETURNING *`,
            values
        );
    },
};

module.exports = UserModel;
