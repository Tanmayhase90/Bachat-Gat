import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../services/loanService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import RecordRepaymentModal from '../components/forms/RecordRepaymentModal';
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
  const { isAdmin } = useAuth();

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

  const totalPrincipalRepaid = loan.repayments.reduce((sum, r) => sum + parseFloat(r.principal_repayment_amount), 0);
  const totalInterestPaid = loan.repayments.reduce((sum, r) => sum + parseFloat(r.interest_amount), 0);
  const totalPaymentSum = loan.repayments.reduce((sum, r) => sum + parseFloat(r.total_payment), 0);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <button
        onClick={() => navigate('/loans')}
        style={{
          background: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: '0.875rem',
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={16} /> Back to Loans
      </button>

      {/* Hero Card */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF5F8 100%)',
          borderColor: 'rgba(194, 24, 91, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Loan {loan.loan_number}</h1>
            <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-warning' : 'badge-success'}`}>
              {loan.status}
            </span>
          </div>

          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loan.member_name}</span>
            <span>({loan.member_code})</span>
            <span>•</span>
            <span>Disbursed: {new Date(loan.loan_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          {loan.purpose && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Purpose: {loan.purpose}
            </div>
          )}
        </div>

        {isAdmin && loan.status === 'ACTIVE' && (
          <button onClick={() => setIsRepayOpen(true)} className="btn-primary">
            <CreditCard size={16} /> Record Repayment
          </button>
        )}
      </div>

      {/* Financial Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ORIGINAL PRINCIPAL</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>₹{loan.principal_amount.toLocaleString('en-IN')}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration: {loan.duration_months} Months</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MONTHLY INTEREST RATE</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{loan.interest_rate}% / month</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>₹{loan.calculated_monthly_interest.toFixed(2)} on current balance</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CURRENT OUTSTANDING</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: loan.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--success-text)', marginTop: '4px' }}>
            ₹{loan.outstanding_amount.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Repaid: {loan.repaid_percent}%</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INTEREST PAID</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
            ₹{totalInterestPaid.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Over {loan.repayments.length} installment(s)</span>
        </div>
      </div>

      {/* Repayments Schedule Table */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Loan Repayment Schedule & History</h2>

        {loan.repayments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No repayments recorded"
            description="No installment payments have been made on this loan yet."
            actionText={isAdmin && loan.status === 'ACTIVE' ? 'Record Payment' : undefined}
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
                {loan.repayments.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {new Date(r.payment_year, r.payment_month - 1).toLocaleString('default', { month: 'long' })} {r.payment_year}
                    </td>
                    <td style={{ fontWeight: 600 }}>₹{parseFloat(r.principal_repayment_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{parseFloat(r.interest_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 800, color: 'var(--success-text)' }}>₹{parseFloat(r.total_payment).toLocaleString('en-IN')}</td>
                    <td>{new Date(r.payment_date).toLocaleDateString('en-IN')}</td>
                    <td><span className="badge badge-info">{r.payment_mode}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.remarks || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.recorded_by_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                  <td>TOTAL PAID</td>
                  <td style={{ color: 'var(--text-primary)' }}>₹{totalPrincipalRepaid.toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--primary)' }}>₹{totalInterestPaid.toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--success-text)', fontSize: '1.05rem' }}>₹{totalPaymentSum.toLocaleString('en-IN')}</td>
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
        initialLoanId={parseInt(id, 10)}
      />
    </div>
  );
};

export default LoanDetails;
