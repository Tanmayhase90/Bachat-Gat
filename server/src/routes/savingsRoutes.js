const express = require('express');
const router = express.Router();
const savingsController = require('../controllers/savingsController');
const authenticateToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, savingsController.getAllSavings);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'TREASURER'), savingsController.recordSavings);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'TREASURER'), savingsController.updateSavings);

module.exports = router;
