const pool = require('../config/db');
const { calculateMonthlyInterest, calculateTotalPayment } = require('../utils/calculations');
const { logActivity, createNotification } = require('../utils/logger');

/**
 * GET /api/loans
 * Get all loans with filters for status, member, search
 */
async function getAllLoans(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const { status, memberId, search } = req.query;

    let query = `
      SELECT 
        l.*,
        gm.member_code,
        u.name as member_name,
        u.email as member_email,
        u.phone as member_phone,
        (SELECT COALESCE(SUM(principal_repayment_amount), 0) FROM loan_repayments WHERE loan_id = l.id) as total_principal_repaid,
        (SELECT COALESCE(SUM(interest_amount), 0) FROM loan_repayments WHERE loan_id = l.id) as total_interest_paid,
        (SELECT COUNT(*) FROM loan_repayments WHERE loan_id = l.id) as repayments_count
      FROM loans l
      JOIN group_members gm ON l.member_id = gm.id
      JOIN users u ON gm.user_id = u.id
      WHERE l.group_id = ?
    `;

    const params = [groupId];

    // For regular members, restrict to own loans
    if (req.user.role === 'MEMBER' && req.user.memberId) {
      query += ' AND l.member_id = ?';
      params.push(req.user.memberId);
    } else if (memberId) {
      query += ' AND l.member_id = ?';
      params.push(memberId);
    }

    if (status && ['ACTIVE', 'CLOSED'].includes(status.toUpperCase())) {
      query += ' AND l.status = ?';
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      query += ' AND (u.name LIKE ? OR l.loan_number LIKE ? OR gm.member_code LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY l.created_at DESC';

    const [loans] = await pool.query(query, params);

    // Format & calculate repaid percentage
    const formattedLoans = loans.map((l) => {
      const principal = parseFloat(l.principal_amount) || 0;
      const outstanding = parseFloat(l.outstanding_amount) || 0;
      const repaidPrincipal = Math.max(0, principal - outstanding);
      const repaidPercent = principal > 0 ? Math.round((repaidPrincipal / principal) * 100) : 0;
      const monthlyInterestAmount = calculateMonthlyInterest(outstanding, l.interest_rate);

      return {
        ...l,
        principal_amount: principal,
        outstanding_amount: outstanding,
        interest_rate: parseFloat(l.interest_rate) || 0,
        total_principal_repaid: parseFloat(l.total_principal_repaid) || 0,
        total_interest_paid: parseFloat(l.total_interest_paid) || 0,
        repaid_percent: repaidPercent,
        calculated_monthly_interest: monthlyInterestAmount,
      };
    });

    res.json({
      success: true,
      count: formattedLoans.length,
      loans: formattedLoans,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/loans/:id
 * Get single loan details with full repayment schedule
 */
async function getLoanById(req, res, next) {
  try {
    const loanId = req.params.id;
    const groupId = req.user.groupId || 1;

    const [loanRows] = await pool.query(
      `SELECT 
        l.*,
        gm.member_code,
        u.id as user_id,
        u.name as member_name,
        u.email as member_email,
        u.phone as member_phone,
        cb.name as created_by_name
      FROM loans l
      JOIN group_members gm ON l.member_id = gm.id
      JOIN users u ON gm.user_id = u.id
      LEFT JOIN users cb ON l.created_by = cb.id
      WHERE l.id = ? AND l.group_id = ?`,
      [loanId, groupId]
    );

    if (loanRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found.' });
    }

    const loan = loanRows[0];

    // Check member role authorization
    if (req.user.role === 'MEMBER' && req.user.memberId && req.user.memberId !== loan.member_id) {
      return res.status(403).json({ success: false, message: 'Access denied to this loan.' });
    }

    // Repayments
    const [repayments] = await pool.query(
      `SELECT lr.*, u.name as recorded_by_name 
       FROM loan_repayments lr 
       LEFT JOIN users u ON lr.recorded_by = u.id 
       WHERE lr.loan_id = ? 
       ORDER BY lr.payment_year DESC, lr.payment_month DESC, lr.payment_date DESC`,
      [loanId]
    );

    const principal = parseFloat(loan.principal_amount) || 0;
    const outstanding = parseFloat(loan.outstanding_amount) || 0;
    const repaidPrincipal = Math.max(0, principal - outstanding);
    const repaidPercent = principal > 0 ? Math.round((repaidPrincipal / principal) * 100) : 0;
    const monthlyInterest = calculateMonthlyInterest(outstanding, loan.interest_rate);

    res.json({
      success: true,
      loan: {
        ...loan,
        principal_amount: principal,
        outstanding_amount: outstanding,
        interest_rate: parseFloat(loan.interest_rate),
        repaid_percent: repaidPercent,
        calculated_monthly_interest: monthlyInterest,
        repayments,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/loans
 * Create a new loan (Admin only)
 */
async function createLoan(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const groupId = req.user.groupId || 1;
    const { member_id, principal_amount, interest_rate, loan_date, duration_months, purpose } = req.body;

    if (!member_id || !principal_amount) {
      return res.status(400).json({
        success: false,
        message: 'Member and Principal Amount are required.',
      });
    }

    const principal = parseFloat(principal_amount);
    const rate = interest_rate !== undefined ? parseFloat(interest_rate) : 2.0;
    const duration = parseInt(duration_months, 10) || 12;
    const date = loan_date || new Date().toISOString().split('T')[0];

    if (principal <= 0) {
      return res.status(400).json({ success: false, message: 'Principal amount must be greater than zero.' });
    }

    // Verify member belongs to group and is active
    const [memberRows] = await connection.query(
      'SELECT gm.id, u.id as user_id, u.name FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.id = ? AND gm.group_id = ? AND gm.is_active = 1',
      [member_id, groupId]
    );

    if (memberRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid or inactive member.' });
    }

    const member = memberRows[0];

    // Generate unique loan number e.g. LN-2026-003
    const year = new Date(date).getFullYear() || new Date().getFullYear();
    const [countRows] = await connection.query('SELECT COUNT(*) as total FROM loans WHERE group_id = ?', [groupId]);
    const loanSeq = (countRows[0].total + 1).toString().padStart(3, '0');
    const loanNumber = `LN-${year}-${loanSeq}`;

    const [result] = await connection.query(
      `INSERT INTO loans 
       (group_id, member_id, loan_number, principal_amount, interest_rate, loan_date, duration_months, purpose, status, outstanding_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [
        groupId,
        member_id,
        loanNumber,
        principal,
        rate,
        date,
        duration,
        purpose || 'General personal/business loan',
        principal,
        req.user.id,
      ]
    );

    // Activity log
    await logActivity(
      groupId,
      req.user.id,
      'LOAN_CREATED',
      `Loan ${loanNumber} of ₹${principal} created for ${member.name} @ ${rate}% monthly interest by ${req.user.name}`,
      connection
    );

    // Notification
    await createNotification(
      member.user_id,
      groupId,
      'Loan Approved & Disbursed',
      `Loan ${loanNumber} of ₹${principal} has been disbursed to you @ ${rate}% monthly interest.`,
      'INFO',
      connection
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Loan created successfully',
      loanId: result.insertId,
      loanNumber,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * POST /api/loans/:loanId/repayments
 * Record a loan repayment with atomic transactions & automatic interest calculation
 */
async function recordLoanRepayment(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const loanId = req.params.loanId;
    const groupId = req.user.groupId || 1;
    const {
      payment_month,
      payment_year,
      regular_hafta_amount,
      principal_repayment_amount,
      payment_date,
      payment_mode,
      remarks,
    } = req.body;

    if (!payment_month || !payment_year) {
      return res.status(400).json({ success: false, message: 'Payment month and year are required.' });
    }

    // Fetch loan with FOR UPDATE lock for safety
    const [loanRows] = await connection.query(
      `SELECT l.*, gm.id as gm_id, u.id as user_id, u.name as member_name 
       FROM loans l
       JOIN group_members gm ON l.member_id = gm.id
       JOIN users u ON gm.user_id = u.id
       WHERE l.id = ? AND l.group_id = ? FOR UPDATE`,
      [loanId, groupId]
    );

    if (loanRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Loan not found.' });
    }

    const loan = loanRows[0];

    if (loan.status !== 'ACTIVE') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Cannot record payment for a CLOSED loan.' });
    }

    const currentOutstanding = parseFloat(loan.outstanding_amount) || 0;
    const interestRate = parseFloat(loan.interest_rate) || 0;

    const regularHafta = parseFloat(regular_hafta_amount) || 0;
    const principalRepayment = parseFloat(principal_repayment_amount) || 0;

    if (regularHafta < 0 || principalRepayment < 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Payment amounts cannot be negative.' });
    }

    if (principalRepayment > currentOutstanding) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Principal repayment (₹${principalRepayment}) cannot exceed outstanding principal (₹${currentOutstanding}).`,
      });
    }

    // Auto-calculate monthly interest
    const interestAmount = calculateMonthlyInterest(currentOutstanding, interestRate);
    const totalPayment = calculateTotalPayment(regularHafta, principalRepayment, interestAmount);

    if (totalPayment <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Total payment amount must be greater than zero.' });
    }

    const payDate = payment_date || new Date().toISOString().split('T')[0];

    // 1. Insert repayment entry
    const [repayResult] = await connection.query(
      `INSERT INTO loan_repayments 
       (loan_id, member_id, payment_month, payment_year, regular_hafta_amount, principal_repayment_amount, interest_amount, total_payment, payment_date, payment_mode, remarks, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loanId,
        loan.member_id,
        parseInt(payment_month, 10),
        parseInt(payment_year, 10),
        regularHafta,
        principalRepayment,
        interestAmount,
        totalPayment,
        payDate,
        payment_mode || 'CASH',
        remarks || `Repayment for ${payment_month}/${payment_year}`,
        req.user.id,
      ]
    );

    // 2. Update loan outstanding amount
    const newOutstanding = Math.max(0, Math.round((currentOutstanding - principalRepayment) * 100) / 100);
    const isNowClosed = newOutstanding === 0;
    const newStatus = isNowClosed ? 'CLOSED' : 'ACTIVE';

    await connection.query(
      'UPDATE loans SET outstanding_amount = ?, status = ? WHERE id = ?',
      [newOutstanding, newStatus, loanId]
    );

    // 3. Activity log
    await logActivity(
      groupId,
      req.user.id,
      'LOAN_REPAYMENT',
      `Repayment of ₹${totalPayment} (Principal: ₹${principalRepayment}, Interest: ₹${interestAmount}) recorded for Loan ${loan.loan_number} (${loan.member_name}) by ${req.user.name}. New Outstanding: ₹${newOutstanding}${isNowClosed ? ' (LOAN CLOSED)' : ''}`,
      connection
    );

    // 4. Notification
    await createNotification(
      loan.user_id,
      groupId,
      isNowClosed ? 'Loan Closed!' : 'Loan Payment Received',
      `Payment of ₹${totalPayment} (Principal ₹${principalRepayment} + Interest ₹${interestAmount}) received for Loan ${loan.loan_number}. Remaining Outstanding: ₹${newOutstanding}.`,
      isNowClosed ? 'SUCCESS' : 'INFO',
      connection
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: isNowClosed
        ? 'Payment recorded and loan is now fully CLOSED!'
        : 'Loan repayment recorded successfully.',
      repaymentId: repayResult.insertId,
      calculated: {
        interestAmount,
        principalRepayment,
        regularHafta,
        totalPayment,
        previousOutstanding: currentOutstanding,
        newOutstanding,
        status: newStatus,
      },
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * GET /api/loans/:loanId/repayments
 */
async function getLoanRepayments(req, res, next) {
  try {
    const loanId = req.params.loanId;
    const [repayments] = await pool.query(
      `SELECT lr.*, u.name as recorded_by_name 
       FROM loan_repayments lr 
       LEFT JOIN users u ON lr.recorded_by = u.id 
       WHERE lr.loan_id = ? 
       ORDER BY lr.payment_date DESC, lr.id DESC`,
      [loanId]
    );

    res.json({ success: true, repayments });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllLoans,
  getLoanById,
  createLoan,
  recordLoanRepayment,
  getLoanRepayments,
};
