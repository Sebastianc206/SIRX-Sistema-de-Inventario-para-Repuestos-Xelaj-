const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarController,
  obtenerController,
  crearController,
  editarController,
  cambiarEstadoController,
} = require("../controllers/articuloController");

const router = express.Router();

// HU-04, criterio 5: el listado y el detalle son consultables por
// cualquier usuario autenticado (Administrador u Operador). El propio
// controlador decide qué campos oculta según el rol (T-031).
router.use(authMiddleware);

router.get("/", listarController);
router.get("/:sku", obtenerController);
router.post("/", authorize("Administrador"), crearController);
router.put("/:sku", authorize("Administrador"), editarController);
router.patch("/:sku/estado", authorize("Administrador"), cambiarEstadoController);

module.exports = router;
