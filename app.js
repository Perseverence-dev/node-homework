const express = require("express");

// Import the shared Prisma Client.
const prisma = require("./db/prisma");

const userRoutes = require("./routes/userRoutes");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");

const jwtMiddleware = require("./middleware/jwtMiddleware");
const taskRouter = require("./routes/taskRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

// Security packages added in Assignment 8.
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { xss } = require("express-xss-sanitizer");
const rateLimiter = require("express-rate-limit");

// Create the Express application.
const app = express();

// Trust the hosting platform's proxy so secure cookies work in production.
app.set("trust proxy", 1);

// Rate limiting comes first so misbehaving clients are stopped early.
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  }),
);

// Helmet sets security-related HTTP headers.
app.use(helmet());

// Parse cookies so the JWT middleware can read the jwt cookie.
app.use(cookieParser());

// Parse incoming JSON request bodies.
// This must appear before routes that read req.body.
app.use(express.json());

// Sanitize the request against XSS attacks.
// This must come after the cookie and body parsers.
app.use(xss());

// Confirm that both the Express server and PostgreSQL are available.
app.get("/health", async (_req, res) => {
  try {
    // Use Prisma to send a simple query to PostgreSQL.
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: "ok",
      db: "connected",
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      db: "not connected",
      error: err.message,
    });
  }
});

// Mount the user router.
// This produces endpoints beginning with /api/users.
app.use("/api/users", userRoutes);

// Mount the task router behind the JWT authentication middleware.
app.use("/api/tasks", jwtMiddleware, taskRouter);
// Analytics router mounted with the JWT authentication middleware.
// This produces endpoints beginning with /api/analytics.
app.use("/api/analytics", jwtMiddleware, analyticsRoutes);

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

// Gracefully stop accepting requests and close the database connection.
async function shutdown() {
  console.log("Shutting down the server...");

  try {
    // Disconnect the shared Prisma Client.
    await prisma.$disconnect();
    console.log("Prisma disconnected.");

    // Stop the HTTP server after the database connection is closed.
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