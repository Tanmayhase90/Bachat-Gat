import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { memberService } from '../services/memberService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import AddMemberModal from '../components/forms/AddMemberModal';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import {
  Users,
  Search,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  HandCoins,
  ChevronRight,
  Shield,
  Calendar,
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const Members = () => {
  const { canManageMembers, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const { refreshTrigger = 0, triggerRefresh, openAddMember } = outletContext;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'all'); // 'all' | 'pending'
  const [selectedMonth, setSelectedMonth] = useState(
    location.state?.selectedMonth ? Number(location.state.selectedMonth) : (new Date().getMonth() + 1)
  );
  const [selectedYear, setSelectedYear] = useState(
    location.state?.selectedYear ? Number(location.state.selectedYear) : new Date().getFullYear()
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
    if (location.state?.selectedMonth) {
      setSelectedMonth(Number(location.state.selectedMonth));
    }
    if (location.state?.selectedYear) {
      setSelectedYear(Number(location.state.selectedYear));
    }
  }, [location.state]);

  const handleOpenAdd = () => {
    if (openAddMember) {
      openAddMember();
    } else {
      setIsAddModalOpen(true);
    }
  };

  const handleSuccess = () => {
    fetchMembers();
    if (triggerRefresh) triggerRefresh();
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await memberService.getAllMembers({
        search,
        month: selectedMonth,
        year: selectedYear,
      });
      if (res.success) {
        const memberList = res.members || [];
        setMembers(memberList);

        const total = memberList.length;
        const paid = memberList.filter((m) => m.status === 'Paid').length;
        const pending = memberList.filter((m) => m.status === 'Pending').length;
        console.log("MONTHLY STATUS VALIDATION (MEMBERS PAGE)", {
          selectedMonth,
          selectedYear,
          total,
          paid,
          pending,
          balance: paid + pending === total,
        });
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [refreshTrigger, search, selectedMonth, selectedYear]);

  const isMemberPending = (m) => m.status === 'Pending' || m.due_status === 'Pending' || m.paymentStatus === 'Pending' || (m.current_due > 0 || m.currentDue > 0 || m.is_pending_dues || m.isPendingDues);
  const displayedMembers = activeTab === 'all'
    ? members
    : members.filter(isMemberPending);

  const pendingCount = members.filter(isMemberPending).length;

  const getRoleBadge = (role) => {
    const r = (role || 'MEMBER').toUpperCase();
    if (r === 'ADMIN') return <span className="badge badge-pink">ADMIN</span>;
    if (r === 'TREASURER') return <span className="badge badge-warning">TREASURER</span>;
    if (r === 'SECRETARY') return <span className="badge badge-info">SECRETARY</span>;
    return <span className="badge badge-success">MEMBER</span>;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Action Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Group Members</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage registered members, assigned roles, monthly shares, and pending dues for {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month / Year Filter Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
            <Calendar size={16} color="var(--primary)" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {(canManageMembers || isAdmin) && (
            <button
              onClick={handleOpenAdd}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '0.925rem',
                fontWeight: 700,
                boxShadow: 'var(--shadow-pink)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <UserPlus size={18} /> + Add Member
            </button>
          )}
        </div>
      </div>

      {/* Tabs, Add Member Action & Search Bar */}
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'all' ? 'var(--primary)' : 'var(--bg-subtle)',
              color: activeTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            All Members ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'pending' ? 'var(--danger)' : 'var(--bg-subtle)',
              color: activeTab === 'pending' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Pending Dues ({pendingCount})
          </button>
        </div>

        {/* Action Controls: [+ Add Member] [ 🔍 Search Bar ] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 auto' }}>
          {(canManageMembers || isAdmin) && (
            <button
              onClick={handleOpenAdd}
              className="btn-primary"
              style={{
                padding: '9px 18px',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserPlus size={16} /> + Add Member
            </button>
          )}

          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px', paddingRight: '12px', fontSize: '0.875rem' }}
              placeholder="Search by name, code, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Members Grid / Cards */}
      {loading ? (
        <Loader text="Fetching member records..." />
      ) : displayedMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={activeTab === 'pending' ? 'No Pending Dues!' : 'No Members Found'}
          description={
            activeTab === 'pending'
              ? 'All active members have successfully contributed their monthly savings.'
              : 'Try modifying your search or register a new member.'
          }
          actionText={canManageMembers && activeTab === 'all' ? 'Add Member' : undefined}
          onAction={openAddMember}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {displayedMembers.map((m) => {
            const isPending = isMemberPending(m);
            const memberDue = isPending ? (m.current_due !== undefined ? m.current_due : (m.currentDue !== undefined ? m.currentDue : 1000)) : 0;
            const memberPaid = Number(m.paid_amount ?? m.paidAmount ?? 0);
            const memberMonthlyShare = Number(m.monthly_share || m.monthlyShare || m.monthly_contribution || m.monthlyContribution || 1000);

            return (
              <div
                key={m.member_id || m.id}
                className="card keyboard-card"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/members/${m.member_id || m.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/members/${m.member_id || m.id}`);
                  }
                }}
                aria-label={`Open ${m.name} member profile`}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                  borderLeft: activeTab === 'pending'
                    ? (memberPaid > 0 ? '4px solid var(--warning)' : '4px solid var(--danger)')
                    : '4px solid var(--primary)',
                }}
              >
                <div>
                  {/* Member Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: 'var(--accent-soft)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                        }}
                      >
                        {(m.name || 'M').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</h3>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {m.member_code || m.memberCode || m.id} • Joined {formatDate(m.joined_date || m.joinDate || m.joinedAt, { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {getRoleBadge(m.role_name || m.role)}
                  </div>

                  {/* Payment Status Block - ONLY rendered in Pending Dues tab */}
                  {activeTab === 'pending' ? (
                    <div
                      style={{
                        background: memberPaid > 0 ? 'var(--warning-light, #FFFBEB)' : 'var(--danger-light, #FFF1F2)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        border: `1px solid ${memberPaid > 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.2)'}`,
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                          Current Dues
                        </span>
                        <div
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: memberPaid > 0 ? 'var(--warning-text, #B45309)' : 'var(--danger-text, #DC2626)',
                          }}
                        >
                          {formatCurrency(memberDue)}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: memberPaid > 0 ? 'var(--warning-text, #B45309)' : 'var(--danger-text, #DC2626)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {memberPaid > 0 ? (
                          <>
                            <AlertCircle size={14} /> Partially Paid
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} /> Pending
                          </>
                        )}
                      </span>
                    </div>
                  ) : (
                    /* All Members Tab: Shows clean monthly share box without payment status */
                    <div
                      style={{
                        background: 'var(--bg-subtle, #F8FAFC)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        border: '1px solid var(--border-color, #E2E8F0)',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Monthly Share
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(memberMonthlyShare)}/mo
                      </span>
                    </div>
                  )}

                  {/* Savings & Loan Highlights */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <PiggyBank size={15} color="var(--primary)" />
                      <span>Total: {formatCurrency(m.total_savings || m.totalSavings)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <HandCoins size={15} color="var(--warning)" />
                      <span>Loans: {formatCurrency(m.outstanding_loans || m.activeLoanAmount)}</span>
                    </div>
                  </div>
                </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                <span>View Full Member Profile</span>
                <ChevronRight size={16} />
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Local Add Member Modal Fallback */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Members;
