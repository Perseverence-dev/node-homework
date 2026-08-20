// Import the Joi schemas to validate new and updated tasks.
const {
  taskSchema,
  patchTaskSchema,
} = require("../validation/taskSchema");

/**
 * Generate sequential IDs for new tasks.
**/
//Javascript closure
    //The outer function runs once 
    const taskCounter = (() => {
    //Private counter
    let lastTaskNumber = 0;

    // Inner function runs every time a new task is created
    return () => {
        lastTaskNumber += 1;
        return lastTaskNumber;
    };
    })(); //() -> Immediately invoked function expression (IIFE) to create a private scope for the counter

//Remove UserId from the task object before sending it to the client. This prevents exposing sensitive information about task ownership.
function sanitizeTask(task) {
  // Object destructuring  
  // const { propertyToExclude, ...remainingProperties } = originalObject;
  const { userId, ...sanitizedTask } = task;

  return sanitizedTask;
}

//JSDoc comments below
/**
 * Create a task for the currently logged-in user.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} The Express response.
 */

function create(req, res) {
  // Joi expects an object, if no body was sent, empty object is used.
  if (!req.body) {
    req.body = {};
  }

  // Validate and clean the submitted task information - Joi Schema is used.
  const { error, value } = taskSchema.validate(req.body, {
    abortEarly: false,
  });

  // If validation fails,task is not stored and a 400 response is returned
  if (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  const newTask = {
    // Generate a unique sequential ID.
    id: taskCounter(),

    // Ownership is stored as the authenticated user's email.
    userId: global.user_id.email,

    // Add the validated Joi schema - title and isCompleted values.
    ...value,
  };

  // Save the complete task, including userId, in memory.
  global.tasks.push(newTask);

  // response sent without exposing userId in the API response.
  return res.status(201).json(sanitizeTask(newTask));
}

/**
 * Index function handles this route: GET /api/tasks
 * Return all tasks belonging to the currently logged-in user.
 * _req - Express request not needed here.
 */
function index(_req, res) {
  // Only select tasks owned by the current user.
  const userTasks = global.tasks.filter(
    (task) => task.userId === global.user_id.email,
  );

  // The route exists, but this user currently has no task records.
  if (userTasks.length === 0) {
    return res.status(404).json({
      message: "No tasks found.",
    });
  }

  // Safe response array without exposing task ownership.
  const sanitizedTasks = userTasks.map((task) => sanitizeTask(task));

  return res.status(200).json(sanitizedTasks);
}

// Controller functions for reading, updating, and deleting tasks.

/**
 * Show function returns one task belonging to the currently logged-in user.
 */
function show(req, res) {
  // Parse Express provided string parameter into a number, since taskIds are numbers.
  const taskId = parseInt(req.params?.id, 10);

  // If task ID is missing or invalid, return a 400 error.
  if (!taskId) {
    return res.status(400).json({
      message: "The task ID passed is not valid.",
    });
  }

  // Match both the task ID and its owner.
  // Prevents a logged-in user from viewing another user's task.
  const task = global.tasks.find(
    (storedTask) =>
      storedTask.id === taskId &&
      storedTask.userId === global.user_id.email,
  );

  // Return 404 when the task does not exist or belongs to another user.
  // Using the same response for both cases avoids revealing private data.
  if (!task) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }

  // Response status 200 with the task data without userId.
  return res.status(200).json(sanitizeTask(task));
}

/**
 * Update function changes one or more fields of a task belonging to the currently logged-in user.
 * Uses the route : PATCH /api/tasks/:id
 */
function update(req, res) {
  // Joi expects an object, so use an empty object if no body was sent.
  if (!req.body) {
    req.body = {};
  }

  // Validate the requested changes before finding or modifying the task.
  const { error, value } = patchTaskSchema.validate(req.body, {
    abortEarly: false,
  });

  //If validation fails, stop before modifying stored data.
  if (error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  // Express provides route parameters as strings, but task IDs are numbers.
  const taskId = parseInt(req.params?.id, 10);

  // Stop the request if the provided task ID is missing or invalid.
  if (!taskId) {
    return res.status(400).json({
      message: "The task ID passed is not valid.",
    });
  }

  // Match both the requested task ID and its owner.
  // This prevents a user from updating another user's task.
  //find() returns the first matching element, in the global.tasks array.
  const task = global.tasks.find(
    (storedTask) =>
      storedTask.id === taskId &&
      storedTask.userId === global.user_id.email,
  );

  // Return 404 when the task does not exist or belongs to another user.
  if (!task) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }

  // Copy only the validated Joi fields onto the existing stored task.
  // Fields not included in the request remain unchanged.
  Object.assign(task, value);

  // Return the updated task without exposing its internal userId.
  return res.status(200).json(sanitizeTask(task));
}

/**
 * DeleteTask function removes a task belonging to the currently logged-in user.
 * Uses the route : DELETE /api/tasks/:id
 */
function deleteTask(req, res) {
  
  const taskId = parseInt(req.params?.id, 10);

  if (!taskId) {
    return res.status(400).json({
      message: "The task ID passed is not valid.",
    });
  }

  // Find the array position of a task that matches both the ID and owner.
  // findIndex() is used to search the array

  const taskIndex = global.tasks.findIndex(
    (storedTask) =>
      storedTask.id === taskId &&
      storedTask.userId === global.user_id.email,
  );

  // findIndex() returns -1 when no matching owned task is found.
  if (taskIndex === -1) {
    return res.status(404).json({
      message: "Task not found.",
    });
  }


  const deletedTask = sanitizeTask(global.tasks[taskIndex]);

  // Splice used to remove the task from the in-memory array.
  global.tasks.splice(taskIndex, 1);

  // Response status 200 with the deleted task
  return res.status(200).json(deletedTask);
}

// Export the controller functions for use by routes/taskRoutes.js.
module.exports = {
  create,
  index,
  show,
  update,
  deleteTask,
};