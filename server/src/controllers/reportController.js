const pool = require('../config/db');
const { calculateMonthlyInterest } = require('../utils/calculations');

/**
 * GET /api/reports/monthly
 * Monthly Collection Summary & Breakdown
 */
async function getMonthlyReport(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const currentMonth = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const currentYear = parseInt(req.query.year, 10) || new Date().getFullYear();

    // 1. Total Savings in this month
    const [monthSavings] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM savings WHERE group_id = ? AND month = ? AND year = ?',
      [groupId, currentMonth, currentYear]
    );

    // 2. Total Interest collected in this month
    const [monthInterest] = await pool.query(
      `SELECT COALESCE(SUM(lr.interest_amount), 0) as total_interest,
              COALESCE(SUM(lr.principal_repayment_amount), 0) as total_principal_repaid,
              COALESCE(SUM(lr.total_payment), 0) as total_repayments
       FROM loan_repayments lr
       JOIN loans l ON lr.loan_id = l.id
       WHERE l.group_id = ? AND lr.payment_month = ? AND lr.payment_year = ?`,
      [groupId, currentMonth, currentYear]
    );

    // 3. Overall cumulative stats for context
    const [allSavings] = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM savings WHERE group_id = ?', [groupId]);
    const [allInterest] = await pool.query(
      `SELECT COALESCE(SUM(lr.interest_amount), 0) as total FROM loan_repayments lr JOIN loans l ON lr.loan_id = l.id WHERE l.group_id = ?`,
      [groupId]
    );
    const [allActiveLoans] = await pool.query(
      "SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM loans WHERE group_id = ? AND status = 'ACTIVE'",
      [groupId]
    );

    const totalSavingsCumulative = parseFloat(allSavings[0].total) || 0;
    const totalInterestCumulative = parseFloat(allInterest[0].total) || 0;
    const outstandingPrincipal = parseFloat(allActiveLoans[0].total) || 0;
    const availableGroupBalance = Math.round((totalSavingsCumulative + totalInterestCumulative - outstandingPrincipal) * 100) / 100;

    // 4. Detailed savings transactions for the month
    const [savingsTransactions] = await pool.query(
      `SELECT s.*, gm.member_code, u.name as member_name 
       FROM savings s 
       JOIN group_members gm ON s.member_id = gm.id 
       JOIN users u ON gm.user_id = u.id 
       WHERE s.group_id = ? AND s.month = ? AND s.year = ? 
       ORDER BY s.payment_date ASC`,
      [groupId, currentMonth, currentYear]
    );

    // 5. Detailed loan repayment transactions for the month
    const [repaymentTransactions] = await pool.query(
      `SELECT lr.*, l.loan_number, gm.member_code, u.name as member_name 
       FROM loan_repayments lr 
       JOIN loans l ON lr.loan_id = l.id 
       JOIN group_members gm ON lr.member_id = gm.id 
       JOIN users u ON gm.user_id = u.id 
       WHERE l.group_id = ? AND lr.payment_month = ? AND lr.payment_year = ? 
       ORDER BY lr.payment_date ASC`,
      [groupId, currentMonth, currentYear]
    );

    res.json({
      success: true,
      month: currentMonth,
      year: currentYear,
      summary: {
        monthSavings: parseFloat(monthSavings[0].total) || 0,
        monthInterest: parseFloat(monthInterest[0].total_interest) || 0,
        monthPrincipalRepaid: parseFloat(monthInterest[0].total_principal_repaid) || 0,
        monthTotalRepayments: parseFloat(monthInterest[0].total_repayments) || 0,
        totalSavingsCumulative,
        totalInterestCumulative,
        outstandingPrincipal,
        availableGroupBalance,
      },
      savingsTransactions,
      repaymentTransactions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/pending-dues
 * Detailed report of members with unpaid monthly hafta / active loan dues
 */
async function getPendingDuesReport(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const currentMonth = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const currentYear = parseInt(req.query.year, 10) || new Date().getFullYear();
    const search = req.query.search;

    let query = `
      SELECT 
        gm.id as member_id,
        gm.member_code,
        gm.monthly_contribution,
        u.name as member_name,
        u.email as member_email,
        u.phone as member_phone,
        EXISTS(SELECT 1 FROM savings WHERE member_id = gm.id AND month = ? AND year = ?) as has_paid_savings,
        (SELECT id FROM loans WHERE member_id = gm.id AND status = 'ACTIVE' LIMIT 1) as active_loan_id,
        (SELECT loan_number FROM loans WHERE member_id = gm.id AND status = 'ACTIVE' LIMIT 1) as active_loan_number,
        (SELECT outstanding_amount FROM loans WHERE member_id = gm.id AND status = 'ACTIVE' LIMIT 1) as outstanding_principal,
        (SELECT interest_rate FROM loans WHERE member_id = gm.id AND status = 'ACTIVE' LIMIT 1) as loan_interest_rate
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.is_active = 1
    `;

    const params = [currentMonth, currentYear, groupId];

    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR gm.member_code LIKE ? OR u.phone LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY gm.id ASC';

    const [members] = await pool.query(query, params);

    // Compute dues for each member
    let totalPendingDuesAmount = 0;
    let pendingMembersCount = 0;

    const duesList = members
      .map((m) => {
        const pendingHafta = m.has_paid_savings ? 0 : parseFloat(m.monthly_contribution);
        const outstandingPrincipal = parseFloat(m.outstanding_principal) || 0;
        const interestRate = parseFloat(m.loan_interest_rate) || 0;
        const pendingInterest = outstandingPrincipal > 0 ? calculateMonthlyInterest(outstandingPrincipal, interestRate) : 0;

        const totalMemberPending = Math.round((pendingHafta + outstandingPrincipal + pendingInterest) * 100) / 100;
        const isPending = !m.has_paid_savings || outstandingPrincipal > 0;

        if (isPending) {
          totalPendingDuesAmount += totalMemberPending;
          pendingMembersCount++;
        }

        return {
          memberId: m.member_id,
          memberCode: m.member_code,
          memberName: m.member_name,
          memberEmail: m.member_email,
          memberPhone: m.member_phone,
          hasPaidSavings: !!m.has_paid_savings,
          pendingHafta,
          activeLoanId: m.active_loan_id,
          activeLoanNumber: m.active_loan_number,
          outstandingPrincipal,
          interestRate,
          pendingInterest,
          totalPending: totalMemberPending,
          isPending,
        };
      })
      .filter((m) => m.isPending);

    res.json({
      success: true,
      month: currentMonth,
      year: currentYear,
      summary: {
        totalPendingMembers: pendingMembersCount,
        totalPendingAmount: Math.round(totalPendingDuesAmount * 100) / 100,
      },
      duesList,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/loans-overview
 * Comprehensive overview of all loans (Active and Closed)
 */
async function getLoansOverviewReport(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;

    const [loans] = await pool.query(
      `SELECT 
        l.*,
        gm.member_code,
        u.name as member_name,
        u.email as member_email,
        u.phone as member_phone,
        COALESCE((SELECT SUM(principal_repayment_amount) FROM loan_repayments WHERE loan_id = l.id), 0) as total_principal_paid,
        COALESCE((SELECT SUM(interest_amount) FROM loan_repayments WHERE loan_id = l.id), 0) as total_interest_paid,
        (SELECT COUNT(*) FROM loan_repayments WHERE loan_id = l.id) as repayments_count,
        (SELECT MAX(payment_date) FROM loan_repayments WHERE loan_id = l.id) as last_payment_date
       FROM loans l
       JOIN group_members gm ON l.member_id = gm.id
       JOIN users u ON gm.user_id = u.id
       WHERE l.group_id = ?
       ORDER BY l.status ASC, l.created_at DESC`,
      [groupId]
    );

    let totalPrincipalDisbursed = 0;
    let totalPrincipalCollected = 0;
    let totalInterestCollected = 0;
    let totalOutstanding = 0;

    const formattedLoans = loans.map((l) => {
      const principal = parseFloat(l.principal_amount) || 0;
      const outstanding = parseFloat(l.outstanding_amount) || 0;
      const principalPaid = parseFloat(l.total_principal_paid) || 0;
      const interestPaid = parseFloat(l.total_interest_paid) || 0;

      totalPrincipalDisbursed += principal;
      totalPrincipalCollected += principalPaid;
      totalInterestCollected += interestPaid;
      if (l.status === 'ACTIVE') {
        totalOutstanding += outstanding;
      }

      return {
        ...l,
        principal_amount: principal,
        outstanding_amount: outstanding,
        interest_rate: parseFloat(l.interest_rate) || 0,
        total_principal_paid: principalPaid,
        total_interest_paid: interestPaid,
      };
    });

    res.json({
      success: true,
      summary: {
        totalLoans: formattedLoans.length,
        totalPrincipalDisbursed,
        totalPrincipalCollected,
        totalInterestCollected,
        totalOutstanding,
      },
      loans: formattedLoans,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMonthlyReport,
  getPendingDuesReport,
  getLoansOverviewReport,
};
