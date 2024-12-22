const express = require("express");
const router = express.Router();
const ProfileController = require("../controllers/profile.controller");
const { isAuthenticated } = require("../middleware/auth.middleware");
const GameController = require("../controllers/game.controller");

router.use(isAuthenticated);

router.get("/profile", ProfileController.getProfile.bind(ProfileController));

router.get(
    "/api/profile/avatar",
    ProfileController.getProfilePicture.bind(ProfileController)
);

router.get(
    "/api/profile/avatar/:userId",
    ProfileController.getProfilePictureById.bind(ProfileController)
);

router.get(
    "/profile/avatar",
    ProfileController.getProfilePictureFromAuth.bind(ProfileController)
);
router.post(
    "/api/profile/update",
    ProfileController.updateProfile.bind(ProfileController)
);

router.get("/lobby/create", isAuthenticated, GameController.showCreateForm);

router.post("/lobby/create", isAuthenticated, GameController.createGame);

module.exports = router;
