// T-103: forzar HTTPS en todos los entornos desplegados, con redirección
// automática de HTTP a HTTPS.
//
// El backend corre detrás de un proxy (Render en producción) que termina
// TLS y reenvía la petición al proceso de Node por HTTP plano, marcando el
// protocolo original en `X-Forwarded-Proto`. Por eso se necesita
// `app.set("trust proxy", ...)` para que Express confíe en ese header al
// calcular `req.secure`/`req.hostname` — sin eso, todo request parecería
// inseguro aunque el cliente sí haya usado HTTPS.
//
// En desarrollo local no existe TLS (nodemon sirve http://localhost:PORT
// plano): forzar la redirección ahí rompería `npm run dev`, así que se
// exceptúa por host en vez de por NODE_ENV — así también sigue
// funcionando igual si alguna vez se corre con NODE_ENV=production
// localmente para probar algo.
const HOSTS_SIN_TLS_LOCAL = new Set(["localhost", "127.0.0.1"]);

function esSeguro(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

function esHostLocal(req) {
  return HOSTS_SIN_TLS_LOCAL.has(req.hostname);
}

function forzarHttps(req, res, next) {
  if (esSeguro(req) || esHostLocal(req)) {
    return next();
  }

  return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
}

module.exports = forzarHttps;
