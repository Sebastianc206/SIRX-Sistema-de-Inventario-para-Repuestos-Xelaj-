const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const { REPORTES } = require("../services/reportes/catalogo");
const { catalogoController, vistaPreviaController, descargarController } = require("../controllers/reporteController");

const router = express.Router();

router.use(authMiddleware);

// Catálogo: cada rol recibe SOLO los reportes que puede ver.
router.get("/", authorize("Administrador", "Operador"), catalogoController);

// Descarga (PDF/Excel/CSV, uno o varios reportes). La ruta admite a ambos
// roles; el servicio vuelve a comprobar el rol de CADA reporte pedido y
// responde 403 si alguno está restringido.
router.post("/descargar", authorize("Administrador", "Operador"), descargarController);

// Vista previa: un endpoint por reporte, con los roles de su definición como
// `authorize(...)` explícito (Operador recibe 403 en los restringidos).
for (const definicion of REPORTES) {
  router.get(`/${definicion.id}`, authorize(...definicion.roles), vistaPreviaController(definicion.id));
}

module.exports = router;
