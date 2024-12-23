const db = require("../config/database");

class UserModel {
    async createUser(username, passwordHash, fullname) {
        return db.one(
            "INSERT INTO users (username, password_hash, fullname) VALUES ($1, $2, $3) RETURNING id, username, fullname",
            [username, passwordHash, fullname]
        );
    }

    async getUserByUsername(username) {
        return db.oneOrNone(
            "SELECT id, username, password_hash FROM users WHERE username = $1",
            [username]
        );
    }

    async getUserById(userId) {
        return db.oneOrNone(
            "SELECT id, username, password_hash FROM users WHERE id = $1",
            [userId]
        );
    }
}

module.exports = new UserModel();
