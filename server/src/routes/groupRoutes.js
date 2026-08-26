const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authenticateToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, groupController.getGroupDetails);
router.put('/', authenticateToken, authorizeRoles('ADMIN'), groupController.updateGroupDetails);

module.exports = router;
