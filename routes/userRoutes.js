// Import Express so we can create a router.
const express = require("express");

// Import the user controller functions.
const {
  register,
  logon,
  logoff,
} = require("../controllers/userController");

// Import the JWT middleware so logoff is protected.
const jwtMiddleware = require("../middleware/jwtMiddleware");

// Create a router for user-related endpoints.
const router = express.Router();

// Registration and logon remain public because they establish a session.
router.post("/register", register);
router.post("/logon", logon);

// Logoff is protected so it cannot be triggered by cross-site request forgery.
// Logoff requires a valid JWT and matching CSRF token.
router.post("/logoff", jwtMiddleware, logoff);

// Export the router so it can be mounted in app.js.
module.exports = router;