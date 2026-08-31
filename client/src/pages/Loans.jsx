import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loanService } from '../services/loanService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import RecordRepaymentModal from '../components/forms/RecordRepaymentModal';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
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
  Building2,
  User,
} from 'lucide-react';

const Loans = () => {
  const { user, isAdmin, isMember, canManageLoans } = useAuth();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { refreshTrigger = 0, openCreateLoan } = outletContext;

  const [loans, setLoans] = useState([]);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'CLOSED'
  const [scope, setScope] = useState('all'); // 'all' | 'my'
  const [activeLoansCount, setActiveLoansCount] = useState(0);
  const [closedLoansCount, setClosedLoansCount] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalDisbursed, setTotalDisbursed] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Local record repayment modal
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const queryParams = { status: activeTab, search };
      if (scope === 'my' && user?.memberId) {
        queryParams.memberId = user.memberId;
      }

      const res = await loanService.getAllLoans(queryParams);
      if (res.success) {
        setLoans(res.loans || []);
        setActiveLoansCount(res.activeLoansCount || 0);
        setClosedLoansCount(res.closedLoansCount || 0);
        setTotalOutstanding(res.totalOutstanding || 0);
        setTotalDisbursed(res.totalDisbursed || 0);
      }
    } catch (err) {
      console.error('Failed to load loans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [refreshTrigger, activeTab, scope, search]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Group Loans & Repayments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Track group disbursed loans, monthly interest calculations, and member repayment schedules
          </p>
        </div>

        {isAdmin && (
          <button onClick={openCreateLoan} className="btn-primary">
            <Plus size={18} /> + Disburse New Loan
          </button>
        )}
      </div>

      {/* Summary Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px', borderColor: 'var(--primary-light)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            TOTAL ACTIVE OUTSTANDING
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            {formatCurrency(totalOutstanding)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Across {activeLoansCount} active loan(s)
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            TOTAL PRINCIPAL DISBURSED
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {formatCurrency(totalDisbursed)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {activeLoansCount + closedLoansCount} total loans recorded
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            ACTIVE / CLOSED STATUS
          </span>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
            {activeLoansCount} Active <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>/ {closedLoansCount} Closed</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            100% group transparency
          </span>
        </div>
      </div>

      {/* Tabs & Search & Scope */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Status Tabs */}
          <div className="tabs-container" style={{ margin: 0 }}>
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`tab-btn ${activeTab === 'ACTIVE' ? 'active' : ''}`}
            >
              Active Loans ({activeLoansCount})
            </button>
            <button
              onClick={() => setActiveTab('CLOSED')}
              className={`tab-btn ${activeTab === 'CLOSED' ? 'active' : ''}`}
            >
              Closed / Repaid ({closedLoansCount})
            </button>
          </div>

          {/* Scope Filter for Members */}
          {user?.memberId && (
            <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: 'var(--radius-md)', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setScope('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: scope === 'all' ? '#FFFFFF' : 'transparent',
                  color: scope === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: scope === 'all' ? 'var(--shadow-xs)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Building2 size={13} /> All Group Loans
              </button>
              <button
                type="button"
                onClick={() => setScope('my')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: scope === 'my' ? '#FFFFFF' : 'transparent',
                  color: scope === 'my' ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: scope === 'my' ? 'var(--shadow-xs)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <User size={13} /> My Loans
              </button>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={17}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
            placeholder="Search member or loan #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loans Grid */}
      {loading ? (
        <Loader text="Loading loans..." />
      ) : (!loans || loans.length === 0) ? (
        <div className="card">
          <EmptyState
            icon={HandCoins}
            title={activeTab === 'ACTIVE' ? (scope === 'my' ? 'You have no active loans' : 'No active loans') : (scope === 'my' ? 'You have no closed loans' : 'No closed loans')}
            description={
              activeTab === 'ACTIVE'
                ? (scope === 'my' ? 'You currently do not have any active loans with the group.' : 'There are currently no active outstanding loans in the group.')
                : (scope === 'my' ? 'You have no previous closed loans on record.' : 'No loans have been marked as fully repaid yet.')
            }
            actionText={scope === 'my' ? 'View All Group Loans' : (isAdmin && activeTab === 'ACTIVE' ? 'Disburse Loan' : undefined)}
            onAction={scope === 'my' ? () => setScope('all') : openCreateLoan}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {loans.map((l) => {
            const principal = Number(l.principal_amount || l.principalAmount || 0);
            const repaid = Number(l.total_principal_repaid || l.total_principal_paid || 0);
            const repaidPercent = principal > 0 ? Math.min(100, Math.round((repaid / principal) * 100)) : 0;
            const isMyLoan = user?.memberId && (l.memberId === user.memberId || l.member_id === user.memberId);

            return (
              <div
                key={l.id || l.loan_id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '22px',
                  borderLeft: l.status === 'ACTIVE' ? '4px solid var(--primary)' : '4px solid var(--success)',
                  background: isMyLoan ? 'linear-gradient(180deg, #FFFFFF 0%, #FFF5F8 100%)' : '#FFFFFF',
                }}
              >
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{l.member_name || l.memberName}</h3>
                        {isMyLoan && (
                          <span className="badge badge-pink" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>MY LOAN</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                        {l.member_code || l.memberCode} • Loan: <code style={{ color: 'var(--primary)' }}>{l.loan_number || l.loanNumber}</code>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatCurrency(l.principal_amount || l.principalAmount)}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ORIGINAL LOAN</span>
                    </div>
                  </div>

                  {/* Info Pills */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '3px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      📅 {formatDate(l.loan_date || l.loanDate || l.issueDate)}
                    </span>
                    <span style={{ fontSize: '0.75rem', background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--primary)', fontWeight: 600 }}>
                      Interest: {l.interest_rate || l.interestRate || 2}% / mo
                    </span>
                  </div>

                  {/* Progress Bar & Repaid percentage */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Repaid: {repaidPercent}%</span>
                      <span style={{ color: l.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--success-text)', fontWeight: 700 }}>
                        Outstanding: {formatCurrency(l.outstanding_amount || l.outstandingAmount || l.pendingPrincipal)}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${repaidPercent}%`,
                          background: repaidPercent === 100 ? 'var(--success)' : 'var(--primary-gradient)',
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
                      <div style={{ fontWeight: 700, color: 'var(--success-text)' }}>{formatCurrency(l.total_principal_repaid || l.total_principal_paid)}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Interest Paid:</span>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(l.total_interest_paid)}</div>
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
                    onClick={() => navigate(`/loans/${l.id || l.loan_id}`)}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    <Eye size={14} /> View Details
                  </button>

                  {isAdmin && l.status === 'ACTIVE' && (
                    <button
                      onClick={() => {
                        setSelectedLoanId(l.id || l.loan_id);
                        setIsRepayOpen(true);
                      }}
                      className="btn-outline"
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      <CreditCard size={14} /> Pay Installment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global Local Repayment Modal */}
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
