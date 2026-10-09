const {
  UmbralStockError,
  obtenerConfiguracionStock,
  previsualizarImpacto,
  actualizarConfiguracionStock,
  aplicarUmbralMasivo,
} = require("../services/umbralStockService");

function manejarError(res, error) {
  if (error instanceof UmbralStockError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

async function obtenerStockController(_req, res) {
  try {
    return res.json(await obtenerConfiguracionStock());
  } catch (error) {
    return manejarError(res, error);
  }
}

// Impacto hipotético: ?umbral=N (texto de query string -> entero estricto).
async function impactoController(req, res) {
  const texto = req.query.umbral;
  const umbral = typeof texto === "string" && /^\d+$/.test(texto) ? Number(texto) : NaN;
  try {
    return res.json({ umbral, impacto: await previsualizarImpacto(umbral) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function actualizarStockController(req, res) {
  try {
    return res.json(await actualizarConfiguracionStock({ umbralGeneral: req.body?.umbralGeneral }));
  } catch (error) {
    return manejarError(res, error);
  }
}

async function umbralMasivoController(req, res) {
  const { umbral, skus, idCategoria } = req.body ?? {};
  try {
    const resultado = await aplicarUmbralMasivo({
      umbral: umbral === undefined ? undefined : umbral,
      skus,
      idCategoria,
    });
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = {
  obtenerStockController,
  impactoController,
  actualizarStockController,
  umbralMasivoController,
};
