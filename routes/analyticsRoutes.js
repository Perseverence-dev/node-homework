const express = require("express");

const router = express.Router();

const {
  getUserAnalytics,
  getUsersWithStats,
  searchTasks,
} = require("../controllers/analyticsController");

// Define routes for analytics.

// Return task statistics and recent activity for one user.
router.get("/users/:id", getUserAnalytics);

// Return a paginated list of users with task statistics.
router.get("/users", getUsersWithStats);

// Search task titles and user names using parameterized raw SQL.
router.get("/tasks/search", searchTasks);

module.exports = router;