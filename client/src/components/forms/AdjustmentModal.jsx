import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../common/Modal';
import { adjustmentService } from '../../services/adjustmentService';
import { loanService } from '../../services/loanService';
import { formatCurrency, formatDate, formatMonthYear, compareMemberNumericOrder, getLoanMonthYear } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import {
  SlidersHorizontal,
  PiggyBank,
  HandCoins,
  CreditCard,
  Coins,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  User,
  ShieldCheck,
  Clock,
  FileText,
  RotateCcw,
} from 'lucide-react';

const AdjustmentModal = ({ isOpen, onClose, onSuccess, initialMemberId = null }) => {
  const { t, language } = useLanguage();
  const currentDate = new Date();

  // Mode Tabs: 'initial' | 'savings' | 'loan' | 'repayment'
  const [activeTab, setActiveTab] = useState('initial');

  // Members list & member selection state
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  // Selected member historical ledger preview
  const [memberHistorical, setMemberHistorical] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Forms states
  const [initialForm, setInitialForm] = useState({
    amount: '10000',
    payment_date: '2026-07-01',
    payment_mode: 'Opening Balance',
    remarks: 'Initial group opening amount',
  });

  const [savingsForm, setSavingsForm] = useState({
    month: '7',
    year: '2026',
    amount: '1000',
    payment_date: '2026-07-10',
    payment_mode: 'Cash',
    remarks: '',
  });

  const [loanForm, setLoanForm] = useState({
    principal_amount: '5000',
    interest_rate: '2.0',
    duration_months: '12',
    loan_date: '2026-07-15',
    purpose: 'Historical Loan',
  });

  const [repayForm, setRepayForm] = useState({
    loan_id: '',
    principal_amount: '1000',
    interest_amount: '100',
    month: '7',
    year: '2026',
    payment_date: '2026-07-20',
    payment_mode: 'Cash',
    remarks: 'Historical repayment',
  });

  // UI action states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [availableBalance, setAvailableBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const toastTimeoutRef = useRef(null);

  const showSuccessToast = (msg) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setError('');
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const fetchGroupBalance = async () => {
    try {
      setLoadingBalance(true);
      const res = await loanService.getAvailableBalance();
      if (res && typeof res.availableBalance === 'number') {
        setAvailableBalance(res.availableBalance);
      }
    } catch (err) {
      console.error('Failed to load available balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Load all active members and group balance on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setToastMessage('');
      setMemberSearch('');
      setMemberHistorical(null);
      fetchGroupBalance();

      const fetchMembers = async () => {
        try {
          setLoadingMembers(true);
          const res = await adjustmentService.getActiveMembers();
          if (res.success && res.members) {
            setMembers(res.members);
            const targetId = initialMemberId || (res.members.length > 0 ? res.members[0].id : '');
            if (targetId) {
              setSelectedMemberId(targetId);
            }
          }
        } catch (err) {
          console.error('Failed to load active members:', err);
          setError(err.message || 'Failed to load members');
        } finally {
          setLoadingMembers(false);
        }
      };

      fetchMembers();
    }
  }, [isOpen, initialMemberId]);

  // Load selected member historical data whenever selectedMemberId changes
  useEffect(() => {
    if (isOpen && selectedMemberId) {
      setError('');
      const fetchHistory = async () => {
        try {
          setLoadingHistory(true);
          const res = await adjustmentService.getMemberHistoricalData(selectedMemberId);
          if (res.success) {
            setMemberHistorical(res);
            // If member has active loans and repayment tab is open, pre-select first loan
            if (res.loans && res.loans.length > 0) {
              const activeLoan = res.loans.find((l) => (l.status || '').toUpperCase() === 'ACTIVE') || res.loans[0];
              if (activeLoan) {
                const pAmt = Math.min(1000, activeLoan.pendingPrincipal || activeLoan.originalPrincipal || 1000);
                const iAmt = Math.round((((activeLoan.pendingPrincipal || activeLoan.originalPrincipal || 1000) * (activeLoan.interestRate || 2)) / 100) * 100) / 100;
                setRepayForm((prev) => ({
                  ...prev,
                  loan_id: activeLoan.id || activeLoan.loanId,
                  principal_amount: pAmt.toString(),
                  interest_amount: iAmt.toString(),
                }));
              }
            } else {
              setRepayForm((prev) => ({ ...prev, loan_id: '' }));
            }
          }
        } catch (err) {
          console.error('Failed to load member history:', err);
        } finally {
          setLoadingHistory(false);
        }
      };

      fetchHistory();
    }
  }, [isOpen, selectedMemberId]);

  // Refresh history and group balance after a successful adjustment
  const refreshMemberData = async () => {
    fetchGroupBalance();
    if (selectedMemberId) {
      const res = await adjustmentService.getMemberHistoricalData(selectedMemberId);
      if (res.success) {
        setMemberHistorical(res);
      }
      // Also refresh active members list
      const mRes = await adjustmentService.getActiveMembers();
      if (mRes.success && mRes.members) {
        setMembers(mRes.members);
      }
    }
    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  };

  const selectedMember = members.find((m) => String(m.id) === String(selectedMemberId));

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const query = memberSearch.toLowerCase().trim();
    const name = (m.name || m.fullName || '').toLowerCase();
    const code = (m.memberCode || m.member_code || '').toLowerCase();
    const id = (m.id || '').toLowerCase();
    return name.includes(query) || code.includes(query) || id.includes(query);
  });

  // Determine current loan form month/year and detect existing loan for same month/year
  const { month: formLoanMonth, year: formLoanYear } = getLoanMonthYear(loanForm.loan_date);

  const existingMonthLoan = (memberHistorical?.loans || []).find((l) => {
    const lDate = l.issueDate || l.loanDate || l.loan_date || l.createdAt;
    const { month: lMonth, year: lYear } = getLoanMonthYear(lDate);
    return lMonth === formLoanMonth && lYear === formLoanYear;
  });

  // Auto-populate loan form when existing loan is detected for selected member & month/year
  const lastLoadedLoanKeyRef = useRef('');

  useEffect(() => {
    if (!isOpen) {
      lastLoadedLoanKeyRef.current = '';
      return;
    }
    if (selectedMemberId && formLoanMonth && formLoanYear) {
      const loanKey = `${selectedMemberId}_${formLoanYear}_${formLoanMonth}`;
      if (lastLoadedLoanKeyRef.current !== loanKey) {
        lastLoadedLoanKeyRef.current = loanKey;
        if (existingMonthLoan) {
          setLoanForm((prev) => ({
            ...prev,
            principal_amount: String(
              existingMonthLoan.originalPrincipal !== undefined
                ? existingMonthLoan.originalPrincipal
                : (existingMonthLoan.principalAmount || existingMonthLoan.principal_amount || '5000')
            ),
            interest_rate: String(
              existingMonthLoan.interestRate !== undefined
                ? existingMonthLoan.interestRate
                : (existingMonthLoan.interest_rate || '2.0')
            ),
            duration_months: String(
              existingMonthLoan.durationMonths || existingMonthLoan.duration_months || '12'
            ),
            purpose: existingMonthLoan.purpose || 'Historical Loan',
            loan_date: existingMonthLoan.issueDate || existingMonthLoan.loanDate || existingMonthLoan.loan_date || prev.loan_date,
          }));
        }
      }
    }
  }, [isOpen, selectedMemberId, formLoanMonth, formLoanYear, existingMonthLoan]);

  // Real-time Historical Loan available balance validation (strictly against actual group available balance)
  const enteredLoanPrincipal = parseFloat(loanForm.principal_amount);

  const isLoanAmountInvalid =
    availableBalance !== null &&
    (
      (availableBalance <= 0 && (!Number.isFinite(enteredLoanPrincipal) || enteredLoanPrincipal > 0)) ||
      (Number.isFinite(enteredLoanPrincipal) && enteredLoanPrincipal > availableBalance)
    );

  const loanValidationErrorMessage = isLoanAmountInvalid
    ? (
        availableBalance <= 0
          ? t('adjustment.loanExceedsZero', 'Loan amount cannot exceed available balance of ₹0.')
          : t('adjustment.loanAmountCannotExceed', { amount: formatCurrency(availableBalance) }) ||
            `Loan amount cannot exceed available balance of ${formatCurrency(availableBalance)}.`
      )
    : '';

  // 1. Submit Initial One-Time Opening Amount
  const handleSaveInitial = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      await adjustmentService.recordInitialAmount({
        member_id: selectedMemberId,
        amount: initialForm.amount,
        payment_date: initialForm.payment_date,
        payment_mode: initialForm.payment_mode,
        remarks: initialForm.remarks,
      });
      showSuccessToast(t('adjustment.initialSuccess', 'Initial opening amount saved successfully.'));
      await refreshMemberData();
    } catch (err) {
      setError(err.message || 'Failed to save initial opening amount');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit Historical Monthly Saving
  const handleSaveSavings = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      await adjustmentService.recordHistoricalSaving({
        member_id: selectedMemberId,
        month: savingsForm.month,
        year: savingsForm.year,
        amount: savingsForm.amount,
        payment_date: savingsForm.payment_date,
        payment_mode: savingsForm.payment_mode,
        remarks: savingsForm.remarks,
      });
      showSuccessToast(t('adjustment.savingSuccess', 'Historical monthly saving saved successfully.'));
      await refreshMemberData();
    } catch (err) {
      setError(err.message || 'Failed to save historical saving');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Submit Historical Loan (with Unique Month/Year Update vs Create & Available Balance protection)
  const handleSaveLoan = async (e) => {
    e.preventDefault();
    const enteredPrincipal = parseFloat(loanForm.principal_amount);

    if (!Number.isFinite(enteredPrincipal) || isNaN(enteredPrincipal) || enteredPrincipal <= 0) {
      setError(t('modals.invalidLoanAmount', 'Please enter a valid positive loan amount.'));
      return;
    }

    if (availableBalance !== null) {
      if (availableBalance <= 0) {
        setError(t('adjustment.loanExceedsZero', 'Loan amount cannot exceed available balance of ₹0.'));
        return;
      }
      if (enteredPrincipal > availableBalance) {
        const maxStr = formatCurrency(availableBalance);
        setError(
          t('adjustment.loanAmountCannotExceed', { amount: maxStr }) ||
          `Loan amount cannot exceed available balance of ${maxStr}.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await adjustmentService.recordHistoricalLoan({
        member_id: selectedMemberId,
        principal_amount: loanForm.principal_amount,
        interest_rate: loanForm.interest_rate,
        duration_months: loanForm.duration_months,
        loan_date: loanForm.loan_date,
        purpose: loanForm.purpose,
      });

      const successMsg = res.isUpdated
        ? t('adjustment.loanUpdatedSuccess', 'Historical loan updated successfully.')
        : t('adjustment.loanSuccess', 'Historical loan saved successfully.');

      showSuccessToast(successMsg);
      await refreshMemberData();
    } catch (err) {
      setError(err.message || 'Failed to record historical loan');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Submit Historical Repayment
  const handleSaveRepayment = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      if (!repayForm.loan_id) {
        throw new Error('Please select a loan for repayment');
      }
      await adjustmentService.recordHistoricalRepayment({
        loan_id: repayForm.loan_id,
        member_id: selectedMemberId,
        principal_amount: repayForm.principal_amount,
        interest_amount: repayForm.interest_amount,
        month: repayForm.month,
        year: repayForm.year,
        payment_date: repayForm.payment_date,
        payment_mode: repayForm.payment_mode,
        remarks: repayForm.remarks,
      });
      showSuccessToast(t('adjustment.repaySuccess', 'Historical repayment saved successfully.'));
      await refreshMemberData();
    } catch (err) {
      setError(err.message || 'Failed to record historical repayment');
    } finally {
      setSubmitting(false);
    }
  };

  const months = [
    { value: 1, label: t('common.months.1', 'January') },
    { value: 2, label: t('common.months.2', 'February') },
    { value: 3, label: t('common.months.3', 'March') },
    { value: 4, label: t('common.months.4', 'April') },
    { value: 5, label: t('common.months.5', 'May') },
    { value: 6, label: t('common.months.6', 'June') },
    { value: 7, label: t('common.months.7', 'July') },
    { value: 8, label: t('common.months.8', 'August') },
    { value: 9, label: t('common.months.9', 'September') },
    { value: 10, label: t('common.months.10', 'October') },
    { value: 11, label: t('common.months.11', 'November') },
    { value: 12, label: t('common.months.12', 'December') },
  ];

  const paymentModes = [
    { value: 'Opening Balance', label: 'Opening Balance' },
    { value: 'Cash', label: t('common.cash', 'Cash') },
    { value: 'UPI', label: t('common.upi', 'UPI') },
    { value: 'Bank Transfer', label: t('common.bankTransfer', 'Bank Transfer') },
    { value: 'Cheque', label: t('common.cheque', 'Cheque') },
  ];

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('adjustment.modalTitle', 'Manual Historical Data Adjustment')}
      maxWidth="780px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Intro Subtitle */}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          {t('adjustment.modalSubtitle', 'Temporary manual entry of group opening balance and historical savings / loans')}
        </p>

        {/* Error Alert */}
        {error && (
          <div
            className="alert alert-danger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--danger-light, #FEE2E2)',
              color: 'var(--danger-text, #B91C1C)',
              border: '1px solid #F87171',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 1: MEMBER SELECTION (IMMEDIATELY VISIBLE UPFRONT)     */}
        {/* ============================================================ */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} color="var(--primary)" />
              {t('adjustment.memberListTitle', 'Active Members List')} ({members.length})
            </label>

            {/* Quick Search Filter */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={t('adjustment.searchMembers', 'Search member...')}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 10px 5px 30px',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                }}
              />
            </div>
          </div>

          {/* Members Horizontal / Grid List (Visible Immediately) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
              maxHeight: '150px',
              overflowY: 'auto',
              padding: '4px',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-md)',
              background: '#FFFFFF',
            }}
          >
            {loadingMembers ? (
              <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('common.loading', 'Loading members...')}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('common.noDataFound', 'No matching members found')}
              </div>
            ) : (
              filteredMembers.map((m) => {
                const isSelected = String(m.id) === String(selectedMemberId);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMemberId(m.id);
                      setError('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid #E2E8F0',
                      background: isSelected ? 'var(--accent-soft)' : '#FAFAFA',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name || m.fullName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <code>{m.memberCode || m.member_code || m.id}</code>
                        <span>•</span>
                        <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{formatCurrency(m.totalSavings || m.total_savings || 0)}</span>
                      </div>
                    </div>
                    {isSelected && <Check size={16} color="var(--primary)" style={{ flexShrink: 0, marginLeft: '6px' }} />}
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Member Financial Overview Card */}
          {selectedMember && (
            <div
              style={{
                background: 'linear-gradient(135deg, #FFF5F8 0%, #FFFFFF 100%)',
                border: '1px solid rgba(194, 24, 91, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--primary-gradient)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                  }}
                >
                  {(selectedMember.name || 'M').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {selectedMember.name} <code>({selectedMember.memberCode})</code>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t('adjustment.baseSavings', 'Base Opening')}:{' '}
                    <strong style={{ color: memberHistorical?.initialAmount > 0 ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                      {formatCurrency(memberHistorical?.initialAmount || 0)}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('adjustment.totalSavings', 'Total Savings')}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success-text)' }}>
                    {formatCurrency(memberHistorical?.totalSavings || selectedMember.totalSavings || 0)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('adjustment.activeLoans', 'Loan Balance')}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: (memberHistorical?.totalOutstanding || selectedMember.outstandingLoans || 0) > 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                    {formatCurrency(memberHistorical?.totalOutstanding || selectedMember.outstandingLoans || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 2: 4 ADJUSTMENT WORKFLOW TABS                         */}
        {/* ============================================================ */}
        <div className="tabs-container" style={{ margin: '0' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('initial');
              setError('');
            }}
            className={`tab-btn ${activeTab === 'initial' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
          >
            <Coins size={15} /> {t('adjustment.tabInitial', '1. Initial Starting Amount')}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('savings');
              setError('');
            }}
            className={`tab-btn ${activeTab === 'savings' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
          >
            <PiggyBank size={15} /> {t('adjustment.tabSavings', '2. Monthly Savings')}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('loan');
              setError('');
            }}
            className={`tab-btn ${activeTab === 'loan' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
          >
            <HandCoins size={15} /> {t('adjustment.tabLoans', '3. Historical Loan')}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('repayment');
              setError('');
            }}
            className={`tab-btn ${activeTab === 'repayment' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
          >
            <CreditCard size={15} /> {t('adjustment.tabRepayments', '4. Loan Repayment')}
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: INITIAL ONE-TIME GROUP STARTING AMOUNT (MONTH 0)      */}
        {/* ============================================================ */}
        {activeTab === 'initial' && (
          <form onSubmit={handleSaveInitial} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem', color: '#92400E' }}>
              💡 {t('adjustment.initialAmountHelp', 'One-time starting amount paid when the group formed (Month 0). This is separate from monthly savings and adds to member total savings.')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.initialAmountLabel', 'Initial Group Starting Amount (₹)')} *</label>
                <input
                  type="number"
                  className="form-input"
                  value={initialForm.amount}
                  onChange={(e) => setInitialForm({ ...initialForm, amount: e.target.value })}
                  placeholder="e.g. 10000"
                  min="1"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.startDateLabel', 'Actual Start / Payment Date')} *</label>
                <input
                  type="date"
                  className="form-input"
                  value={initialForm.payment_date}
                  onChange={(e) => setInitialForm({ ...initialForm, payment_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.paymentModeLabel', 'Payment Mode')}</label>
                <select
                  className="form-select"
                  value={initialForm.payment_mode}
                  onChange={(e) => setInitialForm({ ...initialForm, payment_mode: e.target.value })}
                >
                  {paymentModes.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.remarksLabel', 'Notes / Remarks')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={initialForm.remarks}
                  onChange={(e) => setInitialForm({ ...initialForm, remarks: e.target.value })}
                  placeholder="e.g. Initial group opening amount"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !selectedMemberId}
              style={{ marginTop: '6px', alignSelf: 'flex-start', padding: '10px 20px' }}
            >
              <Coins size={16} /> {submitting ? t('common.loading', 'Saving...') : t('adjustment.saveInitialBtn', 'Save Initial Opening Amount')}
            </button>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAB 2: HISTORICAL MONTHLY SAVINGS                            */}
        {/* ============================================================ */}
        {activeTab === 'savings' && (
          <form onSubmit={handleSaveSavings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.savingMonthLabel', 'Historical Month')} *</label>
                <select
                  className="form-select"
                  value={savingsForm.month}
                  onChange={(e) => {
                    const m = e.target.value;
                    setSavingsForm({
                      ...savingsForm,
                      month: m,
                      payment_date: `${savingsForm.year}-${String(m).padStart(2, '0')}-10`,
                    });
                  }}
                  required
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.savingYearLabel', 'Year')} *</label>
                <input
                  type="number"
                  className="form-input"
                  value={savingsForm.year}
                  onChange={(e) => {
                    const y = e.target.value;
                    setSavingsForm({
                      ...savingsForm,
                      year: y,
                      payment_date: `${y}-${String(savingsForm.month).padStart(2, '0')}-10`,
                    });
                  }}
                  placeholder="2026"
                  min="2000"
                  max="2100"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.savingAmountLabel', 'Monthly Savings Amount (₹)')} *</label>
                <input
                  type="number"
                  className="form-input"
                  value={savingsForm.amount}
                  onChange={(e) => setSavingsForm({ ...savingsForm, amount: e.target.value })}
                  placeholder="e.g. 1000"
                  min="1"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.savingDateLabel', 'Actual Historical Payment Date')} *</label>
                <input
                  type="date"
                  className="form-input"
                  value={savingsForm.payment_date}
                  onChange={(e) => setSavingsForm({ ...savingsForm, payment_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.paymentModeLabel', 'Payment Mode')}</label>
                <select
                  className="form-select"
                  value={savingsForm.payment_mode}
                  onChange={(e) => setSavingsForm({ ...savingsForm, payment_mode: e.target.value })}
                >
                  {paymentModes.filter((m) => m.value !== 'Opening Balance').map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.remarksLabel', 'Notes / Remarks')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={savingsForm.remarks}
                  onChange={(e) => setSavingsForm({ ...savingsForm, remarks: e.target.value })}
                  placeholder="e.g. July 2026 savings"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !selectedMemberId}
              style={{ marginTop: '6px', alignSelf: 'flex-start', padding: '10px 20px' }}
            >
              <PiggyBank size={16} /> {submitting ? t('common.loading', 'Saving...') : t('adjustment.saveSavingsBtn', 'Save Historical Monthly Saving')}
            </button>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAB 3: HISTORICAL LOAN                                       */}
        {/* ============================================================ */}
        {activeTab === 'loan' && (
          <form onSubmit={handleSaveLoan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {existingMonthLoan && (
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: '#1E40AF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <SlidersHorizontal size={14} />
                <span>
                  {t('adjustment.editingExistingLoan', {
                    monthYear: formatMonthYear(formLoanMonth, formLoanYear, language),
                  })}: <strong>{existingMonthLoan.loanNumber || `LN-${String(existingMonthLoan.id).slice(-6)}`}</strong> ({formatCurrency(existingMonthLoan.originalPrincipal)})
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>{t('adjustment.loanAmountLabel', 'Loan Principal Amount (₹)')} *</label>
                  {availableBalance !== null && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: availableBalance > 0 ? 'var(--text-secondary)' : 'var(--danger-text)' }}>
                      {t('adjustment.availableBalanceForLoan', 'Available:')} <strong style={{ color: availableBalance > 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{formatCurrency(availableBalance)}</strong>
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  className="form-input"
                  value={loanForm.principal_amount}
                  onChange={(e) => {
                    setLoanForm({ ...loanForm, principal_amount: e.target.value });
                    setError('');
                  }}
                  placeholder="e.g. 5000"
                  min="1"
                  max={availableBalance !== null && availableBalance > 0 ? availableBalance : undefined}
                  style={{
                    borderColor: isLoanAmountInvalid ? '#EF4444' : undefined,
                    boxShadow: isLoanAmountInvalid ? '0 0 0 1px #EF4444' : undefined,
                  }}
                  required
                />
                {isLoanAmountInvalid && (
                  <div
                    style={{
                      marginTop: '5px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--danger-text, #B91C1C)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      lineHeight: 1.3,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{loanValidationErrorMessage}</span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.loanIssueDateLabel', 'Actual Loan Issue Date')} *</label>
                <input
                  type="date"
                  className="form-input"
                  value={loanForm.loan_date}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.loanInterestRateLabel', 'Monthly Interest Rate (%)')}</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={loanForm.interest_rate}
                  onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                  placeholder="2.0"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('adjustment.loanDurationLabel', 'Duration (Months)')}</label>
                <input
                  type="number"
                  className="form-input"
                  value={loanForm.duration_months}
                  onChange={(e) => setLoanForm({ ...loanForm, duration_months: e.target.value })}
                  placeholder="12"
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('adjustment.loanPurposeLabel', 'Purpose / Remarks')}</label>
              <input
                type="text"
                className="form-input"
                value={loanForm.purpose}
                onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                placeholder="e.g. Historical loan issued in July"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !selectedMemberId || isLoanAmountInvalid}
              style={{
                marginTop: '6px',
                alignSelf: 'flex-start',
                padding: '10px 20px',
                opacity: isLoanAmountInvalid ? 0.6 : 1,
                cursor: isLoanAmountInvalid ? 'not-allowed' : 'pointer',
              }}
            >
              <HandCoins size={16} />{' '}
              {submitting
                ? t('common.loading', 'Saving...')
                : existingMonthLoan
                ? t('adjustment.updateLoanBtn', 'Update Historical Loan')
                : t('adjustment.saveLoanBtn', 'Save Historical Loan')}
            </button>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAB 4: HISTORICAL LOAN REPAYMENT                             */}
        {/* ============================================================ */}
        {activeTab === 'repayment' && (
          <form onSubmit={handleSaveRepayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(!memberHistorical?.loans || memberHistorical.loans.length === 0) ? (
              <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t('adjustment.noLoansForMember', 'No loans found for this member. Please record a historical loan first if needed.')}
              </div>
            ) : (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('adjustment.selectLoanLabel', "Select Member's Loan")} *</label>
                  <select
                    className="form-select"
                    value={repayForm.loan_id}
                    onChange={(e) => {
                      const lId = e.target.value;
                      const selectedLoan = memberHistorical.loans.find((l) => String(l.id || l.loanId) === String(lId));
                      if (selectedLoan) {
                        const pending = Number(selectedLoan.pendingPrincipal !== undefined ? selectedLoan.pendingPrincipal : (selectedLoan.remainingAmount || 0));
                        const rate = Number(selectedLoan.interestRate || 2.0);
                        const iAmt = Math.round(((pending * rate) / 100) * 100) / 100;
                        setRepayForm({
                          ...repayForm,
                          loan_id: lId,
                          principal_amount: Math.min(1000, pending).toString(),
                          interest_amount: iAmt.toString(),
                        });
                      } else {
                        setRepayForm({ ...repayForm, loan_id: lId });
                      }
                    }}
                    required
                  >
                    <option value="">{t('common.select', 'Select a loan...')}</option>
                    {memberHistorical.loans.map((l) => (
                      <option key={l.id || l.loanId} value={l.id || l.loanId}>
                        {l.loanNumber || `LN-${String(l.id).slice(-6)}`} — Principal: {formatCurrency(l.originalPrincipal || l.principalAmount)} | Outstanding: {formatCurrency(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0))} ({l.status || 'ACTIVE'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.principalPaidLabel', 'Principal Repaid (₹)')} *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={repayForm.principal_amount}
                      onChange={(e) => setRepayForm({ ...repayForm, principal_amount: e.target.value })}
                      placeholder="e.g. 1000"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.interestPaidLabel', 'Interest Paid (₹)')} *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={repayForm.interest_amount}
                      onChange={(e) => setRepayForm({ ...repayForm, interest_amount: e.target.value })}
                      placeholder="e.g. 100"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.repayMonthLabel', 'Repayment Month')} *</label>
                    <select
                      className="form-select"
                      value={repayForm.month}
                      onChange={(e) => {
                        const m = e.target.value;
                        setRepayForm({
                          ...repayForm,
                          month: m,
                          payment_date: `${repayForm.year}-${String(m).padStart(2, '0')}-20`,
                        });
                      }}
                      required
                    >
                      {months.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.repayYearLabel', 'Repayment Year')} *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={repayForm.year}
                      onChange={(e) => {
                        const y = e.target.value;
                        setRepayForm({
                          ...repayForm,
                          year: y,
                          payment_date: `${y}-${String(repayForm.month).padStart(2, '0')}-20`,
                        });
                      }}
                      placeholder="2026"
                      min="2000"
                      max="2100"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.repayDateLabel', 'Actual Repayment Date')} *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={repayForm.payment_date}
                      onChange={(e) => setRepayForm({ ...repayForm, payment_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.paymentModeLabel', 'Payment Mode')}</label>
                    <select
                      className="form-select"
                      value={repayForm.payment_mode}
                      onChange={(e) => setRepayForm({ ...repayForm, payment_mode: e.target.value })}
                    >
                      {paymentModes.filter((m) => m.value !== 'Opening Balance').map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('adjustment.remarksLabel', 'Notes / Remarks')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={repayForm.remarks}
                      onChange={(e) => setRepayForm({ ...repayForm, remarks: e.target.value })}
                      placeholder="e.g. July repayment"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !selectedMemberId || !repayForm.loan_id}
                  style={{ marginTop: '6px', alignSelf: 'flex-start', padding: '10px 20px' }}
                >
                  <CreditCard size={16} /> {submitting ? t('common.loading', 'Saving...') : t('adjustment.saveRepaymentBtn', 'Save Historical Repayment')}
                </button>
              </>
            )}
          </form>
        )}

        {/* ============================================================ */}
        {/* SECTION 3: RECENT RECORDED HISTORICAL ENTRIES PREVIEW        */}
        {/* ============================================================ */}
        {selectedMember && memberHistorical && (
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {t('adjustment.recordedHistory', { name: selectedMember.name })}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {memberHistorical.initialEntry && (
                <span className="badge badge-info" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                  {t('adjustment.baseSavings', 'Base Opening')}: {formatCurrency(memberHistorical.initialEntry.paidAmount)} ({formatDate(memberHistorical.initialEntry.paymentDate)})
                </span>
              )}
              {memberHistorical.savings.slice(0, 6).map((s) => (
                <span key={s.id} className="badge badge-success" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                  {formatMonthYear(s.month, s.year, language)}: {formatCurrency(s.paidAmount)}
                </span>
              ))}
              {memberHistorical.loans.map((l) => {
                const { month: lM, year: lY } = getLoanMonthYear(l.issueDate || l.loanDate || l.loan_date || l.createdAt);
                const periodStr = lM && lY ? ` (${formatMonthYear(lM, lY, language)})` : '';
                return (
                  <span key={l.id} className="badge badge-warning" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    {t('common.loan', 'Loan')}: {formatCurrency(l.originalPrincipal)}{periodStr} ({t('adjustment.activeLoans', 'Outstanding')}: {formatCurrency(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0))})
                  </span>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </Modal>

      {/* Floating Centered Success Toast */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 24px',
              background: '#FFFFFF',
              border: '1.5px solid #10B981',
              borderRadius: 'var(--radius-lg, 16px)',
              boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.15)',
              minWidth: '280px',
              maxWidth: 'min(90vw, 460px)',
              pointerEvents: 'auto',
              animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--success-light, #ECFDF5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={22} color="#10B981" />
            </div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--success-text, #047857)',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {toastMessage}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AdjustmentModal;
