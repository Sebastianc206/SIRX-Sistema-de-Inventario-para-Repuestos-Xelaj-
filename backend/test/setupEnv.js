// Variables de entorno mínimas para correr las pruebas sin depender de un
// .env real: los tests no tocan una base de datos (mockean prismaClient),
// pero authMiddleware sí necesita JWT_SECRET para firmar/verificar tokens.
process.env.JWT_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";
