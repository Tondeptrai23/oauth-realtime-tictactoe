const db = require("../config/database");

class ProfileController {
    async getProfile(req, res) {
        try {
            if (!req.oauth || !req.oauth.scope) {
                return res.status(403).json({ error: "No scope provided" });
            }

            if (!req.oauth.scope.includes("profile:basic")) {
                return res.status(403).json({ error: "Insufficient scope" });
            }

            const user = await db.one(
                "SELECT id, username, fullname, nickname FROM users WHERE id = $1",
                [req.user.user_id]
            );
            res.json(user);
        } catch (error) {
            console.error("Get profile error:", error);
            res.status(500).json({
                error: "Server error while fetching profile",
            });
        }
    }

    async getProfilePicture(req, res) {
        try {
            const user = await db.one(
                "SELECT avatar FROM users WHERE id = $1",
                [req.user.user_id]
            );

            if (!user.avatar) {
                return res.status(404).json({ error: "No avatar found" });
            }

            res.set("Content-Type", "image/jpeg");
            res.send(user.avatar);
        } catch (error) {
            console.error("Get profile picture error:", error);
            res.status(500).json({
                error: "Server error while fetching profile picture",
            });
        }
    }

    async updateProfile(req, res) {
        try {
            const { fullname, nickname } = req.body;
            const user = await db.one(
                "UPDATE users SET fullname = $1, nickname = $2 WHERE id = $3 RETURNING id, username, fullname, nickname",
                [fullname, nickname, req.user.id]
            );
            res.json(user);
        } catch (error) {
            console.error("Update profile error:", error);
            res.status(500).json({
                error: "Server error while updating profile",
            });
        }
    }

    async updateAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            await db.none("UPDATE users SET avatar = $1 WHERE id = $2", [
                req.file.buffer,
                req.user.id,
            ]);

            res.json({ message: "Avatar updated successfully" });
        } catch (error) {
            console.error("Update avatar error:", error);
            res.status(500).json({
                error: "Server error while updating avatar",
            });
        }
    }

    async getAvatar(req, res) {
        try {
            const result = await db.oneOrNone(
                "SELECT avatar FROM users WHERE id = $1",
                [req.params.userId]
            );

            if (!result || !result.avatar) {
                return res.status(404);
            }

            res.set("Content-Type", "image/jpeg");
            res.send(result.avatar);
        } catch (error) {
            console.error("Get avatar error:", error);
            res.status(500).json({
                error: "Server error while fetching avatar",
            });
        }
    }
}

module.exports = new ProfileController();
