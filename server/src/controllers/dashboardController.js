const pool = require('../config/db');
const { calculateProgressPercentage } = require('../utils/calculations');

/**
 * GET /api/dashboard/summary
 * Total Group Fund, Total Savings, Active Loans, Total Interest, Available Balance
 */
async function getDashboardSummary(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;

    // 1. Total Savings
    const [savingsResult] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total_savings FROM savings WHERE group_id = ?',
      [groupId]
    );
    const totalSavings = parseFloat(savingsResult[0].total_savings) || 0;

    // 2. Active Loans Outstanding
    const [loansResult] = await pool.query(
      "SELECT COALESCE(SUM(outstanding_amount), 0) as active_loans_total, COUNT(*) as active_loans_count FROM loans WHERE group_id = ? AND status = 'ACTIVE'",
      [groupId]
    );
    const activeLoans = parseFloat(loansResult[0].active_loans_total) || 0;
    const activeLoansCount = parseInt(loansResult[0].active_loans_count, 10) || 0;

    // 3. Total Interest Collected
    const [interestResult] = await pool.query(
      `SELECT COALESCE(SUM(lr.interest_amount), 0) as total_interest 
       FROM loan_repayments lr 
       JOIN loans l ON lr.loan_id = l.id 
       WHERE l.group_id = ?`,
      [groupId]
    );
    const totalInterest = parseFloat(interestResult[0].total_interest) || 0;

    // 4. Principal Repaid so far
    const [principalRepaidResult] = await pool.query(
      `SELECT COALESCE(SUM(lr.principal_repayment_amount), 0) as total_principal_repaid 
       FROM loan_repayments lr 
       JOIN loans l ON lr.loan_id = l.id 
       WHERE l.group_id = ?`,
      [groupId]
    );
    const totalPrincipalRepaid = parseFloat(principalRepaidResult[0].total_principal_repaid) || 0;

    // 5. Total Group Fund & Available Balance
    // Total Group Fund = Total Savings + Total Interest Collected
    // Available Balance = Total Savings + Total Interest Collected - Active Loans Outstanding
    const totalGroupFund = totalSavings + totalInterest;
    const availableBalance = Math.round((totalSavings + totalInterest - activeLoans) * 100) / 100;

    // 6. Member metrics
    const [memberMetrics] = await pool.query(
      `SELECT 
        COUNT(*) as total_members,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_members
       FROM group_members WHERE group_id = ?`,
      [groupId]
    );

    // If logged in as regular MEMBER, fetch personal metrics as well
    let memberSummary = null;
    if (req.user.role === 'MEMBER' && req.user.memberId) {
      const [mSavings] = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) as my_savings FROM savings WHERE member_id = ?',
        [req.user.memberId]
      );
      const [mLoans] = await pool.query(
        "SELECT COALESCE(SUM(outstanding_amount), 0) as my_loan_outstanding, COUNT(*) as my_active_loans FROM loans WHERE member_id = ? AND status = 'ACTIVE'",
        [req.user.memberId]
      );
      const [mInterest] = await pool.query(
        'SELECT COALESCE(SUM(interest_amount), 0) as my_interest_paid FROM loan_repayments WHERE member_id = ?',
        [req.user.memberId]
      );

      memberSummary = {
        mySavings: parseFloat(mSavings[0].my_savings) || 0,
        myLoanOutstanding: parseFloat(mLoans[0].my_loan_outstanding) || 0,
        myActiveLoansCount: parseInt(mLoans[0].my_active_loans, 10) || 0,
        myInterestPaid: parseFloat(mInterest[0].my_interest_paid) || 0,
      };
    }

    // 7. Group Info
    const [groupRows] = await pool.query('SELECT group_name, group_code FROM `groups` WHERE id = ?', [groupId]);
    const groupName = groupRows.length > 0 ? groupRows[0].group_name : 'Bachat Gat';
    const groupCode = groupRows.length > 0 ? groupRows[0].group_code : 'group_001';

    res.json({
      success: true,
      summary: {
        groupName,
        groupCode,
        totalGroupFund,
        totalSavings,
        activeLoans,
        activeLoansCount,
        totalInterest,
        totalPrincipalRepaid,
        availableBalance,
        totalMembers: parseInt(memberMetrics[0].total_members, 10) || 0,
        activeMembers: parseInt(memberMetrics[0].active_members, 10) || 0,
      },
      memberSummary,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/monthly-progress
 * Progress bar & collection metrics for selected month & year
 */
async function getMonthlyProgress(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const currentMonth = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const currentYear = parseInt(req.query.year, 10) || new Date().getFullYear();

    // 1. Group info & active members count
    const [groupRows] = await pool.query(
      'SELECT monthly_contribution_per_share, monthly_target FROM `groups` WHERE id = ?',
      [groupId]
    );

    const group = groupRows[0] || { monthly_contribution_per_share: 1000, monthly_target: 5000 };

    // Calculate active members target
    const [memberCountRows] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(monthly_contribution), 0) as expected_monthly FROM group_members WHERE group_id = ? AND is_active = 1',
      [groupId]
    );

    const activeMembersCount = parseInt(memberCountRows[0].count, 10) || 0;
    const calculatedTarget = parseFloat(memberCountRows[0].expected_monthly) || (activeMembersCount * parseFloat(group.monthly_contribution_per_share));
    const targetAmount = calculatedTarget > 0 ? calculatedTarget : (parseFloat(group.monthly_target) || 5000);

    // 2. Collected amount for this month & year
    const [collectedRows] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as collected_amount, COUNT(DISTINCT member_id) as paid_members_count FROM savings WHERE group_id = ? AND month = ? AND year = ?',
      [groupId, currentMonth, currentYear]
    );

    const collectedAmount = parseFloat(collectedRows[0].collected_amount) || 0;
    const paidMembersCount = parseInt(collectedRows[0].paid_members_count, 10) || 0;

    const progressPercentage = calculateProgressPercentage(collectedAmount, targetAmount);
    const pendingMembersCount = Math.max(0, activeMembersCount - paidMembersCount);

    // 3. Pending members list
    const [pendingMembers] = await pool.query(
      `SELECT gm.id as member_id, gm.member_code, gm.monthly_contribution, u.name, u.phone 
       FROM group_members gm 
       JOIN users u ON gm.user_id = u.id 
       WHERE gm.group_id = ? AND gm.is_active = 1 
         AND gm.id NOT IN (SELECT member_id FROM savings WHERE group_id = ? AND month = ? AND year = ?)
       ORDER BY gm.id ASC`,
      [groupId, groupId, currentMonth, currentYear]
    );

    res.json({
      success: true,
      progress: {
        month: currentMonth,
        year: currentYear,
        collectedAmount,
        targetAmount,
        progressPercentage,
        paidMembersCount,
        pendingMembersCount,
        activeMembersCount,
        pendingMembers,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/recent-activities
 * Recent logs from activity_logs table
 */
async function getRecentActivities(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const [activities] = await pool.query(
      `SELECT a.*, u.name as user_name, u.role as user_role 
       FROM activity_logs a 
       LEFT JOIN users u ON a.user_id = u.id 
       WHERE a.group_id = ? 
       ORDER BY a.created_at DESC 
       LIMIT ?`,
      [groupId, limit]
    );

    res.json({ success: true, activities });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardSummary,
  getMonthlyProgress,
  getRecentActivities,
};
