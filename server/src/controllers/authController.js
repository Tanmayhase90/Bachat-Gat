const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logActivity, createNotification } = require('../utils/logger');

/**
 * Helper to fetch active group info dynamically from database
 */
async function getGroupInfoForUser(userId, explicitGroupId = null) {
  // 1. Check if user is linked in group_members
  const [memberRows] = await pool.query(
    `SELECT gm.id as member_id, gm.member_code, gm.joined_date, gm.monthly_contribution, gm.group_id, g.group_name, g.group_code 
     FROM group_members gm 
     JOIN \`groups\` g ON gm.group_id = g.id 
     WHERE gm.user_id = ? AND gm.is_active = 1 LIMIT 1`,
    [userId]
  );

  if (memberRows.length > 0) {
    return {
      groupId: memberRows[0].group_id,
      memberId: memberRows[0].member_id,
      memberCode: memberRows[0].member_code,
      joinedDate: memberRows[0].joined_date,
      monthlyContribution: parseFloat(memberRows[0].monthly_contribution) || 1000,
      groupName: memberRows[0].group_name,
      groupCode: memberRows[0].group_code,
    };
  }

  // 2. Fallback: Query groups table directly
  const targetGroupId = explicitGroupId || 1;
  const [groupRows] = await pool.query(
    'SELECT id, group_name, group_code, monthly_contribution_per_share FROM `groups` WHERE id = ? OR 1=1 ORDER BY id ASC LIMIT 1',
    [targetGroupId]
  );

  if (groupRows.length > 0) {
    return {
      groupId: groupRows[0].id,
      memberId: null,
      memberCode: null,
      joinedDate: null,
      monthlyContribution: parseFloat(groupRows[0].monthly_contribution_per_share) || 1000,
      groupName: groupRows[0].group_name,
      groupCode: groupRows[0].group_code,
    };
  }

  return {
    groupId: 1,
    memberId: null,
    memberCode: null,
    joinedDate: null,
    monthlyContribution: 1000,
    groupName: 'Bachat Gat',
    groupCode: 'group_001',
  };
}

/**
 * POST /api/auth/register
 * Self-registration for new group members
 */
async function register(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { fullName, name, email, phone, password, confirmPassword } = req.body;
    const userName = (fullName || name || '').trim();
    const userEmail = (email || '').trim().toLowerCase();
    const userPhone = (phone || '').trim();

    // 1. Validate required fields
    if (!userName || !userEmail || !userPhone || !password || !confirmPassword) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'All fields (Full Name, Email, Phone, Password, Confirm Password) are required.',
      });
    }

    // 2. Validate Full Name
    if (userName.length < 2) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Full Name must be at least 2 characters.',
      });
    }

    // 3. Validate Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    // 4. Validate Phone Number (10 to 15 digits)
    const cleanPhone = userPhone.replace(/[\s\-+()]/g, '');
    if (cleanPhone.length < 10 || isNaN(cleanPhone)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number with at least 10 digits.',
      });
    }

    // 5. Validate Password standards
    if (password.length < 6) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 6. Check Password Confirmation
    if (password !== confirmPassword) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    // 7. Check if Email already exists
    const [existingEmailRows] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [userEmail]
    );

    if (existingEmailRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Email is already registered. Please login to continue.',
      });
    }

    // 8. Check if Phone number already exists
    const [existingPhoneRows] = await connection.query(
      'SELECT id FROM users WHERE phone = ?',
      [userPhone]
    );

    if (existingPhoneRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Phone number is already registered with another account.',
      });
    }

    // 9. Hash Password securely using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 10. Insert User with default role = MEMBER
    const [userResult] = await connection.query(
      'INSERT INTO users (name, email, phone, password, role, role_name, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [userName, userEmail, userPhone, hashedPassword, 'MEMBER', 'MEMBER']
    );
    const newUserId = userResult.insertId;

    // 11. Connect new user to the default group if exists
    const [groups] = await connection.query('SELECT id, monthly_contribution_per_share FROM `groups` LIMIT 1');
    let groupId = 1;
    let monthlyShare = 1000.00;

    if (groups.length > 0) {
      groupId = groups[0].id;
      monthlyShare = parseFloat(groups[0].monthly_contribution_per_share) || 1000.00;
    }

    const memberCode = `MEM-${String(newUserId).padStart(3, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    await connection.query(
      'INSERT INTO group_members (group_id, user_id, member_code, joined_date, monthly_contribution, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [groupId, newUserId, memberCode, today, monthlyShare]
    );

    // 12. Create Welcome Notification & Activity Log
    await logActivity(
      groupId,
      newUserId,
      'USER_REGISTERED',
      `${userName} self-registered as a new member (${memberCode})`,
      connection
    );

    await createNotification(
      newUserId,
      groupId,
      'Welcome to Bachat Gat',
      `Your account has been registered successfully as member ${memberCode}. You can now contribute savings and apply for loans.`,
      'SUCCESS',
      connection
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please login to continue.',
      userId: newUserId,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

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

    // Get fresh dynamic group & member context from database
    const groupInfo = await getGroupInfoForUser(user.id);

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: roleName,
      role_name: roleName,
      name: user.name,
      groupId: groupInfo.groupId,
      memberId: groupInfo.memberId,
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
        groupId: groupInfo.groupId,
        memberId: groupInfo.memberId,
        memberCode: groupInfo.memberCode,
        groupName: groupInfo.groupName,
        groupCode: groupInfo.groupCode,
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

    // Get fresh dynamic group & member context from database
    const groupInfo = await getGroupInfoForUser(user.id, req.user.groupId);

    res.json({
      success: true,
      user: {
        ...user,
        role: roleName,
        role_name: roleName,
        groupId: groupInfo.groupId,
        memberId: groupInfo.memberId,
        memberCode: groupInfo.memberCode,
        joinedDate: groupInfo.joinedDate,
        monthlyContribution: groupInfo.monthlyContribution,
        groupName: groupInfo.groupName,
        groupCode: groupInfo.groupCode,
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
  register,
  login,
  getMe,
  updateProfile,
};
