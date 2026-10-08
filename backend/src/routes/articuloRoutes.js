const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const { cargarExcel } = require("../middlewares/uploadExcelMiddleware");
const {
  listarController,
  obtenerController,
  crearController,
  editarController,
  cambiarEstadoController,
  descargarPlantillaController,
  cargaMasivaController,
  eliminarController,
} = require("../controllers/articuloController");

const router = express.Router();

// HU-04, criterio 5: el listado y el detalle son consultables por
// cualquier usuario autenticado (Administrador u Operador). El propio
// controlador decide qué campos oculta según el rol (T-031).
router.use(authMiddleware);

// Antes de "/:sku": si no, Express interpretaría "plantilla-carga-masiva"
// como un SKU y nunca llegaría a este handler.
router.get("/plantilla-carga-masiva", authorize("Administrador"), descargarPlantillaController);

router.get("/", listarController);
router.get("/:sku", obtenerController);
router.post("/", authorize("Administrador"), crearController);
router.post(
  "/carga-masiva",
  authorize("Administrador"),
  cargarExcel("archivo"),
  cargaMasivaController,
);
router.put("/:sku", authorize("Administrador"), editarController);
router.patch("/:sku/estado", authorize("Administrador"), cambiarEstadoController);
// Eliminación real (opcional, ver articuloService.js): solo para repuestos
// ya inactivos y sin historial asociado.
router.delete("/:sku", authorize("Administrador"), eliminarController);

module.exports = router;
