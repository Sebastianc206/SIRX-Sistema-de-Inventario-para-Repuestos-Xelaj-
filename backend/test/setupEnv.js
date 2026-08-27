// Variables de entorno mínimas para correr las pruebas sin depender de un
// .env real: los tests no tocan una base de datos (mockean prismaClient),
// pero authMiddleware sí necesita JWT_SECRET para firmar/verificar tokens.
// Debe cumplir la longitud mínima que exige jwtConfig.js (T-105).
process.env.JWT_SECRET = "test-secret-de-al-menos-32-caracteres-para-las-pruebas";
process.env.CORS_ORIGIN = "http://localhost:5173";
