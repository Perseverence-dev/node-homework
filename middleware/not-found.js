// Handle requests that did not match any application route.
function notFound(req, res) {
  return res.status(404).json({
    message: `No route found for ${req.method} ${req.path}`,
  });
}

module.exports = notFound;