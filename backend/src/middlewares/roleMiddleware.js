function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.role)) {
      return res.status(403).json({ message: "No tienes permisos para esta acción" });
    }

    return next();
  };
}

module.exports = authorize;
