const express = require("express");
const cors = require("cors");
const forzarHttps = require("./middlewares/httpsMiddleware");
const { obtenerJwtSecret, obtenerJwtExpiresIn } = require("./utils/jwtConfig");
const authRoutes = require("./routes/authRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const categoriaRoutes = require("./routes/categoriaRoutes");
const articuloRoutes = require("./routes/articuloRoutes");
const proveedorRoutes = require("./routes/proveedorRoutes");
const catalogosAuxiliaresRoutes = require("./routes/catalogosAuxiliaresRoutes");

// T-105: fail fast. Si JWT_SECRET/JWT_EXPIRES_IN no cumplen la política de
// sesión corta, el servidor ni siquiera termina de arrancar — mejor eso
// que descubrirlo en el primer login en producción.
obtenerJwtSecret();
obtenerJwtExpiresIn();

const app = express();

// Necesario para que Express confíe en X-Forwarded-Proto/Host detrás del
// proxy de Render (ver comentario en httpsMiddleware.js).
app.set("trust proxy", 1);

// T-103: antes que cualquier otra cosa, incluido CORS — una petición HTTP
// insegura se redirige a HTTPS sin llegar a procesarse.
app.use(forzarHttps);

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/repuestos", articuloRoutes);
app.use("/api/proveedores", proveedorRoutes);
app.use("/api/catalogos", catalogosAuxiliaresRoutes);

module.exports = app;
