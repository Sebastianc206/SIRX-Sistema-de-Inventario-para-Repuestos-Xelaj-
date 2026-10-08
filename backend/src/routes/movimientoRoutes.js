const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const { listarController, obtenerComparacionVentasController } = require("../controllers/movimientoController");

const router = express.Router();

// HU-10: historial de movimientos + comparación de ventas — visión de
// auditoría/reportes, exclusiva de Administrador (ocultar el link en el
// Sidebar no basta, hay que validar el rol acá).
router.use(authMiddleware, authorize("Administrador"));

// Ya no hay ruta ":sku" — el historial se filtra por querystring (skus,
// idCategoria, idMarca, fechaDesde, fechaHasta, pagina), no por un solo
// producto en la URL, así que no hay riesgo de colisión entre estas dos.
router.get("/", listarController);
router.get("/comparacion-ventas", obtenerComparacionVentasController);

module.exports = router;
