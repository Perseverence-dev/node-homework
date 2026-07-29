// Handle unexpected errors passed to Express.
function errorHandler(err, req, res, next) {
  // Log the detailed error for the developer.
  console.error(err);

  // Return a safe message without exposing internal error details.
  return res.status(500).json({
    message: "Internal server error.",
  });
}

module.exports = errorHandler;