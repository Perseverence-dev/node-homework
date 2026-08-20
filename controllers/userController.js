/**
 * Register a new user.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} The Express response.
 */
function register(req, res) {
  // Read the submitted registration information from the JSON request body.
  const { name, email, password } = req.body;

  // Create the user object that will be stored temporarily in memory.
  const newUser = {
    name,
    email,
    password,
  };

  // Add the new user to the temporary in-memory users array.
  global.users.push(newUser);

  // Treat the newly registered user as the currently logged-in user.
  global.user_id = newUser;

  // Return the public user information without exposing the password.
  return res.status(201).json({
    name: newUser.name,
    email: newUser.email,
  });
}

/**
 * Handle a user logon request.
*/
 function logon(req, res) {
  // Read the submitted credentials from the JSON request body.
  const { email, password } = req.body;

  // Find the first user whose email and password both match.
  const matchingUser = global.users.find(
    (user) => user.email === email && user.password === password,
  );

  // If find() did not locate a matching user, reject the request.
  if (!matchingUser) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  // Store the authenticated user as the currently logged-in user.
  global.user_id = matchingUser;

  // Return only safe, public information.
  return res.status(200).json({
    name: matchingUser.name,
    email: matchingUser.email,
  });
}

/**
 * Handle a user logoff request.
*/
function logoff(_req, res) {
  // Clear the currently logged-in user.
  global.user_id = null;

  // Return a success message.
  return res.status(200).json({
    message: "Logged off successfully.",
  });
}

// Allow the router to import these controller functions.
module.exports = {
  register,
  logon,
  logoff,
};