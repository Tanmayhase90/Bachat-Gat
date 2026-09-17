const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');

router.post('/activate', licenseController.activate);
router.post('/verify', licenseController.verify);

module.exports = router;
