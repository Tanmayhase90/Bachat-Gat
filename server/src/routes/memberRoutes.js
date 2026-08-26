const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const authenticateToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, memberController.getAllMembers);
router.get('/:id', authenticateToken, memberController.getMemberById);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SECRETARY'), memberController.createMember);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'SECRETARY'), memberController.updateMember);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), memberController.deleteMember);

module.exports = router;
