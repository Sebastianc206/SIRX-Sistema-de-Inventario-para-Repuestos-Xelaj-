const express = require("express");
const { loginController, meController } = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/login", loginController);
router.get("/me", authMiddleware, meController);

module.exports = router;
