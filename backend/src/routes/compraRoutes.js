const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarController,
  obtenerController,
  crearController,
  anularController,
} = require("../controllers/compraController");

const router = express.Router();

// HU-08: registrar/consultar compras involucra precioCompra y
// montoTotalCompra (datos de costo) — igual que el catálogo, exclusivo de
// Administrador (mismo criterio que proveedorRoutes.js).
router.use(authMiddleware, authorize("Administrador"));

router.get("/", listarController);
router.get("/:id", obtenerController);
router.post("/", crearController);
// Anular compra (reversión, requiere migración `anulada` en CompraMaestro):
// decrementa el stock de cada línea y marca anulada=true.
router.patch("/:id/anular", anularController);

module.exports = router;
