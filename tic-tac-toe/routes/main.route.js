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

router.get("/lobby/create", GameController.showCreateForm.bind(GameController));

router.post("/lobby/create", GameController.createGame.bind(GameController));

router.get("/lobby", GameController.showCurrentGame.bind(GameController));

router.get("/game/:id", GameController.getGameLobby.bind(GameController));

router.get(
    "/game/:id/replay",
    GameController.showGameReplay.bind(GameController)
);

module.exports = router;
