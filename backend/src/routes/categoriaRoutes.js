const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/roleMiddleware");
const {
  listarController,
  crearController,
  editarController,
  eliminarController,
} = require("../controllers/categoriaController");

const router = express.Router();

// Cualquier usuario autenticado puede consultar el catálogo de categorías
// (lo necesita, por ejemplo, el selector del formulario de repuestos que
// también usa el rol Operador). Modificarlo queda restringido a Administrador.
router.use(authMiddleware);

router.get("/", listarController);
router.post("/", authorize("Administrador"), crearController);
router.put("/:id", authorize("Administrador"), editarController);
router.delete("/:id", authorize("Administrador"), eliminarController);

module.exports = router;
