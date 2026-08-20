const express = require("express");

const userRoutes = require("./routes/userRoutes");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");

// Create the Express application.
const app = express();

// Temporary in-memory data.
// These will be replaced by a real database in a later assignment.
global.user_id = null;
global.users = [];
global.tasks = [];

// Parse incoming JSON request bodies.
// This must appear before routes that read req.body.
app.use(express.json());

// Mount the user router.
// This produces endpoints beginning with /api/users.
app.use("/api/users", userRoutes);

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

// Export both values so the assignment tests can use them.
module.exports = {
  app,
  server,
};