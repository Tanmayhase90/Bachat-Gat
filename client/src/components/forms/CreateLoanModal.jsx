import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { loanService } from '../../services/loanService';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { HandCoins, AlertCircle, CheckCircle2, Calculator, Search, ChevronDown, X, Check } from 'lucide-react';

const CreateLoanModal = ({ isOpen, onClose, onSuccess, initialMemberId = null }) => {
  const { t, language } = useLanguage();
  const [members, setMembers] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [formData, setFormData] = useState({
    member_id: initialMemberId || '',
    principal_amount: '0',
    interest_rate: '2.0',
    duration_months: '12',
    loan_date: new Date().toISOString().split('T')[0],
    purpose: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsMemberDropdownOpen(false);
      setMemberSearch('');
      setError('');
      setSuccess('');
      setShowConfirmModal(false);
      setFormData({
        member_id: initialMemberId || '',
        principal_amount: '0',
        interest_rate: '2.0',
        duration_months: '12',
        loan_date: new Date().toISOString().split('T')[0],
        purpose: '',
      });
      const fetchData = async () => {
        try {
          setLoadingBalance(true);
          const [memRes, balanceRes, loansRes] = await Promise.all([
            memberService.getAllMembers({ status: 'active' }),
            loanService.getAvailableBalance(),
            loanService.getAllLoans(),
          ]);

          if (memRes.success) {
            const allLoansList = loansRes?.allLoans || loansRes?.loans || [];
            const activeLoansList = allLoansList.filter((l) => {
              const status = (l.status || '').toUpperCase();
              const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
              return status === 'ACTIVE' && pending > 0;
            });

            const activeBorrowerMemberIds = new Set();
            activeLoansList.forEach((l) => {
              if (l.memberId) activeBorrowerMemberIds.add(String(l.memberId));
              if (l.member_id) activeBorrowerMemberIds.add(String(l.member_id));
              if (l.memberCode) activeBorrowerMemberIds.add(String(l.memberCode));
              if (l.member_code) activeBorrowerMemberIds.add(String(l.member_code));
            });

            const eligibleMembers = (memRes.members || []).filter((m) => {
              const mId = String(m.member_id || m.id || '');
              const mCode = String(m.member_code || m.memberCode || '');

              const hasActiveLoanFromLoansList = (mId && activeBorrowerMemberIds.has(mId)) || (mCode && activeBorrowerMemberIds.has(mCode));
              const hasActiveLoanFromMemberData = Number(m.outstanding_loans || m.active_loan_amount || 0) > 0;

              return !hasActiveLoanFromLoansList && !hasActiveLoanFromMemberData;
            });

            setMembers(eligibleMembers);

            if (initialMemberId) {
              const isInitialEligible = eligibleMembers.some(
                (m) => String(m.member_id) === String(initialMemberId) || String(m.id) === String(initialMemberId)
              );
              if (isInitialEligible) {
                setFormData((prev) => ({ ...prev, member_id: initialMemberId }));
              } else {
                setFormData((prev) => ({
                  ...prev,
                  member_id: eligibleMembers.length > 0 ? (eligibleMembers[0].member_id || eligibleMembers[0].id) : '',
                }));
                setError(t('modals.memberHasActiveLoan', 'This member already has an active loan with an outstanding balance.'));
              }
            } else if (eligibleMembers.length > 0 && !formData.member_id) {
              setFormData((prev) => ({ ...prev, member_id: eligibleMembers[0].member_id || eligibleMembers[0].id }));
            }
          }

          if (balanceRes && typeof balanceRes.availableBalance === 'number') {
            setAvailableBalance(balanceRes.availableBalance);
          }
        } catch (err) {
          console.error('Error fetching loan modal initial data:', err);
        } finally {
          setLoadingBalance(false);
        }
      };
      fetchData();
    }
  }, [isOpen, initialMemberId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus search input when dropdown opens
  useEffect(() => {
    if (isMemberDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMemberDropdownOpen]);

  const handleSelectMember = (m) => {
    const mId = m.member_id || m.id;
    setFormData((prev) => ({
      ...prev,
      member_id: mId,
    }));
    setError('');
    setIsMemberDropdownOpen(false);
    setMemberSearch('');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase().trim();
    const nameMatch = (m.name || '').toLowerCase().includes(q);
    const codeMatch = (m.member_code || m.memberCode || '').toLowerCase().includes(q);
    const phoneMatch = (m.phone || '').includes(q);
    return nameMatch || codeMatch || phoneMatch;
  });

  const selectedMember = members.find((m) => String(m.member_id) === String(formData.member_id) || String(m.id) === String(formData.member_id));

  const principal = parseFloat(formData.principal_amount) || 0;
  const rate = parseFloat(formData.interest_rate) || 0;
  const monthlyInterest = (principal * rate) / 100;

  const handleOpenConfirm = (e) => {
    if (e) e.preventDefault();
    if (!formData.member_id) {
      setError(t('modals.selectMemberAndAmount', 'Please select a member and enter loan amount.'));
      return;
    }

    const isMemberEligible = members.some((m) => String(m.member_id) === String(formData.member_id) || String(m.id) === String(formData.member_id));
    if (!isMemberEligible) {
      setError(t('modals.memberHasActiveLoan', 'This member already has an active loan with an outstanding balance.'));
      return;
    }

    const enteredPrincipal = parseFloat(formData.principal_amount);
    if (!Number.isFinite(enteredPrincipal) || isNaN(enteredPrincipal) || enteredPrincipal <= 0 || enteredPrincipal > Number.MAX_SAFE_INTEGER) {
      setError(t('modals.invalidLoanAmount', 'Please enter a valid positive loan amount.'));
      return;
    }

    if (availableBalance !== null) {
      if (availableBalance <= 0) {
        setError(t('modals.noAvailableBalanceForLoan', 'Insufficient available balance. No amount is currently available for a new loan.'));
        return;
      }
      if (enteredPrincipal > availableBalance) {
        const maxStr = formatCurrency(availableBalance);
        setError(t('modals.maxLoanExceeded', { maxAmount: maxStr }) || `Insufficient available balance. You can issue a maximum loan of ${maxStr}.`);
        return;
      }
    }

    setError('');
    setShowConfirmModal(true);
  };

  const handleConfirmDisburse = async () => {
    const enteredPrincipal = parseFloat(formData.principal_amount);
    try {
      setLoading(true);
      setError('');
      const res = await loanService.createLoan({
        ...formData,
        principal_amount: enteredPrincipal,
        interest_rate: parseFloat(formData.interest_rate),
        duration_months: parseInt(formData.duration_months, 10),
      });

      if (res.success) {
        setShowConfirmModal(false);
        setSuccess(t('modals.loanCreatedSuccess', `Loan ${res.loanNumber} created successfully!`));
        setTimeout(() => {
          setSuccess('');
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setShowConfirmModal(false);
      const errMsg = err.response?.data?.message || err.message || t('modals.failedCreateLoan', 'Failed to create loan.');
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('loans.issueLoanBtn', 'Issue New Group Loan')}
        maxWidth="540px"
        dialogStyle={{ maxHeight: 'min(calc(100dvh - 80px), calc(100vh - 80px), 75vh)' }}
        onSubmit={handleOpenConfirm}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <HandCoins size={16} />
            {loading ? t('modals.disbursing', 'Disbursing...') : t('modals.disburseLoanBtn', 'Disburse Loan')}
          </button>
        </>
      }
    >
      <div>
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-light)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>{t('modals.borrowingMember', 'Borrowing Member *')}</label>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--primary)',
                background: 'var(--accent-soft)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {language === 'mr' ? 'उपलब्ध सभासद' : 'Available Members'}: {members.length}
            </span>
          </div>
          
          {/* Custom Dropdown Trigger */}
          <div
            onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsMemberDropdownOpen((prev) => !prev);
              } else if (e.key === 'Escape') {
                setIsMemberDropdownOpen(false);
              }
            }}
            className="form-select"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              background: '#FFFFFF',
              borderColor: isMemberDropdownOpen ? 'var(--border-focus)' : 'var(--border-color)',
              boxShadow: isMemberDropdownOpen ? '0 0 0 3px rgba(190, 24, 93, 0.15)' : 'none',
              paddingRight: '12px',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedMember ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {selectedMember ? (
                `${selectedMember.name} (${selectedMember.member_code}) - ${t('members.totalSavings', 'Savings')}: ${formatCurrency(selectedMember.total_savings || selectedMember.totalSavings)}`
              ) : (
                t('modals.chooseMember', '-- Choose Member --')
              )}
            </span>
            <ChevronDown
              size={16}
              style={{
                color: 'var(--text-muted)',
                flexShrink: 0,
                transform: isMemberDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </div>

          <input type="hidden" name="member_id" value={formData.member_id} />

          {/* Searchable Dropdown Popup */}
          {isMemberDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 100,
                background: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-color)',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {/* Dropdown Header: Available Members Count */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '2px 4px 6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <span>
                  {language === 'mr' ? 'उपलब्ध सभासद' : 'Available Members'}:{' '}
                  <strong style={{ color: 'var(--primary)' }}>
                    {members.length}
                  </strong>
                </span>
              </div>

              {/* Search Bar inside Dropdown */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder={language === 'mr' ? 'नावाने किंवा सभासद क्र. ने शोधा...' : 'Search by name or code...'}
                  className="form-input"
                  style={{
                    paddingLeft: '32px',
                    paddingRight: memberSearch ? '30px' : '10px',
                    paddingTop: '7px',
                    paddingBottom: '7px',
                    fontSize: '0.85rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                {memberSearch && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemberSearch('');
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filtered Members List */}
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {filteredMembers.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {language === 'mr' ? 'कोणताही सभासद आढळला नाही' : 'No members found'}
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const isSelected = String(m.member_id) === String(formData.member_id) || String(m.id) === String(formData.member_id);
                    return (
                      <div
                        key={m.member_id || m.id}
                        onClick={() => handleSelectMember(m)}
                        style={{
                          padding: '9px 12px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isSelected ? 'var(--accent-soft)' : 'transparent',
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span>{m.name}</span>{' '}
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            ({m.member_code})
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', marginLeft: '8px', flexShrink: 0 }}>
                          {formatCurrency(m.total_savings || m.totalSavings)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>{t('modals.principalAmount', 'Principal Amount (₹) *')}</label>
              {availableBalance !== null && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: availableBalance > 0 ? 'var(--text-secondary)' : 'var(--danger-text)' }}>
                  {t('modals.availableBalanceForLoan', 'Available:')} <strong style={{ color: availableBalance > 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{formatCurrency(availableBalance)}</strong>
                </span>
              )}
            </div>
            <input
              type="number"
              name="principal_amount"
              className="form-input"
              value={formData.principal_amount}
              onChange={handleChange}
              min="1"
              max={availableBalance !== null && availableBalance > 0 ? availableBalance : undefined}
              step="1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('modals.monthlyInterestRate', 'Monthly Interest Rate (%) *')}</label>
            <input
              type="number"
              name="interest_rate"
              className="form-input"
              value={formData.interest_rate}
              onChange={handleChange}
              min="0.01"
              max="100"
              step="0.01"
              required
            />
          </div>
        </div>

        {/* Live Interest Calculation Box */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--accent-soft)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            border: '1px solid rgba(194, 24, 91, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
            <Calculator size={16} /> {t('modals.monthlyInterestCalc', 'Monthly Interest Calculation:')}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
            {formatCurrency(monthlyInterest)} / {language === 'mr' ? 'महिना' : 'month'}
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">{t('modals.durationMonths', 'Duration (Months)')}</label>
            <input
              type="number"
              name="duration_months"
              className="form-input"
              value={formData.duration_months}
              onChange={handleChange}
              min="1"
              max="60"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('modals.disbursementDate', 'Disbursement Date')}</label>
            <input
              type="date"
              name="loan_date"
              className="form-input"
              value={formData.loan_date}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('modals.loanPurpose', 'Loan Purpose / Remarks')}</label>
          <input
            type="text"
            name="purpose"
            className="form-input"
            placeholder={language === 'mr' ? 'उदा. शेती साहित्य, व्यवसाय वाढ' : 'e.g. Agricultural equipment, business expansion'}
            value={formData.purpose}
            onChange={handleChange}
          />
        </div>
      </div>
    </Modal>

    {/* Double Confirmation Modal for Loan Disbursement */}
    <Modal
      isOpen={showConfirmModal}
      onClose={() => {
        if (!loading) setShowConfirmModal(false);
      }}
      title={language === 'mr' ? 'तुम्हाला खात्री आहे का?' : 'Are you sure?'}
      maxWidth="440px"
      overlayStyle={{ zIndex: 1100 }}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowConfirmModal(false)}
            disabled={loading}
          >
            {language === 'mr' ? 'रद्द करा' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirmDisburse}
            disabled={loading}
            data-autofocus
          >
            <Check size={16} />
            {loading
              ? (language === 'mr' ? 'वितरित करत आहे...' : 'Disbursing...')
              : (language === 'mr' ? 'होय, पुष्टी करा' : 'Yes, Confirm')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {language === 'mr'
            ? `तुम्ही ${formatCurrency(principal)} चे कर्ज वितरित करणार आहात.`
            : `You are about to disburse a loan of ${formatCurrency(principal)}.`}
        </p>

        {selectedMember && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle, #F8FAFC)',
              border: '1px solid var(--border-color, #E2E8F0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {language === 'mr' ? 'कर्जदार सभासद' : 'Borrower'}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedMember.name} ({selectedMember.member_code || selectedMember.memberCode || selectedMember.id})
              </span>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {language === 'mr' ? 'कर्ज रक्कम' : 'Loan Amount'}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                {formatCurrency(principal)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  </>
);
};

export default CreateLoanModal;
