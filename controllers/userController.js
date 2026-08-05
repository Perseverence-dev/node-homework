// Import Node's built-in crypto module for password hashing,
// random salt generation, and secure hash comparison.
const crypto = require("crypto");

// Import util so crypto.scrypt() can be converted
// from callback style to Promise style.
const util = require("util");

// Import the Joi schema used to validate registration data.
const { userSchema } = require("../validation/userSchema");

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
 * @returns {Promise<object>} The Express response.
 */
async function register(req, res) {
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
      message: error.message,
    });
  }

  // Use Joi's validated and cleaned values.
  // Joi may trim the name and lowercase the email.
  const { name, email, password } = value;

  // Hash the validated password before storing the user.
  const hashedPassword = await hashPassword(password);

  // Store only the password hash.
  // Never store the original plain-text password.
  const newUser = {
    name,
    email,
    hashedPassword,
  };

  // Add the user to the temporary in-memory users array.
  global.users.push(newUser);

  // Temporary debugging: display only safe user information.
console.log(
  "Registered users:",
  global.users.map(({ name, email }) => ({ name, email })),
);

// Treat the newly registered user as the currently logged-in user.
global.user_id = newUser;

  // Treat the newly registered user as the logged-in user.
  global.user_id = newUser;

  // Return only public user information.
  // Do not return password or hashedPassword.
  return res.status(201).json({
    name: newUser.name,
    email: newUser.email,
  });
}

/**
 * Handle a user logon request.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} The Express response.
 */
async function logon(req, res) {
  // Read the submitted credentials.
  // The password is used only for comparison and is not stored.
  const { email, password } = req.body || {};

  // Find the user by email only.
  // We can no longer compare the submitted password directly
  // because the original password is not stored.
  const matchingUser = global.users.find(
    (user) => user.email === email,
  );

  // Compare the submitted password with the stored hash.
  // Short-circuit evaluation prevents comparePassword()
  // from running when no user was found.
  const goodCredentials =
    matchingUser &&
    (await comparePassword(password, matchingUser.hashedPassword));

  // Return the same generic response whether the email
  // or password was incorrect.
  if (!goodCredentials) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  // Store the authenticated user as the logged-in user.
  global.user_id = matchingUser;

  // Return only safe, public information.
  return res.status(200).json({
    name: matchingUser.name,
    email: matchingUser.email,
  });
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