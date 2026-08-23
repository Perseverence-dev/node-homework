// Import Node's built-in crypto module for password hashing,
// random salt generation, and secure hash comparison.
const crypto = require("crypto");

// Import util so crypto.scrypt() can be converted
// from callback style to Promise style.
const util = require("util");

// Import the Joi schema used to validate registration data.
const { userSchema } = require("../validation/userSchema");

// Import the PostgreSQL connection pool.
const pool = require("../db/pg-pool");

// Convert crypto.scrypt() into a Promise-based function
// so it can be used with async and await.
const scrypt = util.promisify(crypto.scrypt);

/**
 * Create a salted password hash.
 *
 * @param {string} password - The user's original password.
 * @returns {Promise<string>} The salt and hash in "salt:hash" format.
 */
async function hashPassword(password) {
  // Generate a unique random salt for this password.
  const salt = crypto.randomBytes(16).toString("hex");

  // Derive a 64-byte key from the password and salt.
  const derivedKey = await scrypt(password, salt, 64);

  // Store the salt and hash together.
  // The salt is needed later to verify a submitted password.
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Compare a submitted password with a stored password hash.
 *
 * @param {string} inputPassword - Password submitted during logon.
 * @param {string} storedHash - Stored value in "salt:hash" format.
 * @returns {Promise<boolean>} Whether the password is correct.
 */
async function comparePassword(inputPassword, storedHash) {
  // Separate the stored salt from the stored hash.
  const [salt, key] = storedHash.split(":");

  // Convert the stored hexadecimal hash back into a Buffer.
  const keyBuffer = Buffer.from(key, "hex");

  // Hash the submitted password using the original salt.
  const derivedKey = await scrypt(inputPassword, salt, 64);

  // Compare the two hashes using a timing-safe comparison.
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Register a new user.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function register(req, res, next) {
  // Joi expects an object. If no request body was sent,
  // use an empty object so validation can return a 400 response.
  if (!req.body) {
    req.body = {};
  }

  // Validate and clean the submitted registration data.
  // abortEarly: false reports all validation problems
  // instead of stopping after the first problem.
  const { error, value } = userSchema.validate(req.body, {
    abortEarly: false,
  });

  // Stop before hashing or storing anything if validation fails.
  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      details: error.details,
    });
  }

  // Use Joi's validated and cleaned values.
  // Joi may trim the name and lowercase the email.
  const { name, email, password } = value;

  // Hash the validated password before storing the user.
  const hashedPassword = await hashPassword(password);

  try {
    // Insert the new user using parameter placeholders.
    // RETURNING sends back only the safe columns needed by the application.
    const result = await pool.query(
      `INSERT INTO users (email, name, hashed_password)
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, name, hashedPassword],
    );

    // PostgreSQL returns inserted rows inside result.rows.
    const newUser = result.rows[0];

    // Temporarily store the new user's numeric database ID.
    global.user_id = newUser.id;

    // Return only public user information.
    // Do not return id, password, or hashed_password.
    return res.status(201).json({
      name: newUser.name,
      email: newUser.email,
    });
  } catch (err) {
    // PostgreSQL error 23505 means a UNIQUE constraint was violated.
    // In this case, the submitted email already exists.
    if (err.code === "23505") {
      return res.status(400).json({
        message: "Email is already registered.",
      });
    }

    // Pass all unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Handle a user logon request.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function logon(req, res, next) {
  // Read the submitted credentials.
  // The password is used only for comparison and is not stored.
  const { email, password } = req.body || {};

  try {
    // Find a user with the submitted email.
    // $1 is a parameter placeholder that prevents SQL injection.
    const result = await pool.query(
      "SELECT id, email, name, hashed_password FROM users WHERE email = $1",
      [email],
    );

    // result.rows is empty when no matching user exists.
    const matchingUser = result.rows[0];

    // Compare the submitted password with the stored hash.
    // Short-circuit evaluation prevents comparePassword()
    // from running when no user was found.
    const goodCredentials =
      matchingUser &&
      password &&
      (await comparePassword(password, matchingUser.hashed_password));

    // Return the same generic response whether the email
    // or password was incorrect.
    if (!goodCredentials) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Store the authenticated user's numeric database ID.
    global.user_id = matchingUser.id;

    // Return only safe, public information.
    return res.status(200).json({
      name: matchingUser.name,
      email: matchingUser.email,
    });
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Handle a user logoff request.
 *
 * @param {object} _req - Express request object; not used here.
 * @param {object} res - Express response object.
 * @returns {object} The Express response.
 */
function logoff(_req, res) {
  // Clear the currently logged-in user.
  global.user_id = null;

  // Return a successful response.
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