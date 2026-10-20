// Variables para los tests. La integración usa TEST_DATABASE_URL_API (una base migrada y con el ETL
// ya ejecutado); sin ella, los tests de integración se omiten.
process.env.NODE_ENV = "test";
process.env.ETL_API_KEY = "test-api-key-0123456789";
process.env.INTERNAL_API_TOKEN = "test-internal-token-0123";
process.env.DATABASE_URL_API =
  process.env.TEST_DATABASE_URL_API ?? "postgresql://api_reader:unused@localhost:1/none";
