const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarMarcasController,
  listarProveedoresController,
  listarModelosController,
} = require("../controllers/catalogosAuxiliaresController");

const router = express.Router();

// Solo Administrador: son los únicos que crean/editan repuestos, y
// Proveedor en particular es un dato que el rol Operador no debe ver
// (mismo criterio que precio_costo en HU-04).
router.use(authMiddleware, authorize("Administrador"));

router.get("/marcas", listarMarcasController);
router.get("/proveedores", listarProveedoresController);
router.get("/modelos", listarModelosController);

module.exports = router;
