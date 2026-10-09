const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const c = require("../controllers/conteoController");

const router = express.Router();

// Conteo físico: auditoría de inventario, exclusiva de Administrador
// (incluye valorización con precioCosto y corrige existencias).
// DECISIÓN ABIERTA (documentada en docs/ARCHITECTURE.md): el Operador NO
// puede registrar cantidades; si el negocio quiere conteo en bodega por
// Operador habría que abrir solo PUT /:id/lineas sin valores ni cierre.
// authorize("Administrador") se repite por ruta a propósito: cada endpoint
// comprueba el rol por sí mismo.
router.use(authMiddleware);

router.get("/", authorize("Administrador"), c.listarController);
router.post("/", authorize("Administrador"), c.crearController);
router.get("/:id", authorize("Administrador"), c.obtenerController);
router.put("/:id/lineas", authorize("Administrador"), c.guardarLineasController);
router.delete("/:id/lineas/:sku", authorize("Administrador"), c.eliminarLineaController);
router.post("/:id/cerrar", authorize("Administrador"), c.cerrarController);
router.post("/:id/cancelar", authorize("Administrador"), c.cancelarController);
router.delete("/:id", authorize("Administrador"), c.eliminarController);

module.exports = router;
