const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const secret = process.env.JWT_SECRET || 'bachat_gat_super_secret_jwt_key_2026_internship_production';
    const decoded = jwt.verify(token, secret);

    // Fetch fresh user details including role_name
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, role, role_name, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({ success: false, message: 'User account is inactive or not found.' });
    }

    req.user = rows[0];
    req.user.role_name = req.user.role_name || req.user.role || 'MEMBER';

    // Also attach default group id for convenience
    const [groupRows] = await pool.query(
      'SELECT group_id, id as member_id FROM group_members WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (groupRows.length > 0) {
      req.user.groupId = groupRows[0].group_id;
      req.user.memberId = groupRows[0].member_id;
    } else {
      req.user.groupId = 1;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please login again.' });
    }
    return res.status(403).json({ success: false, message: 'Invalid token.' });
  }
}

module.exports = authenticateToken;
