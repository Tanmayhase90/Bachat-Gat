const pool = require('../config/db');
const { logActivity, createNotification } = require('../utils/logger');

/**
 * GET /api/savings
 * List savings with filters for month, year, search
 */
async function getAllSavings(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const { month, year, memberId, search } = req.query;

    let query = `
      SELECT 
        s.id,
        s.group_id,
        s.member_id,
        s.amount,
        s.month,
        s.year,
        s.payment_date,
        s.payment_mode,
        s.transaction_ref,
        s.remarks,
        s.created_at,
        gm.member_code,
        u.name as member_name,
        u.email as member_email,
        u.phone as member_phone,
        rec.name as recorded_by_name
      FROM savings s
      JOIN group_members gm ON s.member_id = gm.id
      JOIN users u ON gm.user_id = u.id
      LEFT JOIN users rec ON s.recorded_by = rec.id
      WHERE s.group_id = ?
    `;

    const params = [groupId];

    // For regular members, restrict to own records
    if (req.user.role === 'MEMBER' && req.user.memberId) {
      query += ' AND s.member_id = ?';
      params.push(req.user.memberId);
    } else if (memberId) {
      query += ' AND s.member_id = ?';
      params.push(memberId);
    }

    if (month) {
      query += ' AND s.month = ?';
      params.push(parseInt(month, 10));
    }

    if (year) {
      query += ' AND s.year = ?';
      params.push(parseInt(year, 10));
    }

    if (search && search.trim()) {
      query += ' AND (u.name LIKE ? OR gm.member_code LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s);
    }

    query += ' ORDER BY s.year DESC, s.month DESC, s.payment_date DESC';

    const [savings] = await pool.query(query, params);

    // Calculate total sum for the filtered dataset
    const totalAmount = savings.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    res.json({
      success: true,
      count: savings.length,
      totalAmount,
      savings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/savings
 * Record a monthly savings contribution
 */
async function recordSavings(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const groupId = req.user.groupId || 1;
    const { member_id, amount, month, year, payment_date, payment_mode, remarks } = req.body;

    if (!member_id || !amount || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Member, Amount, Month, and Year are required.',
      });
    }

    const payMonth = parseInt(month, 10);
    const payYear = parseInt(year, 10);
    const saveAmount = parseFloat(amount);

    if (payMonth < 1 || payMonth > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month (1-12).' });
    }

    if (saveAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
    }

    // Check duplicate
    const [existing] = await connection.query(
      'SELECT id FROM savings WHERE group_id = ? AND member_id = ? AND month = ? AND year = ?',
      [groupId, member_id, payMonth, payYear]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Savings for this member for ${payMonth}/${payYear} is already recorded. Edit existing entry if needed.`,
      });
    }

    const payDate = payment_date || new Date().toISOString().split('T')[0];

    const [result] = await connection.query(
      `INSERT INTO savings (group_id, member_id, amount, month, year, payment_date, payment_mode, remarks, recorded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        groupId,
        member_id,
        saveAmount,
        payMonth,
        payYear,
        payDate,
        payment_mode || 'CASH',
        remarks || `Monthly savings for ${payMonth}/${payYear}`,
        req.user.id,
      ]
    );

    // Get member user details for notification
    const [memberRows] = await connection.query(
      'SELECT u.id as user_id, u.name FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.id = ?',
      [member_id]
    );

    const memberName = memberRows.length > 0 ? memberRows[0].name : `Member #${member_id}`;
    const memberUserId = memberRows.length > 0 ? memberRows[0].user_id : null;

    // Activity log
    await logActivity(
      groupId,
      req.user.id,
      'SAVINGS_RECORDED',
      `Savings of ₹${saveAmount} recorded for ${memberName} (${payMonth}/${payYear}) by ${req.user.name}`,
      connection
    );

    // Notification to member
    if (memberUserId) {
      await createNotification(
        memberUserId,
        groupId,
        'Savings Recorded',
        `Your monthly savings contribution of ₹${saveAmount} for ${payMonth}/${payYear} has been recorded.`,
        'SUCCESS',
        connection
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Savings recorded successfully',
      savingsId: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/savings/:id
 * Update savings record
 */
async function updateSavings(req, res, next) {
  try {
    const savingsId = req.params.id;
    const { amount, payment_date, payment_mode, remarks } = req.body;

    const [existing] = await pool.query('SELECT * FROM savings WHERE id = ?', [savingsId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Savings record not found.' });
    }

    await pool.query(
      `UPDATE savings 
       SET amount = COALESCE(?, amount),
           payment_date = COALESCE(?, payment_date),
           payment_mode = COALESCE(?, payment_mode),
           remarks = COALESCE(?, remarks)
       WHERE id = ?`,
      [
        amount !== undefined ? parseFloat(amount) : null,
        payment_date || null,
        payment_mode || null,
        remarks !== undefined ? remarks.trim() : null,
        savingsId,
      ]
    );

    res.json({ success: true, message: 'Savings record updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllSavings,
  recordSavings,
  updateSavings,
};
