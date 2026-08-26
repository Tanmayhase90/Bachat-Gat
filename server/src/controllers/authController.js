const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logActivity, createNotification } = require('../utils/logger');

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and Password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, phone, password, role, role_name, is_active FROM users WHERE email = ? OR name = ?',
      [email.trim(), email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const roleName = user.role_name || user.role || 'MEMBER';

    // Get group & member context if available
    const [memberRows] = await pool.query(
      `SELECT gm.id as member_id, gm.member_code, gm.group_id, g.group_name 
       FROM group_members gm 
       JOIN \`groups\` g ON gm.group_id = g.id 
       WHERE gm.user_id = ? AND gm.is_active = 1 LIMIT 1`,
      [user.id]
    );

    const memberInfo = memberRows.length > 0 ? memberRows[0] : null;

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: roleName,
      role_name: roleName,
      name: user.name,
      groupId: memberInfo ? memberInfo.group_id : 1,
      memberId: memberInfo ? memberInfo.member_id : null,
    };

    const secret = process.env.JWT_SECRET || 'bachat_gat_super_secret_jwt_key_2026_internship_production';
    const token = jwt.sign(tokenPayload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    // Write activity log
    await logActivity(
      tokenPayload.groupId,
      user.id,
      'USER_LOGIN',
      `${user.name} logged into Bachat Gat system`
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: roleName,
        role_name: roleName,
        groupId: tokenPayload.groupId,
        memberId: tokenPayload.memberId,
        memberCode: memberInfo ? memberInfo.member_code : null,
        groupName: memberInfo ? memberInfo.group_name : 'Chhatrapati Bachat Gat',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    const [userRows] = await pool.query(
      'SELECT id, name, email, phone, role, role_name, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userRows[0];
    const roleName = user.role_name || user.role || 'MEMBER';

    const [memberRows] = await pool.query(
      `SELECT gm.id as member_id, gm.member_code, gm.joined_date, gm.monthly_contribution, gm.group_id, g.group_name, g.group_code 
       FROM group_members gm 
       JOIN \`groups\` g ON gm.group_id = g.id 
       WHERE gm.user_id = ? LIMIT 1`,
      [user.id]
    );

    const member = memberRows.length > 0 ? memberRows[0] : null;

    res.json({
      success: true,
      user: {
        ...user,
        role: roleName,
        role_name: roleName,
        groupId: member ? member.group_id : 1,
        memberId: member ? member.member_id : null,
        memberCode: member ? member.member_code : null,
        joinedDate: member ? member.joined_date : null,
        monthlyContribution: member ? member.monthly_contribution : 1000,
        groupName: member ? member.group_name : 'Chhatrapati Bachat Gat',
        groupCode: member ? member.group_code : 'shivshahi_group_001',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/profile
 */
async function updateProfile(req, res, next) {
  try {
    const { name, phone, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (name || phone !== undefined) {
      await pool.query(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
        [name ? name.trim() : null, phone ? phone.trim() : null, userId]
      );
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to change password.' });
      }

      const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
      const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password does not match.' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
    }

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe,
  updateProfile,
};
