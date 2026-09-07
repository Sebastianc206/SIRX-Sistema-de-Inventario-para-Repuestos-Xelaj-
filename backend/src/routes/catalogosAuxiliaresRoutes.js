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

router.use(authMiddleware);

// HU-06: marcas y modelos alimentan tanto el formulario de repuestos
// (Administrador) como los filtros del catálogo (cualquier usuario
// autenticado, ver criterio 2) — ninguno de los dos es un dato sensible.
router.get("/marcas", listarMarcasController);
router.get("/modelos", listarModelosController);

// País/departamento/municipio solo los usa el formulario de proveedores,
// que sigue siendo exclusivo de Administrador (HU-26).
router.get("/paises", authorize("Administrador"), listarPaisesController);
router.get("/departamentos", authorize("Administrador"), listarDepartamentosController);
router.get("/municipios", authorize("Administrador"), listarMunicipiosController);

module.exports = router;
