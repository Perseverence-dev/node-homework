const express = require('express');
const router = express.Router();
const { create, index, show, update, deleteTask, } = require('../controllers/taskController');      

// Define routes for tasks
router.get('/', index);
router.post('/', create);
router.get('/:id', show);
router.patch('/:id', update);
router.delete('/:id', deleteTask);

module.exports = router;    