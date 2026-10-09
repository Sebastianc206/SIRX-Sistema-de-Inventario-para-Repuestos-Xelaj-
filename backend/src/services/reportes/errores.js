class ReporteError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ReporteError";
    this.statusCode = statusCode;
  }
}

module.exports = { ReporteError };
