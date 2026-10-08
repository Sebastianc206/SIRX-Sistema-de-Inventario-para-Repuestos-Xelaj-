const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarController,
  listarTiposController,
  obtenerController,
  crearController,
  anularController,
} = require("../controllers/salidaAjusteController");

const router = express.Router();

// HU-09: registrar mermas/ajustes es una tarea operativa de bodega, no
// financiera (no hay precio de línea aquí) — ambos roles pueden crearlas.
// El HISTORIAL (listar) es visión de auditoría, igual que en ventas —
// exclusivo de Administrador.
router.use(authMiddleware);

router.get("/tipos", listarTiposController);
router.get("/", authorize("Administrador"), listarController);
router.get("/:id", obtenerController);
router.post("/", crearController);
router.patch("/:id/anular", authorize("Administrador"), anularController);

module.exports = router;
