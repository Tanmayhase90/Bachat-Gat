import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '../../utils/formatters';
import { CheckCircle2 } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const isSettledRow = (r) => Boolean(
  r?.isSettled ||
  r?.is_settled ||
  r?.isDeleted ||
  r?.is_deleted ||
  (r?.status || '').toUpperCase() === 'SETTLED' ||
  (r?.status || '').toUpperCase() === 'DELETED'
);

const sortMemberRecords = (a, b) => {
  const idA = a.memberCode || a.member_code || a.memberId || a.member_id || a.id || '';
  const idB = b.memberCode || b.member_code || b.memberId || b.member_id || b.id || '';
  const numA = parseInt(String(idA).replace(/\D/g, ''), 10);
  const numB = parseInt(String(idB).replace(/\D/g, ''), 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  if (!isNaN(numA)) return -1;
  if (!isNaN(numB)) return 1;
  return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
};

const FinancialReportDocument = ({
  groupInfo,
  monthlyData,
  pendingData,
  loansData,
  selectedMonth,
  selectedYear,
}) => {
  const { t, getGroupName, language } = useLanguage();

  const monthLabel = MONTH_NAMES[selectedMonth - 1] || 'Selected Month';
  const selectedPeriodText = `${t(`common.months.${selectedMonth}`, monthLabel)} ${selectedYear}`;
  const groupNameText = getGroupName(groupInfo?.group_name || groupInfo?.name);

  const collections = monthlyData?.collections || monthlyData?.savingsTransactions || [];
  const duesList = pendingData?.duesList || [];
  const loans = loansData?.loans || [];

  return (
    <div
      className="card report-document"
      id="financial-report-document"
      style={{
        padding: '36px 40px',
        backgroundColor: '#FFFFFF',
        borderColor: 'var(--border-color)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. Header Section */}
      <div
        className="report-header"
        style={{
          borderBottom: '2.5px solid var(--primary)',
          paddingBottom: '20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-gradient)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem',
            }}
          >
            ₹
          </div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color: 'var(--primary)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {groupNameText}
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Ghargaon Stand • Registration & Accounting Management
        </p>
        <div
          style={{
            display: 'inline-block',
            background: 'var(--accent-soft)',
            color: 'var(--primary)',
            padding: '4px 16px',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {language === 'mr' ? 'मासिक आर्थिक अहवाल —' : 'MONTHLY FINANCIAL REPORT —'} {selectedPeriodText}
        </div>
      </div>

      {/* 2. Key Metric Financial Summary Grid */}
      <div className="report-section avoid-break">
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          1. {language === 'mr' ? 'आर्थिक कामगिरी सारांश' : 'Financial Performance Summary'} ({selectedPeriodText})
        </h3>
        <div className="report-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#F8FAFC', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('reports.totalSavingsMonth', 'Total Savings (Month)')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
              {formatCurrency(monthlyData?.summary?.monthSavings ?? monthlyData?.summary?.totalSavingsCollected)}
            </div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
              {language === 'mr' ? 'उद्दिष्ट:' : 'Target:'} {formatCurrency(monthlyData?.summary?.monthlyTarget)} ({monthlyData?.summary?.targetAchievement || 0}% {language === 'mr' ? 'पूर्ण' : 'completed'})
            </span>
          </div>

          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#F8FAFC', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('reports.totalInterestMonth', 'Total Interest (Month)')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
              {formatCurrency(monthlyData?.summary?.monthInterest ?? monthlyData?.summary?.totalInterestCollected)}
            </div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
              {t('reports.fromLoanRepayments', 'From active loan repayments')}
            </span>
          </div>

          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#F8FAFC', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('reports.outstandingPrincipal', 'Outstanding Principal')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger-text)', marginTop: '4px' }}>
              {formatCurrency(monthlyData?.summary?.outstandingPrincipal)}
            </div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
              {t('reports.activeLoanBalance', 'Active loan balance in group')}
            </span>
          </div>

          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              {t('reports.availableGroupBalance', 'Available Group Balance')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
              {formatCurrency(monthlyData?.summary?.availableGroupBalance)}
            </div>
            <span style={{ fontSize: '0.725rem', color: '#166534' }}>
              {t('reports.netLiquidCash', 'Net liquid fund in treasury')}
            </span>
          </div>
        </div>

        <div className="report-stat-strip" style={{ display: 'flex', gap: '20px', marginTop: '12px', padding: '10px 16px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', flexWrap: 'wrap' }}>
          <div><strong>{t('reports.activeMembersCount', 'Active Members:')}</strong> {formatNumber(monthlyData?.summary?.totalActiveMembers)}</div>
          <div><strong>{t('reports.paidMembersCount', 'Paid Members:')}</strong> <span style={{ color: 'var(--success-text)', fontWeight: 700 }}>{formatNumber(monthlyData?.summary?.totalPaidMembers)}</span></div>
          <div><strong>{t('reports.pendingMembersCount', 'Pending Members:')}</strong> <span style={{ color: 'var(--danger-text)', fontWeight: 700 }}>{formatNumber(monthlyData?.summary?.totalPendingMembers)}</span></div>
        </div>
      </div>

      {/* 3. Member-Wise Monthly Register Table */}
      <div className="report-section">
        {(() => {
          const rawCollections = collections || [];
          const activeRows = rawCollections.filter(r => !isSettledRow(r)).sort(sortMemberRecords);
          const settledRows = rawCollections.filter(r => isSettledRow(r)).sort(sortMemberRecords);
          const registerList = [...activeRows, ...settledRows];

          const totalSavingsSum = activeRows.reduce((acc, r) => acc + (r.savingsAmount || r.savings_amount || r.paid_amount || 0), 0);
          const totalLoanPrincipalSum = activeRows.reduce((acc, r) => acc + (r.loanPrincipal || r.loan_principal || 0), 0);
          const totalInterestSum = activeRows.reduce((acc, r) => acc + (r.interestPaid || r.interest_paid || r.interestAmount || 0), 0);
          const totalPrincipalRepaidSum = activeRows.reduce((acc, r) => acc + (r.principalRepaid || r.principal_repaid || 0), 0);
          const totalPaymentSum = activeRows.reduce((acc, r) => acc + (r.totalPayment || r.total_payment || r.amount || 0), 0);
          const totalOutstandingSum = activeRows.reduce((acc, r) => acc + (r.outstandingLoan || r.outstanding_loan || 0), 0);
          const paidCount = activeRows.filter((r) => (r.paid_amount || r.paidAmount || 0) >= (r.expected_amount || r.expectedAmount || r.savingsAmount || 0)).length;
          const pendingCount = activeRows.filter((r) => (r.paid_amount || r.paidAmount || 0) < (r.expected_amount || r.expectedAmount || r.savingsAmount || 0)).length;

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  2. {language === 'mr' ? 'मासिक आर्थिक नोंदवही' : 'Monthly Financial Register'} ({selectedPeriodText})
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {language === 'mr' ? 'एकूण नोंदी:' : 'Total Records:'} <strong>{formatNumber(registerList.length)}</strong>
                </span>
              </div>

              {registerList.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {language === 'mr' ? 'निवडलेल्या महिन्यासाठी कोणतीही नोंद आढळली नाही.' : 'No records found for this selected month.'}
                </div>
              ) : (
                <div id="monthly-register-table-wrap" className="table-responsive report-table-wrap" style={{ maxHeight: '650px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '0.825rem', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '35px', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>#</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('reports.tableMemberName', 'Member Name')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('modals.loanAmount', 'Loan Principal')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('loans.tableMonthlyInterest', 'Monthly Interest')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('loans.tablePaidPrincipal', 'Principal Repaid')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('members.tableMonthlyShare', 'Monthly Savings')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('modals.totalPayment', 'Total Payment')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('reports.tableLoanOutstanding', 'Outstanding Loan')}</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('memberDetails.paymentDate', 'Payment Date')}</th>
                        <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('reports.tableTotalPending', 'Pending Amount')}</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{t('common.status', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registerList.map((c, idx) => {
                        const isSettled = isSettledRow(c);
                        const sAmt = c.savingsAmount !== undefined ? c.savingsAmount : (c.savings_amount !== undefined ? c.savings_amount : (c.expected_amount || c.expectedAmount || 0));
                        const lPrin = c.loanPrincipal || c.loan_principal || 0;
                        const iAmt = c.interestPaid || c.interest_paid || c.interestAmount || 0;
                        const pRepaid = c.principalRepaid || c.principal_repaid || 0;
                        const tPay = c.totalPayment || c.total_payment || c.amount || ((c.paid_amount || c.paidAmount || 0) + pRepaid + iAmt);
                        const outLoan = c.outstandingLoan || c.outstanding_loan || 0;
                        const expHafta = Number(c.expected_amount || c.expectedAmount || sAmt);
                        const pHafta = c.pendingHafta !== undefined ? c.pendingHafta : Math.max(0, expHafta - (c.paid_amount || c.paidAmount || 0));
                        const pLoan = c.pendingLoan !== undefined ? c.pendingLoan : outLoan;
                        const pAmt = c.pendingAmount !== undefined ? c.pendingAmount : (pLoan + pHafta);

                        return (
                          <tr
                            key={c.id || c.memberId || idx}
                            style={isSettled ? {
                              backgroundColor: '#FEF2F2',
                              borderBottom: '1px solid #FECACA',
                              color: '#DC2626',
                            } : undefined}
                          >
                            <td style={{ color: isSettled ? '#DC2626' : 'var(--text-muted)', fontWeight: isSettled ? 700 : 400 }}>{idx + 1}</td>
                            <td style={{ fontWeight: 700, color: isSettled ? '#DC2626' : 'inherit' }}>{c.memberName || c.member_name}</td>
                            <td style={{ textAlign: 'right', color: isSettled ? '#DC2626' : (lPrin > 0 ? 'var(--text-primary)' : 'var(--text-muted)') }}>
                              {lPrin > 0 ? formatCurrency(lPrin) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', color: isSettled ? '#DC2626' : (iAmt > 0 ? 'var(--success-text)' : 'var(--text-muted)'), fontWeight: (isSettled || iAmt > 0) ? 600 : 400 }}>
                              {iAmt > 0 ? formatCurrency(iAmt) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', color: isSettled ? '#DC2626' : (pRepaid > 0 ? 'var(--info)' : 'var(--text-muted)'), fontWeight: (isSettled || pRepaid > 0) ? 600 : 400 }}>
                              {pRepaid > 0 ? formatCurrency(pRepaid) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: isSettled ? '#DC2626' : (sAmt > 0 ? 'var(--primary)' : 'var(--text-muted)') }}>
                              {formatCurrency(sAmt)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: isSettled ? '#DC2626' : (tPay > 0 ? 'var(--primary)' : 'var(--danger-text)') }}>
                              {formatCurrency(tPay)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: (isSettled || outLoan > 0) ? 700 : 400, color: isSettled ? '#DC2626' : (outLoan > 0 ? 'var(--danger-text)' : 'var(--text-muted)') }}>
                              {outLoan > 0 ? formatCurrency(outLoan) : '-'}
                            </td>
                            <td style={{ color: isSettled ? '#DC2626' : 'inherit' }}>
                              {c.paymentDate || c.payment_date ? formatDate(c.paymentDate || c.payment_date) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: (isSettled || pAmt > 0) ? 700 : 400, color: isSettled ? '#DC2626' : (pAmt > 0 ? 'var(--danger-text)' : 'var(--text-muted)') }}>
                              {formatCurrency(pAmt)}
                            </td>
                            <td>
                              {isSettled ? (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.7rem',
                                    backgroundColor: '#FEE2E2',
                                    color: '#DC2626',
                                    border: '1px solid #FCA5A5',
                                    fontWeight: 800,
                                    letterSpacing: '0.03em',
                                  }}
                                >
                                  SETTLED
                                </span>
                              ) : (
                                <span
                                  className={`badge ${
                                    c.status === 'PAID'
                                      ? 'badge-success'
                                      : c.status === 'PARTIAL'
                                      ? 'badge-warning'
                                      : 'badge-danger'
                                  }`}
                                  style={{ fontSize: '0.7rem' }}
                                >
                                  {c.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#F8FAFC', fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={2} style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                          {t('common.grandTotal', 'GRAND TOTAL')} ({activeRows.length} {language === 'mr' ? 'सभासद' : 'Members'})
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {totalLoanPrincipalSum > 0 ? formatCurrency(totalLoanPrincipalSum) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>
                          {totalInterestSum > 0 ? formatCurrency(totalInterestSum) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--info)' }}>
                          {totalPrincipalRepaidSum > 0 ? formatCurrency(totalPrincipalRepaidSum) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)' }}>
                          {formatCurrency(totalSavingsSum)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 900 }}>
                          {formatCurrency(totalPaymentSum)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>
                          {totalOutstandingSum > 0 ? formatCurrency(totalOutstandingSum) : '-'}
                        </td>
                        <td colSpan={3} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {paidCount} {t('common.paid', 'Paid')} • {pendingCount} {t('common.pending', 'Pending')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* 4. Pending Dues Section */}
      <div className="report-section avoid-break">
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          3. {language === 'mr' ? 'थकीत बाकी व थकबाकीदार' : 'Pending Dues & Defaulters'} ({selectedPeriodText})
        </h3>
        {duesList.length === 0 ? (
          <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>
            <CheckCircle2 size={16} /> {language === 'mr' ? `${selectedPeriodText} साठी सर्व बाकी पूर्णपणे भरली आहे! कोणत्याही सभासदाची बाकी नाही.` : `All dues are completely cleared for ${selectedPeriodText}! No pending member balances.`}
          </div>
        ) : (
          <div className="table-responsive report-table-wrap">
            <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('reports.tableMemberName', 'Member Name')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tablePendingHafta', 'Pending Hafta')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tableLoanOutstanding', 'Outstanding Loan')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tablePendingInterest', 'Pending Interest')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tableTotalPending', 'Total Pending')}</th>
                </tr>
              </thead>
              <tbody>
                {[...(duesList || [])].sort((a, b) => {
                  const idA = a.memberCode || a.member_code || a.memberId || a.member_id || a.id || '';
                  const idB = b.memberCode || b.member_code || b.memberId || b.member_id || b.id || '';
                  const numA = parseInt(String(idA).replace(/\D/g, ''), 10);
                  const numB = parseInt(String(idB).replace(/\D/g, ''), 10);
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  if (!isNaN(numA)) return -1;
                  if (!isNaN(numB)) return 1;
                  return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
                }).map((d) => (
                  <tr key={d.memberId || d.member_id || d.memberName}>
                    <td style={{ fontWeight: 700 }}>{d.memberName || d.member_name}</td>
                    <td style={{ textAlign: 'right', color: (d.pendingHafta || d.monthly_contribution) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                      {formatCurrency(d.pendingHafta || d.monthly_contribution)}
                    </td>
                    <td style={{ textAlign: 'right', color: (d.outstandingPrincipal || 0) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                      {formatCurrency(d.outstandingPrincipal)}
                    </td>
                    <td style={{ textAlign: 'right', color: (d.pendingInterest || 0) > 0 ? 'var(--primary)' : 'inherit' }}>
                      {formatCurrency(d.pendingInterest)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--danger-text)' }}>
                      {formatCurrency(d.totalPending || d.due_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FFF5F5', fontWeight: 800, color: 'var(--danger-text)' }}>
                  <td colSpan={4}>{t('reports.totalPendingDuesCard', 'TOTAL OUTSTANDING DUES')} ({duesList.length} {language === 'mr' ? 'सभासद' : 'Members'})</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(pendingData?.totalPendingAmount || pendingData?.summary?.totalPendingAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 5. Active Loans Overview Section */}
      {loans.length > 0 && (
        <div className="report-section avoid-break">
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            4. {language === 'mr' ? 'गटाचा कर्ज पोर्टफोलिओ आढावा' : 'Group Loan Portfolio Overview'}
          </h3>
          <div className="table-responsive report-table-wrap">
            <table className="custom-table" style={{ fontSize: '0.85rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('reports.tableLoanNumber', 'Loan #')}</th>
                  <th>{t('reports.tableBorrower', 'Borrower')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tableOriginalLoan', 'Original Principal')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tablePrincipalRecovered', 'Principal Recovered')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tableInterestCollected', 'Interest Collected')}</th>
                  <th style={{ textAlign: 'right' }}>{t('reports.tableRemainingBalance', 'Remaining Balance')}</th>
                  <th>{t('common.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id || l.loan_id}>
                    <td style={{ fontWeight: 700 }}>{l.loan_number || l.loanNumber}</td>
                    <td>{l.member_name || l.memberName}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(l.principal_amount || l.principalAmount)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success-text)', fontWeight: 600 }}>{formatCurrency(l.total_principal_paid)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{formatCurrency(l.total_interest_paid)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: l.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                      {formatCurrency(l.outstanding_amount || l.outstandingAmount)}
                    </td>
                    <td>
                      <span className={`badge ${l.status === 'ACTIVE' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                        {l.status === 'ACTIVE' ? t('common.active', 'ACTIVE') : t('common.closed', 'CLOSED')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                  <td colSpan={2}>{language === 'mr' ? 'पोर्टफोलिओ एकूण' : 'PORTFOLIO TOTALS'} ({loans.length} {language === 'mr' ? 'कर्जे' : 'Loans'})</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(loansData?.summary?.totalPrincipalDisbursed)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>{formatCurrency(loansData?.summary?.totalPrincipalCollected)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{formatCurrency(loansData?.summary?.totalInterestCollected)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>{formatCurrency(loansData?.summary?.totalOutstanding)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 6. Signature and Verification Footer */}
      <div
        className="report-signatures avoid-break"
        style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '24px',
        }}
      >
        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ height: '40px', borderBottom: '1px dashed var(--text-muted)', marginBottom: '8px' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('reports.secretarySignature', 'Secretary Signature')}</span>
        </div>

        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ height: '40px', borderBottom: '1px dashed var(--text-muted)', marginBottom: '8px' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('reports.treasurerSignature', 'Treasurer Signature')}</span>
        </div>

        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ height: '40px', borderBottom: '1px dashed var(--text-muted)', marginBottom: '8px' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('reports.presidentAdminStamp', 'President / Admin Stamp')}</span>
        </div>
      </div>
    </div>
  );
};

export default FinancialReportDocument;
