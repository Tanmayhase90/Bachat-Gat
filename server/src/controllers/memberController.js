const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { logActivity, createNotification } = require('../utils/logger');

/**
 * GET /api/members
 * Get all members in the group with aggregated metrics
 */
async function getAllMembers(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const { search, status, month, year } = req.query;

    const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;
    const currentYear = parseInt(year, 10) || new Date().getFullYear();

    let query = `
      SELECT 
        gm.id as member_id,
        gm.member_code,
        gm.joined_date,
        gm.monthly_contribution,
        gm.is_active as member_active,
        u.id as user_id,
        u.name,
        u.email,
        u.phone,
        COALESCE(u.role_name, u.role, 'MEMBER') as role_name,
        COALESCE((SELECT SUM(amount) FROM savings WHERE member_id = gm.id AND group_id = gm.group_id), 0) as total_savings,
        COALESCE((SELECT SUM(outstanding_amount) FROM loans WHERE member_id = gm.id AND status = 'ACTIVE'), 0) as outstanding_loans,
        (SELECT COUNT(*) FROM loans WHERE member_id = gm.id AND status = 'ACTIVE') as active_loans_count,
        EXISTS(SELECT 1 FROM savings WHERE member_id = gm.id AND month = ? AND year = ?) as has_paid_current_month
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `;

    const params = [currentMonth, currentYear, groupId];

    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR gm.member_code LIKE ? OR u.phone LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (status === 'active') {
      query += ` AND gm.is_active = 1`;
    } else if (status === 'inactive') {
      query += ` AND gm.is_active = 0`;
    }

    query += ` ORDER BY gm.id ASC`;

    const [members] = await pool.query(query, params);

    const formattedMembers = members.map((m) => {
      const isPending = !m.has_paid_current_month;
      return {
        ...m,
        total_savings: parseFloat(m.total_savings) || 0,
        outstanding_loans: parseFloat(m.outstanding_loans) || 0,
        monthly_contribution: parseFloat(m.monthly_contribution) || 0,
        is_pending_dues: isPending,
        pending_amount: isPending ? parseFloat(m.monthly_contribution) : 0,
      };
    });

    res.json({
      success: true,
      count: formattedMembers.length,
      currentMonth,
      currentYear,
      members: formattedMembers,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/members/:id
 * Get complete single member details
 */
async function getMemberById(req, res, next) {
  try {
    const memberId = req.params.id;
    const groupId = req.user.groupId || 1;

    // For regular MEMBER role, ensure they can only view their own profile
    const userRole = (req.user.role_name || req.user.role || 'MEMBER').toUpperCase();
    if (userRole === 'MEMBER' && req.user.memberId && req.user.memberId !== parseInt(memberId, 10)) {
      return res.status(403).json({ success: false, message: 'You can only view your own member profile.' });
    }

    const [memberRows] = await pool.query(
      `SELECT 
        gm.id as member_id,
        gm.member_code,
        gm.joined_date,
        gm.monthly_contribution,
        gm.is_active,
        gm.group_id,
        u.id as user_id,
        u.name,
        u.email,
        u.phone,
        COALESCE(u.role_name, u.role, 'MEMBER') as role_name,
        g.group_name,
        g.group_code
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      JOIN \`groups\` g ON gm.group_id = g.id
      WHERE gm.id = ? AND gm.group_id = ?`,
      [memberId, groupId]
    );

    if (memberRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const member = memberRows[0];

    // Total savings
    const [savingsSum] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM savings WHERE member_id = ?',
      [memberId]
    );

    // Recent savings history
    const [savingsHistory] = await pool.query(
      `SELECT s.*, u.name as recorded_by_name 
       FROM savings s 
       LEFT JOIN users u ON s.recorded_by = u.id 
       WHERE s.member_id = ? 
       ORDER BY s.year DESC, s.month DESC LIMIT 20`,
      [memberId]
    );

    // Member's loans
    const [loans] = await pool.query(
      `SELECT l.*,
        (SELECT COALESCE(SUM(principal_repayment_amount), 0) FROM loan_repayments WHERE loan_id = l.id) as total_principal_paid,
        (SELECT COALESCE(SUM(interest_amount), 0) FROM loan_repayments WHERE loan_id = l.id) as total_interest_paid,
        (SELECT COUNT(*) FROM loan_repayments WHERE loan_id = l.id) as repayments_count
       FROM loans l
       WHERE l.member_id = ?
       ORDER BY l.created_at DESC`,
      [memberId]
    );

    // Recent repayments
    const [repayments] = await pool.query(
      `SELECT lr.*, l.loan_number, u.name as recorded_by_name
       FROM loan_repayments lr
       JOIN loans l ON lr.loan_id = l.id
       LEFT JOIN users u ON lr.recorded_by = u.id
       WHERE lr.member_id = ?
       ORDER BY lr.payment_date DESC, lr.id DESC LIMIT 20`,
      [memberId]
    );

    const totalSavings = parseFloat(savingsSum[0].total) || 0;
    const totalOutstanding = loans.reduce((acc, l) => l.status === 'ACTIVE' ? acc + parseFloat(l.outstanding_amount) : acc, 0);

    res.json({
      success: true,
      member: {
        ...member,
        totalSavings,
        totalOutstanding,
        savingsHistory,
        loans,
        repayments,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/members
 * Add new member
 */
async function createMember(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const groupId = req.user.groupId || 1;
    const { name, email, phone, password, member_code, monthly_contribution, joined_date, role_name } = req.body;

    if (!name || !email || !member_code) {
      return res.status(400).json({ success: false, message: 'Name, email, and member code are required.' });
    }

    const assignedRole = (role_name || 'MEMBER').toUpperCase();

    // Check if email already exists
    const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
    let userId;

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
      // Update role if specified
      if (role_name) {
        await connection.query('UPDATE users SET role_name = ?, role = ? WHERE id = ?', [assignedRole, assignedRole, userId]);
      }
    } else {
      const defaultPassword = password || 'Member@123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const [userResult] = await connection.query(
        'INSERT INTO users (name, email, phone, password, role, role_name, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, hashedPassword, assignedRole, assignedRole]
      );
      userId = userResult.insertId;
    }

    // Check member code uniqueness in group
    const [existingMemberCode] = await connection.query(
      'SELECT id FROM group_members WHERE group_id = ? AND (user_id = ? OR member_code = ?)',
      [groupId, userId, member_code.trim()]
    );

    if (existingMemberCode.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Member code or user already belongs to this group.',
      });
    }

    const contribution = parseFloat(monthly_contribution) || 1000.0;
    const joinDate = joined_date || new Date().toISOString().split('T')[0];

    const [memberResult] = await connection.query(
      'INSERT INTO group_members (group_id, user_id, member_code, joined_date, monthly_contribution, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [groupId, userId, member_code.trim(), joinDate, contribution]
    );

    // Activity log & Notification
    await logActivity(
      groupId,
      req.user.id,
      'MEMBER_ADDED',
      `New member ${name} (${member_code}) added by ${req.user.name}`,
      connection
    );

    await createNotification(
      userId,
      groupId,
      'Welcome to Bachat Gat',
      `You have been registered as member ${member_code} with monthly savings contribution of ₹${contribution}.`,
      'SUCCESS',
      connection
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      memberId: memberResult.insertId,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/members/:id
 * Update member details & role_name
 */
async function updateMember(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const memberId = req.params.id;
    const groupId = req.user.groupId || 1;
    const { name, phone, email, monthly_contribution, is_active, role_name } = req.body;

    const [memberRows] = await connection.query(
      'SELECT gm.*, u.id as user_id, u.role_name FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.id = ? AND gm.group_id = ?',
      [memberId, groupId]
    );

    if (memberRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const member = memberRows[0];

    // Update user info & role_name
    const validRoles = ['ADMIN', 'MEMBER', 'TREASURER', 'SECRETARY'];
    const updatedRole = role_name && validRoles.includes(role_name.toUpperCase()) ? role_name.toUpperCase() : null;

    if (name || phone !== undefined || email || updatedRole) {
      await connection.query(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), role_name = COALESCE(?, role_name), role = COALESCE(?, role) WHERE id = ?',
        [
          name ? name.trim() : null,
          phone ? phone.trim() : null,
          email ? email.trim() : null,
          updatedRole,
          updatedRole,
          member.user_id,
        ]
      );
    }

    // Update group member info
    await connection.query(
      'UPDATE group_members SET monthly_contribution = COALESCE(?, monthly_contribution), is_active = COALESCE(?, is_active) WHERE id = ?',
      [
        monthly_contribution !== undefined ? parseFloat(monthly_contribution) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        memberId,
      ]
    );

    await logActivity(
      groupId,
      req.user.id,
      'MEMBER_UPDATED',
      `Member profile for ${name || member.member_code} updated by ${req.user.name}`,
      connection
    );

    await connection.commit();

    res.json({ success: true, message: 'Member updated successfully.' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * DELETE /api/members/:id
 */
async function deleteMember(req, res, next) {
  try {
    const memberId = req.params.id;
    const groupId = req.user.groupId || 1;

    const [loans] = await pool.query(
      'SELECT id FROM loans WHERE member_id = ? AND status = "ACTIVE"',
      [memberId]
    );

    if (loans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate/delete member with ACTIVE outstanding loans.',
      });
    }

    await pool.query('UPDATE group_members SET is_active = 0 WHERE id = ? AND group_id = ?', [memberId, groupId]);

    await logActivity(
      groupId,
      req.user.id,
      'MEMBER_DEACTIVATED',
      `Member #${memberId} deactivated by ${req.user.name}`
    );

    res.json({ success: true, message: 'Member deactivated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
};
