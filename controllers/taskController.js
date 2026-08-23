// Import the Joi schemas to validate new and updated tasks.
const {
  taskSchema,
  patchTaskSchema,
} = require("../validation/taskSchema");

// Import the PostgreSQL connection pool.
const pool = require("../db/pg-pool");

// JSDoc comments below

/**
 * Create a task for the currently logged-in user.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function create(req, res, next) {
  // Joi expects an object; if no body was sent, an empty object is used.
  if (!req.body) {
    req.body = {};
  }

  // Validate and clean the submitted task information using Joi.
  const { error, value } = taskSchema.validate(req.body, {
    abortEarly: false,
  });

  // If validation fails, the task is not stored and a 400 response is returned.
  if (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  try {
    // Insert the validated task and associate it with the logged-in user.
    // PostgreSQL generates the task ID automatically.
    const result = await pool.query(
      `INSERT INTO tasks (title, is_completed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, is_completed`,
      [value.title, value.isCompleted, global.user_id],
    );

    // Return the new task without exposing the internal user_id.
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Index function handles this route: GET /api/tasks
 * Return all tasks belonging to the currently logged-in user.
 *
 * @param {object} _req - Express request object; not used here.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function index(_req, res, next) {
  try {
    // Select only tasks owned by the current user.
    // Do not select the internal user_id column.
    const result = await pool.query(
      `SELECT id, title, is_completed
       FROM tasks
       WHERE user_id = $1
       ORDER BY id`,
      [global.user_id],
    );

    // The route exists, but this user currently has no task records.
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No tasks found.",
      });
    }

    // Return only this user's tasks.
    return res.status(200).json(result.rows);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

// Controller functions for reading, updating, and deleting tasks.

/**
 * Show function returns one task belonging to the currently logged-in user.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function show(req, res, next) {
  // Express provides route parameters as strings.
  const taskId = Number(req.params?.id);

  // A task ID must be a positive integer.
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      message: "The task ID passed is not valid.",
    });
  }

  try {
    // Match both the task ID and its owner.
    // This prevents one user from viewing another user's task.
    const result = await pool.query(
      `SELECT id, title, is_completed
       FROM tasks
       WHERE id = $1 AND user_id = $2`,
      [taskId, global.user_id],
    );

    // Return 404 when the task does not exist or belongs to another user.
    // The same response avoids revealing another user's private data.
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Return the selected task without exposing user_id.
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Update function changes one or more fields of a task belonging
 * to the currently logged-in user.
 * Uses the route: PATCH /api/tasks/:id
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function update(req, res, next) {
  // Joi expects an object, so use an empty object if no body was sent.
  if (!req.body) {
    req.body = {};
  }

  // Validate the requested changes before modifying the task.
  const { error, value: taskChange } = patchTaskSchema.validate(req.body, {
    abortEarly: false,
  });

  // If validation fails, stop before modifying stored data.
  if (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  // Express provides route parameters as strings.
  const taskId = Number(req.params?.id);

  // A task ID must be a positive integer.
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      message: "The task ID passed is not valid.",
    });
  }

  try {
    // Get the validated JavaScript field names.
    let keys = Object.keys(taskChange);

    // Convert camelCase JavaScript names to snake_case database names.
    keys = keys.map((key) =>
      key === "isCompleted" ? "is_completed" : key,
    );

    // Build a parameterized SET clause.
    // Example: "title = $1, is_completed = $2"
    const setClauses = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(", ");

    // The task ID comes after all updated field values.
    const idParameter = `$${keys.length + 1}`;

    // The user ID is the final parameter.
    const userParameter = `$${keys.length + 2}`;

    // Update only a task matching both the ID and its owner.
    const result = await pool.query(
      `UPDATE tasks
       SET ${setClauses}
       WHERE id = ${idParameter} AND user_id = ${userParameter}
       RETURNING id, title, is_completed`,
      [...Object.values(taskChange), taskId, global.user_id],
    );

    // Return 404 if the task does not exist or belongs to another user.
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Return the updated task without exposing user_id.
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * DeleteTask function removes a task belonging to the currently logged-in user.
 * Uses the route: DELETE /api/tasks/:id
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express function for passing unexpected errors.
 * @returns {Promise<object>} The Express response.
 */
async function deleteTask(req, res, next) {
  // Express provides route parameters as strings.
  const taskId = Number(req.params?.id);

  // A task ID must be a positive integer.
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      message: "The task ID passed is not valid.",
    });
  }

  try {
    // Delete only a task matching both the ID and its owner.
    // RETURNING provides the deleted task for the response.
    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, is_completed`,
      [taskId, global.user_id],
    );

    // Return 404 if no matching owned task was deleted.
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Return the deleted task without exposing user_id.
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

// Export the controller functions for use by routes/taskRoutes.js.
module.exports = {
  create,
  index,
  show,
  update,
  deleteTask,
};