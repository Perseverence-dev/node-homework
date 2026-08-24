// Import the Joi schemas to validate new and updated tasks.
const {
  taskSchema,
  patchTaskSchema,
} = require("../validation/taskSchema");

// Import the shared Prisma Client.
const prisma = require("../db/prisma");

// JSDoc comments below

/**
 * Create a task for the currently logged-in user.
 *
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
    // Create the validated task and associate it with the logged-in user.
    // PostgreSQL generates the task ID automatically.
    const newTask = await prisma.task.create({
      data: {
        title: value.title,
        isCompleted: value.isCompleted,
        userId: global.user_id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
      },
    });

    // Returns the new task without exposing the internal userId.
    return res.status(201).json(newTask);
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
    // Do not select the internal userId field.
    const tasks = await prisma.task.findMany({
      where: {
        userId: global.user_id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    // The route exists, but this user currently has no task records.
    if (tasks.length === 0) {
      return res.status(404).json({
        message: "No tasks found.",
      });
    }

    // Return only this user's tasks.
    return res.status(200).json(tasks);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

// Controller functions for reading, updating, and deleting tasks.

/**
 * Show function returns one task belonging to the currently logged-in user.
 
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
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        userId: global.user_id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
      },
    });

    // findUnique() returns null when no matching task is found.
    // The same response avoids revealing another user's private data.
    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Return the selected task without exposing userId.
    return res.status(200).json(task);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Update function changes one or more fields of a task belonging to the currently logged-in user.
 * Uses the route: PATCH /api/tasks/:id

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
    // Update only a task matching both the ID and its owner.
    // Prisma accepts the validated camelCase fields directly.
    const updatedTask = await prisma.task.update({
      where: {
        id: taskId,
        userId: global.user_id,
      },
      data: taskChange,
      select: {
        id: true,
        title: true,
        isCompleted: true,
      },
    });

    // Return the updated task without exposing userId.
    return res.status(200).json(updatedTask);
  } catch (err) {
    // Prisma error P2025 means no matching owned task was found.
    if (err.code === "P2025") {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Unexpected database errors passed to the global error handler.
    return next(err);
  }
}

/**
 * DeleteTask function removes a task belonging to the currently logged-in user.
 * Uses the route: DELETE /api/tasks/:id
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
    // Prisma returns the deleted task for the response.
    const deletedTask = await prisma.task.delete({
      where: {
        id: taskId,
        userId: global.user_id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
      },
    });

    // Without exposing userId, return the deleted task.
    return res.status(200).json(deletedTask);
  } catch (err) {
    // Prisma error P2025 means no matching owned task was found.
    if (err.code === "P2025") {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Unexpected database errors passed to the global error handler.
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