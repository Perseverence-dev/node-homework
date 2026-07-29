// Import Express so we can create a router.
const express = require("express");

// Import the user controller functions.
const {
  register,
  logon,
  logoff,
} = require("../controllers/userController");

// Create a router for user-related endpoints.
const router = express.Router();

// Connect each POST endpoint to its controller function.
router.post("/register", register);
router.post("/logon", logon);
router.post("/logoff", logoff);

// Export the router so it can be mounted in app.js.
module.exports = router;