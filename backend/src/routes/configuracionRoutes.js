const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  obtenerStockController,
  impactoController,
  actualizarStockController,
  umbralMasivoController,
} = require("../controllers/configuracionController");

const router = express.Router();

// Configuración del umbral de stock bajo: SOLO Administrador. Operador no
// necesita este endpoint — cada repuesto ya trae su umbral efectivo y su
// estadoStock calculado en GET /api/repuestos.
router.use(authMiddleware);

router.get("/stock", authorize("Administrador"), obtenerStockController);
router.get("/stock/impacto", authorize("Administrador"), impactoController);
router.put("/stock", authorize("Administrador"), actualizarStockController);
router.post("/stock/umbral-masivo", authorize("Administrador"), umbralMasivoController);

module.exports = router;
