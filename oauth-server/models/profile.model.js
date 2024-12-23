const db = require("../config/database");

class ProfileModel {
    async getProfile(userId) {
        return db.one(
            "SELECT id, username, fullname, nickname FROM users WHERE id = $1",
            [userId]
        );
    }

    async getAvatar(userId) {
        return db.oneOrNone("SELECT avatar FROM users WHERE id = $1", [userId]);
    }

    async updateProfile(userId, fullname, nickname) {
        return db.one(
            "UPDATE users SET fullname = $1, nickname = $2 WHERE id = $3 RETURNING id, username, fullname, nickname",
            [fullname, nickname, userId]
        );
    }

    async updateAvatar(userId, avatarBuffer) {
        return db.none("UPDATE users SET avatar = $1 WHERE id = $2", [
            avatarBuffer,
            userId,
        ]);
    }
}

module.exports = new ProfileModel();
