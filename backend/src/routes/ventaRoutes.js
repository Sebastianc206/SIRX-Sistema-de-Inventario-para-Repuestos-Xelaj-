const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarController,
  obtenerController,
  crearController,
  anularController,
} = require("../controllers/ventaController");

const router = express.Router();

// HU-13/14: venta de mostrador es tarea de Operador (CLAUDE.md: "Operador:
// counter sales") — precioVenta/montoTotalVenta ya son visibles a ese rol
// en el catálogo, así que no hay filtrado de campos aquí. El HISTORIAL
// (listar) sí es visión de auditoría/reportes — exclusivo de Administrador,
// igual que Movimientos (HU-10).
router.use(authMiddleware);

router.get("/", authorize("Administrador"), listarController);
router.get("/:id", obtenerController);
router.post("/", crearController);
// HU-14: anular una venta es una reversión — exclusiva de Administrador,
// a diferencia de las demás rutas de este archivo.
router.patch("/:id/anular", authorize("Administrador"), anularController);

module.exports = router;
