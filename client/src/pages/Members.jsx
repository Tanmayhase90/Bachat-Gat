import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { memberService } from '../services/memberService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import AddMemberModal from '../components/forms/AddMemberModal';
import RecordSavingsModal from '../components/forms/RecordSavingsModal';
import { formatCurrency, formatDate, formatNumber, formatMonthYear, formatMonthlyHaftaDueDate } from '../utils/formatters';
import {
  Users,
  Search,
  X,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  HandCoins,
  ChevronRight,
  Shield,
  Calendar,
  Clock,
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
  const { canManageMembers, canManageSavings, isAdmin, monthlyHaftaDay } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const { refreshTrigger = 0, triggerRefresh, openAddMember, openRecordSavings } = outletContext;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRecordSavingsModalOpen, setIsRecordSavingsModalOpen] = useState(false);
  const [savingsModalProps, setSavingsModalProps] = useState({});
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'all'); // 'all' | 'pending'
  const [selectedMonth, setSelectedMonth] = useState(
    location.state?.selectedMonth
      ? Number(location.state.selectedMonth)
      : (sessionStorage.getItem('members_selected_month')
          ? Number(sessionStorage.getItem('members_selected_month'))
          : (new Date().getMonth() + 1))
  );
  const [selectedYear, setSelectedYear] = useState(
    location.state?.selectedYear
      ? Number(location.state.selectedYear)
      : (sessionStorage.getItem('members_selected_year')
          ? Number(sessionStorage.getItem('members_selected_year'))
          : new Date().getFullYear())
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

  useEffect(() => {
    sessionStorage.setItem('members_selected_month', String(selectedMonth));
    sessionStorage.setItem('members_selected_year', String(selectedYear));
  }, [selectedMonth, selectedYear]);

  const handleOpenAdd = () => {
    if (openAddMember) {
      openAddMember();
    } else {
      setIsAddModalOpen(true);
    }
  };

  const handleRecordSavingForMember = (m) => {
    const memberId = m.member_id || m.id;
    if (openRecordSavings) {
      openRecordSavings({
        memberId,
        month: selectedMonth,
        year: selectedYear,
      });
    } else {
      setSavingsModalProps({
        memberId,
        month: selectedMonth,
        year: selectedYear,
      });
      setIsRecordSavingsModalOpen(true);
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
        month: selectedMonth,
        year: selectedYear,
      });
      if (res.success) {
        const memberList = (res.members || []).filter(
          (m) => (m.role || '').toLowerCase() !== 'admin'
        );
        memberList.sort((a, b) => {
          const aId = a.memberId || a.member_id || a.memberCode || a.member_code || a.id || '';
          const bId = b.memberId || b.member_id || b.memberCode || b.member_code || b.id || '';
          const aNum = parseInt(String(aId).replace(/\D/g, ''), 10);
          const bNum = parseInt(String(bId).replace(/\D/g, ''), 10);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          if (!isNaN(aNum)) return -1;
          if (!isNaN(bNum)) return 1;
          return String(aId).localeCompare(String(bId), undefined, { numeric: true, sensitivity: 'base' });
        });
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
  }, [refreshTrigger, selectedMonth, selectedYear]);

  const isMemberPending = (m) => {
    if (!m) return false;
    if (m.isPaid === true || m.has_paid_current_month === true || m.hasPaidCurrentMonth === true) return false;
    if (m.status === 'Paid') return false;
    if (m.isPending === true || m.is_pending_dues === true || m.isPendingDues === true) return true;
    if (m.status === 'Pending' || m.status === 'Partially Paid') return true;
    if (m.current_due !== undefined && m.current_due > 0) return true;
    return false;
  };

  const pendingMembersList = members.filter(isMemberPending);
  const pendingCount = pendingMembersList.length;
  const displayedMembers = activeTab === 'pending' ? pendingMembersList : members;

  // Real-time case-insensitive search by Name, Member Code, and Phone Number
  const searchLower = search.trim().toLowerCase();
  const filteredMembers = displayedMembers.filter((m) => {
    if (!searchLower) return true;
    const name = String(m.name || m.fullName || m.full_name || '').toLowerCase();
    const code = String(m.memberCode || m.member_code || m.code || m.id || '').toLowerCase();
    const phone = String(m.phone || m.mobile || m.phoneNumber || m.phone_number || m.mobileNumber || m.mobile_number || '').toLowerCase();
    return name.includes(searchLower) || code.includes(searchLower) || phone.includes(searchLower);
  });

  // Sort all members by Member ID in ascending numerical order before displaying them (e.g. M_1, M_2 ... M_9, M_10 ... M_99, M_100 ... M_364)
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const aId = a.memberId || a.member_id || a.memberCode || a.member_code || a.id || '';
    const bId = b.memberId || b.member_id || b.memberCode || b.member_code || b.id || '';
    const aNum = parseInt(String(aId).replace(/\D/g, ''), 10);
    const bNum = parseInt(String(bId).replace(/\D/g, ''), 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return String(aId).localeCompare(String(bId), undefined, { numeric: true, sensitivity: 'base' });
  });

  const getRoleBadge = (role) => {
    const roleKey = (role || 'MEMBER').toUpperCase();
    const roleLabel = t(`common.roles.${roleKey}`, role || 'Member');
    switch (roleKey) {
      case 'TREASURER':
        return <span className="badge badge-warning">{roleLabel}</span>;
      case 'SECRETARY':
        return <span className="badge badge-info">{roleLabel}</span>;
      case 'MEMBER':
      default:
        return <span className="badge badge-success">{roleLabel}</span>;
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Action Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('members.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('members.subtitle')} ({t(`common.months.${selectedMonth}`)} {selectedYear})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Monthly Hafta Due Date Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              color: 'var(--primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <Clock size={14} />
            <span>{formatMonthlyHaftaDueDate(monthlyHaftaDay, language)}</span>
          </div>

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
                  {t(`common.months.${m.value}`, m.label)}
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
              <UserPlus size={18} /> {t('members.addMemberBtn')}
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
            {t('members.allMembersTab')} ({members.length})
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
            {t('members.pendingDuesTab')} ({pendingCount})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '360px', minWidth: '220px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{
              paddingLeft: '38px',
              paddingRight: search ? '36px' : '12px',
              fontSize: '0.875rem',
              width: '100%',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border-color)',
            }}
            placeholder={language === 'mr' ? 'नाव, सभासद कोड किंवा फोन नंबरने शोधा...' : 'Search by name, member code, or phone...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={language === 'mr' ? 'शोध साफ करा' : 'Clear search'}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Members Grid / Cards */}
      {loading ? (
        <Loader text={t('common.loadingData')} />
      ) : sortedMembers.length === 0 ? (
        <EmptyState
          icon={searchLower ? Search : Users}
          title={
            searchLower
              ? (language === 'mr' ? 'कोणताही सभासद सापडला नाही' : 'No members found matching your search')
              : (activeTab === 'pending' ? t('dashboard.allMembersPaid') : t('members.noMembersFound'))
          }
          description={
            searchLower
              ? (language === 'mr' ? `"${search}" शी जुळणारा कोणताही सभासद आढळला नाही.` : `No members match "${search}". Try searching with a different name, code, or phone number.`)
              : (activeTab === 'pending' ? t('dashboard.allMembersPaid') : t('members.noMembersFound'))
          }
          actionText={!searchLower && canManageMembers && activeTab === 'all' ? t('members.addMemberBtn') : undefined}
          onAction={openAddMember}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {sortedMembers.map((m) => {
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
                onClick={() => navigate(`/members/${m.member_id || m.id}`, { state: { selectedMonth, selectedYear, activeTab } })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/members/${m.member_id || m.id}`, { state: { selectedMonth, selectedYear, activeTab } });
                  }
                }}
                aria-label={`Open ${m.name} member profile`}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                  borderLeft: isPending
                    ? (memberPaid > 0 ? '4px solid var(--warning)' : '4px solid var(--danger)')
                    : '4px solid var(--success, #10B981)',
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
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{m.name}</h3>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                          {m.member_code || m.memberCode || m.id} • {formatDate(m.joined_date || m.joinDate || m.joinedAt, { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {getRoleBadge(m.role_name || m.role)}
                  </div>

                  {/* Month + Year Payment Status Block */}
                  <div
                    style={{
                      background: isPending
                        ? (memberPaid > 0 ? 'var(--warning-light, #FFFBEB)' : 'var(--danger-light, #FFF1F2)')
                        : 'var(--success-light, #ECFDF5)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      border: `1px solid ${
                        isPending
                          ? (memberPaid > 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.2)')
                          : 'rgba(16, 185, 129, 0.25)'
                      }`,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                        {formatMonthYear(selectedMonth, selectedYear)}
                      </span>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: isPending
                            ? (memberPaid > 0 ? 'var(--warning-text, #B45309)' : 'var(--danger-text, #DC2626)')
                            : 'var(--success-text, #059669)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          marginTop: '2px',
                        }}
                      >
                        {isPending ? (
                          <>
                            <AlertCircle size={15} />
                            <span>{t('common.pending', 'Pending')}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={15} />
                            <span>{t('common.paid', 'Paid')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {isPending ? t('members.tableCurrentDues', 'Due') : t('savings.paidAmount', 'Paid')}
                      </span>
                      <div
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          color: isPending
                            ? (memberPaid > 0 ? 'var(--warning-text, #B45309)' : 'var(--danger-text, #DC2626)')
                            : 'var(--success-text, #059669)',
                        }}
                      >
                        {formatCurrency(isPending ? (memberDue > 0 ? memberDue : memberMonthlyShare) : (memberPaid > 0 ? memberPaid : memberMonthlyShare))}
                      </div>
                    </div>
                  </div>

                  {/* Direct "Record Saving" / "Collect" Button for Pending Member (Pending Dues Tab Only) */}
                  {activeTab === 'pending' && isPending && (canManageSavings || isAdmin || canManageMembers) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecordSavingForMember(m);
                      }}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginBottom: '12px',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-pink)',
                        cursor: 'pointer',
                      }}
                    >
                      <PiggyBank size={15} />
                      {t('savings.recordSavingsBtn', 'Record Saving')}
                    </button>
                  )}

                  {/* Monthly Share Box */}
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
                      {t('members.tableMonthlyShare')}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {formatCurrency(memberMonthlyShare)}/mo
                    </span>
                  </div>

                  {/* Savings & Loan Highlights */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <PiggyBank size={15} color="var(--primary)" />
                      <span>{t('dashboard.totalSavings')}: {formatCurrency(m.total_savings || m.totalSavings)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <HandCoins size={15} color="var(--warning)" />
                      <span>{t('dashboard.activeLoans')}: {formatCurrency(m.outstanding_loans || m.activeLoanAmount)}</span>
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
                <span>{t('members.memberDetails')}</span>
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

      {/* Record Savings Modal */}
      <RecordSavingsModal
        key={`members-savings-modal-${savingsModalProps.memberId || ''}-${savingsModalProps.month || selectedMonth}-${savingsModalProps.year || selectedYear}-${isRecordSavingsModalOpen}`}
        isOpen={isRecordSavingsModalOpen}
        onClose={() => {
          setIsRecordSavingsModalOpen(false);
          setSavingsModalProps({});
        }}
        onSuccess={handleSuccess}
        initialMemberId={savingsModalProps.memberId || null}
        initialMonth={savingsModalProps.month || selectedMonth}
        initialYear={savingsModalProps.year || selectedYear}
      />
    </div>
  );
};

export default Members;
