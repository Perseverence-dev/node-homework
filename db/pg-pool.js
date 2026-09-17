// Import Pool from the PostgreSQL client package.
const { Pool } = require("pg");

// Load environment variables from the .env file.
require("dotenv").config();

// Create a pool of reusable PostgreSQL connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Listen for unexpected errors from idle database connections.
pool.on("error", (err, _client) => {
  console.error("Unexpected error on idle client", err);
});

// Export the pool so controllers and app.js can use it.
module.exports = pool;