const path = require("path");
const fs = require("fs");
const ProfileModel = require("../models/profile.model");

class ProfileController {
    async getProfile(req, res) {
        try {
            if (!req.oauth || !req.oauth.scope) {
                return res.status(403).json({ error: "No scope provided" });
            }

            if (!req.oauth.scope.includes("profile:basic")) {
                return res.status(403).json({ error: "Insufficient scope" });
            }

            const user = await ProfileModel.getProfile(req.user.user_id);
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
            const user = await ProfileModel.getAvatar(req.user.user_id);

            if (!user.avatar) {
                user.avatar = fs.readFileSync(
                    path.join(__dirname, "../public/images/default-avatar.png")
                );
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
            const user = await ProfileModel.updateProfile(
                req.user.id,
                fullname,
                nickname
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

            await ProfileModel.updateAvatar(req.user.id, req.file.buffer);
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
            const result = await ProfileModel.getAvatar(req.params.userId);

            if (!result || !result.avatar) {
                return res.status(404).send();
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
