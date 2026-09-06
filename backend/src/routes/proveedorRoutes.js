const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const { listarController, crearController, editarController } = require("../controllers/proveedorController");

const router = express.Router();

// T-039: la gestión de proveedores es exclusiva del rol Administrador — a
// diferencia de Categoria (lectura abierta a Operador), acá ni siquiera el
// listado se expone a otro rol, porque el proveedor de un repuesto es un
// dato que Operador no debe ver en ningún lado (mismo criterio que en HU-04).
router.use(authMiddleware, authorize("Administrador"));

router.get("/", listarController);
router.post("/", crearController);
router.put("/:id", editarController);

module.exports = router;
