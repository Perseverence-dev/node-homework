// Handle unexpected errors passed to Express.

function errorHandler(err, req, res, next) {
  // Explain the common PostgreSQL connection failure in the server console.
  // This is a common error when the database service is not running. Keeping this temporarily while parts of the application still use the pg pool.
  if (err.code === "ECONNREFUSED" && err.port === 5432) {
    console.log(
      "The database connection was refused. Is your database service running?",
    );
  }


  // Explain a Prisma database initialization failure.
  if (err.name === "PrismaClientInitializationError") {
    console.error("Couldn't connect to the database. Is it running?");
  }

  // Log the detailed error for the developer.
  console.error(err);

  // Return a safe message without exposing internal error details.
  return res.status(500).json({
    message: "Internal server error.",
  });
}

module.exports = errorHandler;