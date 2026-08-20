// Allow task requests only when a user is logged in. This middleware should be used for all task routes.
function authMiddleware(req, res, next) {
    // Check if the user is authenticated.
    if (!global.user_id) {
        return res.status(401).json({
        message: "Unauthorized. Please log in.",
        });
    }
    next();
}

module.exports = authMiddleware;