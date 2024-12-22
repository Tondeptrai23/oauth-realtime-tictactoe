const express = require("express");
const router = express.Router();
const ProfileController = require("../controllers/profile.controller");
const { isAuthenticated } = require("../middleware/auth.middleware");

router.use(isAuthenticated);

router.get("/profile", ProfileController.getProfile.bind(ProfileController));
router.get(
    "/profile/avatar",
    ProfileController.getProfilePicture.bind(ProfileController)
);
router.post(
    "/api/profile/update",
    ProfileController.updateProfile.bind(ProfileController)
);

module.exports = router;
