const db = require("../config/database");
const axios = require("axios");
const https = require("https");

const UserModel = {
    async findById(id) {
        return db.oneOrNone(`SELECT * FROM ${db.tables.users} WHERE id = $1`, [
            id,
        ]);
    },

    async findByOAuthId(oauthId) {
        return db.oneOrNone(
            `SELECT * FROM ${db.tables.users} WHERE oauth_id = $1`,
            [oauthId]
        );
    },

    async updateProfile(userId, updates, req) {
        if (updates.avatar_url && updates.avatar_url === "auth") {
            const axiosInstance = axios.create({
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                }),
            });

            const response = await axiosInstance.get(
                process.env.AUTH_SERVER_PROFILE_URL + "/avatar",
                {
                    headers: {
                        Authorization: `Bearer ${req.user.accessToken}`,
                    },
                    responseType: "arraybuffer",
                }
            );

            if (response.status === 200) {
                this.updateCustomAvatar(userId, response.data);
            }

            delete updates.avatar_url;
        }

        const validFields = [
            "nickname",
            "game_piece",
            "board_color",
            "avatar_url",
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
            `UPDATE ${db.tables.users}
             SET ${setClause} 
             WHERE id = $1 
             RETURNING *`,
            values
        );
    },

    async getProfilePicture(userId) {
        const avatar_url = await db.one(
            `SELECT avatar_url FROM ${db.tables.users} WHERE id = $1`,
            [userId]
        );

        return avatar_url.avatar_url;
    },

    async getBinaryProfilePicture(userId) {
        const avatar = await db.one(
            `SELECT avatar FROM ${db.tables.users} WHERE id = $1`,
            [userId]
        );

        return avatar.avatar;
    },

    async updateCustomAvatar(userId, data) {
        db.none(`UPDATE ${db.tables.users} SET avatar_url = $1 WHERE id = $2`, [
            "auth",
            userId,
        ]);

        db.none(`UPDATE ${db.tables.users} SET avatar = $1 WHERE id = $2`, [
            data,
            userId,
        ]);
    },
};

module.exports = UserModel;
