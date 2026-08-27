const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  crearController,
  editarController,
  cambiarEstadoController,
  listarController,
} = require("../controllers/usuarioController");

const router = express.Router();

// Gestión de cuentas: solo el rol Administrador puede crear/editar/listar usuarios (HU-02).
router.use(authMiddleware, authorize("Administrador"));

router.get("/", listarController);
router.post("/", crearController);
router.put("/:id", editarController);
router.patch("/:id/estado", cambiarEstadoController);

module.exports = router;
