import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../services/loanService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import RecordRepaymentModal from '../components/forms/RecordRepaymentModal';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import {
  ArrowLeft,
  HandCoins,
  CreditCard,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calculator,
} from 'lucide-react';

const LoanDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageLoans } = useAuth();

  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRepayOpen, setIsRepayOpen] = useState(false);

  const fetchLoan = async () => {
    try {
      setLoading(true);
      const res = await loanService.getLoanById(id);
      if (res.success) {
        setLoan(res.loan);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoan();
  }, [id]);

  if (loading) return <Loader text="Loading loan profile..." />;
  if (!loan) return <EmptyState title="Loan not found" description="The requested loan record could not be found." />;

  const repaymentsList = loan.repayments || [];
  const totalPrincipalRepaid = repaymentsList.reduce((acc, r) => acc + (parseFloat(r.principal_repayment_amount || r.principalAmount) || 0), 0);
  const totalInterestPaid = repaymentsList.reduce((acc, r) => acc + (parseFloat(r.interest_amount || r.interestAmount) || 0), 0);
  const totalPaymentSum = totalPrincipalRepaid + totalInterestPaid;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <button
          onClick={() => navigate('/loans')}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} /> Back to Loans
        </button>
      </div>

      {/* Main Loan Info Card */}
      <div
        className="card"
        style={{
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          borderLeft: loan.status === 'ACTIVE' ? '5px solid var(--primary)' : '5px solid var(--success)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Loan #{loan.loan_number || loan.loanNumber}</h1>
            <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-warning' : 'badge-success'}`}>
              {loan.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} color="var(--primary)" />
              <strong style={{ color: 'var(--text-primary)' }}>{loan.member_name || loan.memberName}</strong> ({loan.member_code || loan.memberCode})
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="var(--text-muted)" />
              <span>Disbursed: {formatDate(loan.loan_date || loan.loanDate)}</span>
            </div>
          </div>

          {loan.purpose && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Purpose: {loan.purpose}
            </div>
          )}
        </div>

        {canManageLoans && loan.status === 'ACTIVE' && (
          <button onClick={() => setIsRepayOpen(true)} className="btn-primary">
            <CreditCard size={16} /> Record Repayment
          </button>
        )}
      </div>

      {/* Financial Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ORIGINAL PRINCIPAL</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>{formatCurrency(loan.principal_amount || loan.principalAmount)}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration: {loan.duration_months || 12} Months</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MONTHLY INTEREST RATE</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{loan.interest_rate || loan.interestRate || 2}% / month</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatCurrency(((Number(loan.outstanding_amount || 0)) * Number(loan.interest_rate || 2)) / 100)} on current balance</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CURRENT OUTSTANDING</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: loan.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--success-text)', marginTop: '4px' }}>
            {formatCurrency(loan.outstanding_amount || loan.outstandingAmount)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Repaid: {loan.repaid_percent || 0}%</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INTEREST PAID</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
            {formatCurrency(totalInterestPaid)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Over {repaymentsList.length} installment(s)</span>
        </div>
      </div>

      {/* Repayments Schedule Table */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Loan Repayment Schedule & History</h2>

        {repaymentsList.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No repayments recorded"
            description="No installment payments have been made on this loan yet."
            actionText={canManageLoans && loan.status === 'ACTIVE' ? 'Record Payment' : undefined}
            onAction={() => setIsRepayOpen(true)}
          />
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Installment Period</th>
                  <th>Principal Paid</th>
                  <th>Interest Paid</th>
                  <th>Total Payment</th>
                  <th>Payment Date</th>
                  <th>Mode</th>
                  <th>Remarks</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {repaymentsList.map((r) => (
                  <tr key={r.id || r.repayment_id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatMonthYear(r.payment_month || r.month, r.payment_year || r.year)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(r.principal_repayment_amount || r.principalAmount)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(r.interest_amount || r.interestAmount)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--success-text)' }}>{formatCurrency(r.total_payment || r.totalPayment)}</td>
                    <td>{formatDate(r.payment_date || r.paymentDate)}</td>
                    <td><span className="badge badge-info">{r.payment_mode || r.paymentMode || 'UPI'}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.remarks || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.recorded_by_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                  <td>TOTAL PAID</td>
                  <td style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalPrincipalRepaid)}</td>
                  <td style={{ color: 'var(--primary)' }}>{formatCurrency(totalInterestPaid)}</td>
                  <td style={{ color: 'var(--success-text)', fontSize: '1.05rem' }}>{formatCurrency(totalPaymentSum)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <RecordRepaymentModal
        isOpen={isRepayOpen}
        onClose={() => setIsRepayOpen(false)}
        onSuccess={fetchLoan}
        initialLoanId={loan.id}
      />
    </div>
  );
};

export default LoanDetails;
