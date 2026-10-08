const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { obtenerResumenController } = require("../controllers/dashboardController");

const router = express.Router();

router.use(authMiddleware);

router.get("/resumen", obtenerResumenController);

module.exports = router;
