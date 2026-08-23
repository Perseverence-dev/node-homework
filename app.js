const express = require("express");

// Import the PostgreSQL connection pool.
const pool = require("./db/pg-pool");

const userRoutes = require("./routes/userRoutes");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");

const authMiddleware = require("./middleware/auth");
const taskRouter = require("./routes/taskRoutes");

// Create the Express application.
const app = express();

// Temporarily track the currently logged-in user's database ID.
// Assignment 8 will replace this global approach with secure authentication.
global.user_id = null;

// Parse incoming JSON request bodies.
// This must appear before routes that read req.body.
app.use(express.json());

// Confirm that both the Express server and PostgreSQL are available.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      status: "ok",
      db: "connected",
    });
  } catch (err) {
    return res.status(500).json({
      message: `db not connected, error: ${err.message}`,
    });
  }
});

// Mount the user router.
// This produces endpoints beginning with /api/users.
app.use("/api/users", userRoutes);

// Mount the task router with authentication middleware.
app.use("/api/tasks", authMiddleware, taskRouter);

// Handle requests that did not match any route.
// This must appear after all real routes.
app.use(notFound);

// Handle unexpected server errors.
// Express error middleware must be last.
app.use(errorHandler);

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Server is listening on port ${port}...`);
});

// Gracefully stop accepting requests and close database connections.
async function shutdown() {
  console.log("Shutting down the server...");

  try {
    // Release every PostgreSQL connection held by the pool.
    await pool.end();

    // Stop the HTTP server after database connections are closed.
    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

// Handle normal terminal and hosting-platform shutdown signals.
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Export both values so the assignment tests can use them.
module.exports = {
  app,
  server,
};