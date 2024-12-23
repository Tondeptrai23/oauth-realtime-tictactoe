const express = require("express");
const router = express.Router();
const ProfileController = require("../controllers/profile.controller");
const AuthMiddleware = require("../middleware/auth.middleware");
const { upload, handleMulterError } = require("../config/multer");

router.get("/", AuthMiddleware.validateToken, ProfileController.getProfile);
router.get(
    "/avatar",
    AuthMiddleware.validateToken,
    ProfileController.getProfilePicture
);
router.put("/", AuthMiddleware.validateToken, ProfileController.updateProfile);
router.put(
    "/avatar",
    AuthMiddleware.validateToken,
    upload.single("avatar"),
    handleMulterError,
    ProfileController.updateAvatar
);
router.get(
    "/avatar/oauth",
    AuthMiddleware.validateToken,
    ProfileController.getAvatar
);

module.exports = router;
