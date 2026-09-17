const express = require('express');
const router = express.Router();
const { create, bulkCreate, index, show, update, deleteTask, } = require('../controllers/taskController');      

// Define routes for tasks
router.get('/', index);
// Defining the specific bulk route before routes containing the dynamic :id parameter.
//Placing specific routes before dynamic routes is a professional convention.
router.post('/bulk', bulkCreate);
router.post('/', create);
router.get('/:id', show);
router.patch('/:id', update);
router.delete('/:id', deleteTask);

module.exports = router;    