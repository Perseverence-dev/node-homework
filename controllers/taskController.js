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
        priority: value.priority,
        userId: req.user.id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
      },
    });

    // Return the new task without exposing the internal userId.
    return res.status(201).json(newTask);
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Create multiple tasks for the currently logged-in user.
 */
async function bulkCreate(req, res, next) {
  // Read the tasks array from the request body.
  const { tasks } = req.body || {};

  // The request must contain a non-empty tasks array.
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      message: "Invalid request data. Expected a non-empty array of tasks.",
    });
  }

  // Store validated tasks here before inserting anything.
  const validTasks = [];

  // Validate every submitted task using the existing creation schema.
  for (const task of tasks) {
    const { error, value } = taskSchema.validate(task, {
      abortEarly: false,
    });

    // Stop before any database insertion if one task is invalid.
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        details: error.details,
      });
    }

    // Add the authenticated user's ID to each validated task.
    validTasks.push({
      title: value.title,
      isCompleted: value.isCompleted,
      priority: value.priority,
      userId: req.user.id,
    });
  }

  try {
    // Insert all validated tasks in one database operation.
    const result = await prisma.task.createMany({
      data: validTasks,
      skipDuplicates: false,
    });

    // createMany returns the number of records created.
    return res.status(201).json({
      message: "Bulk task creation successful",
      tasksCreated: result.count,
      totalRequested: validTasks.length,
    });
  } catch (err) {
    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

/**
 * Index function handles this route: GET /api/tasks
 * Return one page of tasks belonging to the currently logged-in user.
 * Eagerly load safe information about the user who owns each task.
 * Support case-insensitive title search and pagination.
 */
async function index(req, res, next) {
  // Use default pagination values when page and limit are not provided.
  const page =
    req.query.page === undefined ? 1 : Number(req.query.page);
  const limit =
    req.query.limit === undefined ? 10 : Number(req.query.limit);

  // Page must be a positive whole number.
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({
      message: "Page must be a positive integer.",
    });
  }

  // Limit must be a whole number within the allowed range.
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: "Limit must be an integer between 1 and 100.",
    });
  }

  // Calculate how many matching tasks Prisma should skip.
  const skip = (page - 1) * limit;

  // Select only tasks owned by the current user.
  const whereClause = {
    userId: req.user.id,
  };

  // Read and clean the optional title search parameter.
  const searchTerm =
    typeof req.query.find === "string" ? req.query.find.trim() : "";

  // Add a case-insensitive title filter when find is provided.
  if (searchTerm) {
    whereClause.title = {
      contains: searchTerm,
      mode: "insensitive",
    };
  }

  try {
    // Retrieve one page of tasks owned by the current user.
    // Do not select the internal userId field.
    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
        createdAt: true,

        // Eagerly load only safe public information about the task owner.
        User: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Return 404 when this user has no tasks matching the request.
    if (tasks.length === 0) {
      return res.status(404).json({
        message: "No tasks found.",
      });
    }

    // Count all tasks matching the same ownership and search filters.
    const totalTasks = await prisma.task.count({
      where: whereClause,
    });

    // Build pagination information for the API client.
    const pagination = {
      page,
      limit,
      total: totalTasks,
      pages: Math.ceil(totalTasks / limit),
      hasNext: page * limit < totalTasks,
      hasPrev: page > 1,
    };

    // Return this user's tasks and the pagination information.
    return res.status(200).json({
      tasks,
      pagination,
    });
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
        userId: req.user.id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
        createdAt: true,

        // Eagerly load only safe public information about the task owner.
        User: {
          select: {
            name: true,
            email: true,
          },
        },
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
 * Update function changes one or more fields of a task belonging
 * to the currently logged-in user.
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
        userId: req.user.id,
      },
      data: taskChange,
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
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

    // Pass unexpected database errors to the global error handler.
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
        userId: req.user.id,
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
      },
    });

    // Return the deleted task without exposing userId.
    return res.status(200).json(deletedTask);
  } catch (err) {
    // Prisma error P2025 means no matching owned task was found.
    if (err.code === "P2025") {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Pass unexpected database errors to the global error handler.
    return next(err);
  }
}

// Export the controller functions for use by routes/taskRoutes.js.
module.exports = {
  create,
  bulkCreate,
  index,
  show,
  update,
  deleteTask,
};