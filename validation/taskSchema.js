const Joi = require("joi");

//taskSchema is used to validate the request body when creating a new task. It ensures that the title is a string between 3 and 30 characters long and that isCompleted is a boolean value (defaulting to false if not provided).
const taskSchema = Joi.object({
  title: Joi.string().trim().min(3).max(30).required(),
  isCompleted: Joi.boolean().default(false).not(null),
});

// Define a schema for validating task data when updating a task.
// patchTaskSchema is used to validate the request body when updating an existing task. It allows for partial updates, meaning that either the title or isCompleted can be provided, but at least one of them must be present. 
const patchTaskSchema = Joi.object({
  title: Joi.string().trim().min(3).max(30).not(null),
  isCompleted: Joi.boolean().not(null),
})
  .min(1)
  .message("No attributes to change were specified.");

module.exports = {
  taskSchema,
  patchTaskSchema,
};