import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../services/loanService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import RecordRepaymentModal from '../components/forms/RecordRepaymentModal';
import {
  HandCoins,
  Search,
  Plus,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ChevronRight,
  Eye,
} from 'lucide-react';

const Loans = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { refreshTrigger, openCreateLoan } = useOutletContext();

  const [loans, setLoans] = useState([]);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'CLOSED'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Local record repayment modal
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await loanService.getAllLoans({ status: activeTab, search });
      if (res.success) {
        setLoans(res.loans);
      }
    } catch (err) {
      console.error('Failed to load loans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [refreshTrigger, activeTab, search]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Manage Loans</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Track disbursed loans, monthly interest calculations, and member repayments
          </p>
        </div>

        {isAdmin && (
          <button onClick={openCreateLoan} className="btn-primary">
            <Plus size={18} /> Issue New Loan
          </button>
        )}
      </div>

      {/* Tabs & Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('ACTIVE')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'ACTIVE' ? 'var(--primary)' : 'var(--bg-subtle)',
              color: activeTab === 'ACTIVE' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Active Loans
          </button>

          <button
            onClick={() => setActiveTab('CLOSED')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'CLOSED' ? 'var(--success-text)' : 'var(--bg-subtle)',
              color: activeTab === 'CLOSED' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Closed Loans
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search
            size={18}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', fontSize: '0.85rem' }}
            placeholder="Search member or loan #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loans Grid */}
      {loading ? (
        <Loader text="Loading loans..." />
      ) : loans.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={activeTab === 'ACTIVE' ? 'No active loans' : 'No closed loans found'}
          description={
            activeTab === 'ACTIVE'
              ? 'There are currently no active outstanding loans in this Bachat Gat.'
              : 'Completed loan records will appear here once fully repaid.'
          }
          actionText={isAdmin && activeTab === 'ACTIVE' ? 'Issue Loan' : undefined}
          onAction={openCreateLoan}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {loans.map((l) => (
            <div
              key={l.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '22px',
                borderLeft: l.status === 'ACTIVE' ? '4px solid var(--primary)' : '4px solid var(--success)',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{l.member_name}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                      {l.member_code} • Loan: <code style={{ color: 'var(--primary)' }}>{l.loan_number}</code>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹{l.principal_amount.toLocaleString('en-IN')}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ORIGINAL LOAN</span>
                  </div>
                </div>

                {/* Info Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '3px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                    📅 {new Date(l.loan_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--primary)', fontWeight: 600 }}>
                    Interest: {l.interest_rate}% / mo
                  </span>
                </div>

                {/* Progress Bar & Repaid percentage */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Repaid: {l.repaid_percent}%</span>
                    <span style={{ color: l.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--success-text)', fontWeight: 700 }}>
                      Outstanding: ₹{l.outstanding_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${l.repaid_percent}%`,
                        background: l.repaid_percent === 100 ? 'var(--success)' : 'var(--primary-gradient)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>

                {/* Financial Summary Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    background: '#F8FAFC',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Principal Paid:</span>
                    <div style={{ fontWeight: 700, color: 'var(--success-text)' }}>₹{l.total_principal_repaid.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Interest Paid:</span>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{l.total_interest_paid.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  gap: '8px',
                }}
              >
                <button
                  onClick={() => navigate(`/loans/${l.id}`)}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <Eye size={14} /> View Details
                </button>

                {isAdmin && l.status === 'ACTIVE' && (
                  <button
                    onClick={() => {
                      setSelectedLoanId(l.id);
                      setIsRepayOpen(true);
                    }}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    <CreditCard size={14} /> Record Payment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Repayment Modal */}
      <RecordRepaymentModal
        isOpen={isRepayOpen}
        onClose={() => {
          setIsRepayOpen(false);
          setSelectedLoanId(null);
        }}
        onSuccess={fetchLoans}
        initialLoanId={selectedLoanId}
      />
    </div>
  );
};

export default Loans;
