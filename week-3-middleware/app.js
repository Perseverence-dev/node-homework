const express = require("express");
const path = require("path");
// Import the crypto module so we can generate unique IDs for every incoming requests.
const { randomUUID } = require("crypto");
// Import the dogs router so we can mount it in this file.
const dogsRouter = require("./routes/dogs");


const app = express();

//1.Request ID Middleware
// Assign a unique ID to every incoming request.
app.use((req, res, next) => {
  // Generate the ID only once so the request and response use the same value.
  req.requestId = randomUUID();

  // Return the request ID to the client in the response headers.
  res.setHeader("X-Request-Id", req.requestId);

  // Continue to the next middleware or route.
  next();
});

//2. Logging Middleware
// Log each request using its request ID.
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();

  console.log(
    `[${timestamp}]: ${req.method} ${req.path} (${req.requestId})`,
  );

  next();
});

//3. json parse Middleware
// Add middleware to parse incoming JSON request bodies.
app.use(express.json());

//4.Static File Middleware
// Add middleware to serve static files from the public directory.
app.use(express.static(path.join(__dirname, "public")));

//5. Mount the dogs router
app.use("/", dogsRouter);// Do not remove this line

// 6. Handle requests that do not match any route.
app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found",
    requestId: req.requestId,
  });
});

// 7. Handle unexpected application errors.
app.use((err, req, res, next) => {
  // Log detailed information for the developer.
  console.error(err);

  // Return a safe response to the client.
  return res.status(500).json({
    error: "Internal Server Error",
    requestId: req.requestId,
  });
});

// Start the server if this file is run directly.
if (require.main === module) {
  app.listen(3000, () => {
    console.log("Dog rescue app is listening on port 3000...");
  });
}

// Export the app itself.
module.exports = app;

