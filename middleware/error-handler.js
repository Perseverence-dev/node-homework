// Handle unexpected errors passed to Express.
function errorHandler(err, req, res, next) {
  
  // Explain the common PostgreSQL connection failure in the server console.
  if (err.code === "ECONNREFUSED" && err.port === 5432) {
    console.log(
      "The database connection was refused. Is your database service running?",
    );
  }

  // Log the detailed error for the developer.
  console.error(err);

  // Return a safe message without exposing internal error details.
  return res.status(500).json({
    message: "Internal server error.",
  });
}

module.exports = errorHandler;