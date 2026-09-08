// Import jsonwebtoken to verify the JWT stored in the cookie.
const jwt = require("jsonwebtoken");

// Small helper so every failed check returns the same 401 response.

const send401 = (res) => {
  return res.status(401).json({
    message: "No user is authenticated.",
  });
};

// Protect routes by checking the JWT cookie on every request.
module.exports = (req, res, next) => {
  // The cookie-parser middleware puts cookies on req.cookies.
  const token = req?.cookies?.jwt;

  // No cookie means the user never logged on.
  if (!token) {
    return send401(res);
  }

  // Verify the signature and expiration using our secret.
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    // A bad or expired token is rejected.
    if (err) {
      return send401(res);
    }

    // Store the user's id on the request for access control.
    // This replaces the old global.user_id approach.
    req.user = { id: decoded.id };

    // Write operations also need a matching CSRF token in the header.
    if (["POST", "PATCH", "PUT", "DELETE", "CONNECT"].includes(req.method)) {
      if (req.get("X-CSRF-TOKEN") !== decoded.csrfToken) {
        return send401(res);
      }
    }

    // All checks passed, so let the request continue.
    next();
  });
};