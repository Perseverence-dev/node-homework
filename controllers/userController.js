// Import Node's built-in crypto module for password hashing,
// random salt generation, and secure hash comparison.
const crypto = require("crypto");

// Import util so crypto.scrypt() can be converted
// from callback style to Promise style.
const util = require("util");

// Import jsonwebtoken to create the signed JWT for the cookie.
const jwt = require("jsonwebtoken");

// Import the Joi schema used to validate registration data.
const { userSchema } = require("../validation/userSchema");

// Import the shared Prisma Client.
const prisma = require("../db/prisma");

// Convert crypto.scrypt() into a Promise-based function
// so it can be used with async and await.
const scrypt = util.promisify(crypto.scrypt);

// Cookie settings shared by logon, register, and logoff.
// The secure flag is only turned on in production, where HTTPS is available.
const cookieFlags = (req) => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  };
};

// Create a signed JWT and store it in an HttpOnly cookie.
// The JWT holds the user's id and a fresh CSRF token.
// The CSRF token is returned so it can go in the response body.
const setJwtCookie = (req, res, user) => {
  const payload = { id: user.id, csrfToken: crypto.randomUUID() };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.cookie("jwt", token, { ...cookieFlags(req), maxAge: 3600000 }); // 1 hour
  return payload.csrfToken;
};

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
 * Register a new user and create three welcome tasks in one transaction.
 */
async function register(req, res, next) {
  // Joi expects an object. If no request body was sent, use an empty object so validation can return a 400 response.
  if (!req.body) {
    req.body = {};
  }

  // Validate and clean the submitted registration data.
  // abortEarly: false reports all validation problems instead of stopping after the first problem.
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
    // Run user and welcome-task creation as one atomic operation.
    // If any operation fails, Prisma rolls back the entire transaction.
    const result = await prisma.$transaction(async (tx) => {
      // Create the user through the transaction client.
      // select returns only safe fields needed by the application.
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });

      // Prepare the three required welcome tasks.
      const welcomeTaskData = [
        {
          title: "Complete your profile",
          priority: "medium",
          userId: newUser.id,
        },
        {
          title: "Add your first task",
          priority: "high",
          userId: newUser.id,
        },
        {
          title: "Explore the app",
          priority: "low",
          userId: newUser.id,
        },
      ];

      // Insert all three welcome tasks with one database operation.
      await tx.task.createMany({
        data: welcomeTaskData,
      });

      // Retrieve the created tasks because createMany returns only a count.
      const welcomeTasks = await tx.task.findMany({
        where: {
          userId: newUser.id,
          title: {
            in: welcomeTaskData.map((task) => task.title),
          },
        },
        select: {
          id: true,
          title: true,
          isCompleted: true,
          userId: true,
          priority: true,
        },
      });

      // Return the transaction results to the outer register function.
      return {
        user: newUser,
        welcomeTasks,
      };
    });

    // Start the session by setting the JWT cookie.
    // The CSRF token goes back in the body so the client can send it in headers later.
    const csrfToken = setJwtCookie(req, res, result.user);

    // Return only public user information and the welcome tasks.
    return res.status(201).json({
      name: result.user.name,
      email: result.user.email,
      csrfToken,
      user: result.user,
      welcomeTasks: result.welcomeTasks,
      transactionStatus: "success",
    });
  } catch (err) {
    // Prisma error P2002 means a UNIQUE constraint was violated.
    // In this case, the submitted email already exists.
    if (
      err.name === "PrismaClientKnownRequestError" &&
      err.code === "P2002"
    ) {
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

  // Normalize a submitted string email before searching.
  // Registration already lowercases email through the Joi schema.
  const normalizedEmail =
    typeof email === "string" ? email.toLowerCase() : email;

  try {

   // Find the user through the unique email column.
   // Select only the fields required to verify credentials and build the response.
      const matchingUser = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
          name: true,
          email: true,

          // hashedPassword is required internally for password verification, never included in the API response.
          hashedPassword: true,
  },
      });

    // Compare the submitted password with the stored hash.
    // Short-circuit evaluation prevents comparePassword()
    // from running when no user or password was provided.
    const goodCredentials =
      matchingUser &&
      password &&
      (await comparePassword(password, matchingUser.hashedPassword));

    // Return the same generic response whether the email
    // or password was incorrect.
    if (!goodCredentials) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Start the session by setting the JWT cookie for this user.
    const csrfToken = setJwtCookie(req, res, matchingUser);

    // Return only safe, public information plus the CSRF token.
    return res.status(200).json({
      name: matchingUser.name,
      email: matchingUser.email,
      csrfToken,
    });
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Handle a user logoff request.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} The Express response.
 */
function logoff(req, res) {
  // End the session by clearing the JWT cookie.
  // The same flags used when setting the cookie are needed to clear it.
  res.clearCookie("jwt", cookieFlags(req));

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