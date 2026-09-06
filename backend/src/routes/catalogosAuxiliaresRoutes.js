const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarMarcasController,
  listarModelosController,
  listarPaisesController,
  listarDepartamentosController,
  listarMunicipiosController,
} = require("../controllers/catalogosAuxiliaresController");

const router = express.Router();

// Solo Administrador: hoy en día solo los usan el formulario de repuestos
// (marcas/modelos) y el de proveedores (país/departamento/municipio),
// ambos restringidos a este rol.
router.use(authMiddleware, authorize("Administrador"));

router.get("/marcas", listarMarcasController);
router.get("/modelos", listarModelosController);
router.get("/paises", listarPaisesController);
router.get("/departamentos", listarDepartamentosController);
router.get("/municipios", listarMunicipiosController);

module.exports = router;
