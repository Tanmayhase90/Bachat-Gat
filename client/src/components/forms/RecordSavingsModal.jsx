import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { savingsService } from '../../services/savingsService';
import { groupService } from '../../services/groupService';
import { formatCurrency, formatMonthYear, formatMonthlyHaftaDueDate, compareMemberNumericOrder } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertCircle, PiggyBank, Search, ChevronDown, X, Lock, Clock, Check } from 'lucide-react';

const RecordSavingsModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialMemberId = null,
  initialMonth = null,
  initialYear = null,
}) => {
  const { t, language } = useLanguage();
  const { monthlyHaftaDay } = useAuth();
  const currentDate = new Date();
  const [allMembers, setAllMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [configuredAmount, setConfiguredAmount] = useState('1000');
  const [formData, setFormData] = useState({
    member_id: initialMemberId ? String(initialMemberId) : '',
    amount: '1000',
    month: (initialMonth !== null && initialMonth !== undefined && initialMonth !== '' ? String(initialMonth) : (currentDate.getMonth() + 1).toString()),
    year: (initialYear !== null && initialYear !== undefined && initialYear !== '' ? String(initialYear) : currentDate.getFullYear().toString()),
    payment_date: currentDate.toISOString().split('T')[0],
    payment_mode: 'CASH',
    remarks: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const isDirectCollection = Boolean(initialMemberId);

  // Initialize/reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initM = (initialMonth !== null && initialMonth !== undefined && initialMonth !== '') ? String(initialMonth) : String(currentDate.getMonth() + 1);
      const initY = (initialYear !== null && initialYear !== undefined && initialYear !== '') ? String(initialYear) : String(currentDate.getFullYear());
      setFormData((prev) => ({
        ...prev,
        member_id: initialMemberId ? String(initialMemberId) : '',
        month: initM,
        year: initY,
        payment_date: currentDate.toISOString().split('T')[0],
        payment_mode: 'CASH',
        remarks: '',
      }));
      setIsMemberDropdownOpen(false);
      setMemberSearch('');
      setError('');
      setSuccess('');
      setShowConfirmModal(false);
    } else {
      setShowConfirmModal(false);
    }
  }, [isOpen, initialMemberId, initialMonth, initialYear]);

  // Fetch members and group configuration whenever modal opens or month/year changes
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fetchMembersAndConfig = async () => {
      try {
        setLoadingMembers(true);
        const reqMonth = parseInt(formData.month, 10);
        const reqYear = parseInt(formData.year, 10);
        const [memberRes, groupRes] = await Promise.all([
          memberService.getAllMembers({
            status: 'active',
            month: reqMonth,
            year: reqYear,
          }),
          groupService.getGroupDetails(),
        ]);
        if (active) {
          let shareAmount = 1000;
          if (groupRes?.success && groupRes.group) {
            shareAmount = Number(
              groupRes.group.monthly_contribution_per_share ||
              groupRes.group.monthlyContributionPerShare ||
              groupRes.group.monthlyContribution ||
              groupRes.group.monthly_contribution ||
              1000
            );
            setConfiguredAmount(shareAmount.toString());
          }
          if (memberRes?.success) {
            setAllMembers(memberRes.members || []);
          }
          setFormData((prev) => ({
            ...prev,
            amount: shareAmount.toString(),
          }));
        }
      } catch (err) {
        console.error('Failed to load members/config for savings modal:', err);
      } finally {
        if (active) setLoadingMembers(false);
      }
    };
    fetchMembersAndConfig();
    return () => {
      active = false;
    };
  }, [isOpen, formData.month, formData.year]);

  // Natural ascending numerical sort comparator for member codes (e.g. M-1, M-2, ... M-9, M-10, ... M-99, M-100, ... M-364)
  const compareMemberCodes = (a, b) => {
    const codeA = String(a.memberCode || a.member_code || a.memberId || a.member_id || a.id || '');
    const codeB = String(b.memberCode || b.member_code || b.memberId || b.member_id || b.id || '');
    const numA = parseInt(codeA.replace(/\D/g, ''), 10);
    const numB = parseInt(codeB.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Robust check for member pending status for the selected month/year
  const isMemberPending = (m) => {
    if (!m) return false;
    if (m.isPaid === true || m.has_paid_current_month === true || m.hasPaidCurrentMonth === true) return false;
    if ((m.status || '').toLowerCase() === 'paid') return false;
    if (m.current_due !== undefined && m.current_due <= 0 && (m.paid_amount > 0 || m.paidAmount > 0)) return false;
    if (m.isPending === true || m.is_pending_dues === true || m.isPendingDues === true) return true;
    if ((m.status || '').toLowerCase() === 'pending' || (m.status || '').toLowerCase() === 'partially paid') return true;
    if (m.current_due !== undefined && m.current_due > 0) return true;
    return false;
  };

  // Derive pending members strictly for the selected Month & Year in numeric ascending order
  const pendingMembers = allMembers
    .filter(isMemberPending)
    .sort(compareMemberNumericOrder);

  // Selected member resolved against all active members
  const selectedMember = allMembers.find(
    (m) => String(m.member_id) === String(formData.member_id) || String(m.id) === String(formData.member_id)
  );

  // Determine if selected member is already paid for the selected month and year
  const isSelectedMemberAlreadyPaid = selectedMember ? !isMemberPending(selectedMember) : false;

  // Sync selected member in generic mode or lock in direct mode
  useEffect(() => {
    if (isDirectCollection) {
      if (initialMemberId && String(formData.member_id) !== String(initialMemberId)) {
        setFormData((prev) => ({
          ...prev,
          member_id: String(initialMemberId),
          amount: configuredAmount,
        }));
      }
      return;
    }

    // In generic mode: if currently selected member is not in pendingMembers for the selected month/year, reset selection
    if (formData.member_id) {
      const isStillPending = pendingMembers.some(
        (m) => String(m.member_id || m.id) === String(formData.member_id)
      );
      if (!isStillPending) {
        setFormData((prev) => ({
          ...prev,
          member_id: '',
        }));
      }
    }
  }, [pendingMembers, isDirectCollection, initialMemberId, formData.member_id, configuredAmount]);

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
      amount: configuredAmount,
    }));
    setError('');
    setIsMemberDropdownOpen(false);
    setMemberSearch('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'amount') return; // Contribution amount is read-only
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const filteredPendingMembers = pendingMembers.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase().trim();
    const nameMatch = (m.name || '').toLowerCase().includes(q);
    const codeMatch = (m.member_code || m.memberCode || '').toLowerCase().includes(q);
    const phoneMatch = (m.phone || '').includes(q);
    return nameMatch || codeMatch || phoneMatch;
  });

  const monthNames = [
    { value: 1, label: language === 'mr' ? 'जानेवारी' : 'January', en: 'January' },
    { value: 2, label: language === 'mr' ? 'फेब्रुवारी' : 'February', en: 'February' },
    { value: 3, label: language === 'mr' ? 'मार्च' : 'March', en: 'March' },
    { value: 4, label: language === 'mr' ? 'एप्रिल' : 'April', en: 'April' },
    { value: 5, label: language === 'mr' ? 'मे' : 'May', en: 'May' },
    { value: 6, label: language === 'mr' ? 'जून' : 'June', en: 'June' },
    { value: 7, label: language === 'mr' ? 'जुलै' : 'July', en: 'July' },
    { value: 8, label: language === 'mr' ? 'ऑगस्ट' : 'August', en: 'August' },
    { value: 9, label: language === 'mr' ? 'सप्टेंबर' : 'September', en: 'September' },
    { value: 10, label: language === 'mr' ? 'ऑक्टोबर' : 'October', en: 'October' },
    { value: 11, label: language === 'mr' ? 'नोव्हेंबर' : 'November', en: 'November' },
    { value: 12, label: language === 'mr' ? 'डिसेंबर' : 'December', en: 'December' },
  ];

  const currentMonthObj = monthNames.find((m) => Number(m.value) === Number(formData.month));
  const currentMonthLabel = language === 'mr' ? currentMonthObj?.label : currentMonthObj?.en;

  const handleOpenConfirm = (e) => {
    if (e) e.preventDefault();

    if (!formData.member_id) {
      setError(t('modals.selectMemberFirst', 'Please select a member first.'));
      return;
    }

    if (isSelectedMemberAlreadyPaid) {
      setError(
        language === 'mr'
          ? `${selectedMember?.name || 'सभासद'} यांच्यासाठी ${currentMonthLabel} ${formData.year} ची बचत आधीच नोंदवली आहे.`
          : `Saving already recorded for ${currentMonthLabel} ${formData.year} for ${selectedMember?.name || 'this member'}.`
      );
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0 || !formData.month || !formData.year) {
      setError(t('modals.enterValidAmount', 'Please enter a valid contribution amount greater than 0.'));
      return;
    }

    setError('');
    setShowConfirmModal(true);
  };

  const handleConfirmRecord = async () => {
    const numAmount = parseFloat(formData.amount);
    try {
      setLoading(true);
      setError('');
      const res = await savingsService.recordSavings({
        ...formData,
        amount: numAmount,
        month: parseInt(formData.month, 10),
        year: parseInt(formData.year, 10),
      });

      if (res.success) {
        setShowConfirmModal(false);
        setSuccess(t('modals.savingsRecordedSuccess', 'Monthly savings recorded successfully!'));
        setTimeout(() => {
          setSuccess('');
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setShowConfirmModal(false);
      setError(err.response?.data?.message || err.message || t('modals.failedRecordSavings', 'Failed to record savings.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleOpenConfirm}
        title={t('modals.recordSavingsTitle', 'Record Monthly Savings')}
        maxWidth="620px"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || isSelectedMemberAlreadyPaid || !formData.member_id || (pendingMembers.length === 0 && !selectedMember)}
            style={{
              opacity: (isSelectedMemberAlreadyPaid || !formData.member_id || (pendingMembers.length === 0 && !selectedMember)) ? 0.6 : 1,
              cursor: (isSelectedMemberAlreadyPaid || !formData.member_id || (pendingMembers.length === 0 && !selectedMember)) ? 'not-allowed' : 'pointer',
            }}
          >
            <PiggyBank size={16} />
            {loading ? t('modals.recording', 'Recording...') : t('modals.recordSavingsBtn', 'Record Savings')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-light)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* Already Paid Warning Alert */}
        {isSelectedMemberAlreadyPaid && selectedMember && (
          <div
            style={{
              padding: '12px 14px',
              background: '#FFFBEB',
              color: '#B45309',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              {language === 'mr'
                ? `${selectedMember.name} यांच्यासाठी ${currentMonthLabel} ${formData.year} ची बचत आधीच नोंदवली आहे.`
                : `Saving already recorded for ${currentMonthLabel} ${formData.year} for ${selectedMember.name}.`}
            </span>
          </div>
        )}

        {isDirectCollection ? (
          /* Direct Collection: Member is locked/preselected */
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>{t('modals.selectMember', 'Selected Member *')}</label>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: isSelectedMemberAlreadyPaid ? 'var(--danger-text, #DC2626)' : 'var(--primary)',
                  background: isSelectedMemberAlreadyPaid ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-soft)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Lock size={12} />
                {isSelectedMemberAlreadyPaid ? (language === 'mr' ? 'आधीच भरले' : 'Already Paid') : (language === 'mr' ? 'थेट संकलन' : 'Direct Member')}
              </span>
            </div>
            
            <div
              className="form-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-subtle, #F8FAFC)',
                border: isSelectedMemberAlreadyPaid ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color, #E2E8F0)',
                cursor: 'not-allowed',
                fontWeight: 600,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                {selectedMember ? `${selectedMember.name} (${selectedMember.member_code || selectedMember.memberCode || selectedMember.id})` : (initialMemberId || 'Member')}
              </span>
              <span style={{ fontSize: '0.8rem', color: isSelectedMemberAlreadyPaid ? 'var(--danger-text, #DC2626)' : 'var(--success-text, #16A34A)', fontWeight: 700 }}>
                {isSelectedMemberAlreadyPaid ? (language === 'mr' ? 'पूर्ण' : 'Paid') : (language === 'mr' ? 'बाकी' : 'Pending')}
              </span>
            </div>

            <input type="hidden" name="member_id" value={formData.member_id} />
          </div>
        ) : (
          /* Generic Collection: Searchable Dropdown of Pending Members */
          <div className="form-group" style={{ position: 'relative', marginBottom: 0 }} ref={dropdownRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>{t('modals.selectMember', 'Select Member *')}</label>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: pendingMembers.length > 0 ? 'var(--warning-text, #b45309)' : 'var(--success-text, #16a34a)',
                  background: pendingMembers.length > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {language === 'mr' ? 'बाकी सभासद' : 'Pending Members'}: {pendingMembers.length}
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
                  `${selectedMember.name} (${selectedMember.member_code || selectedMember.memberCode || selectedMember.id}) - ${t('members.monthlyShare', 'Monthly Share')}: ${formatCurrency(selectedMember.monthly_contribution || selectedMember.monthlyContribution)}`
                ) : (
                  pendingMembers.length === 0
                    ? (language === 'mr' ? 'या महिन्यासाठी सर्व सभासदांची बचत जमा आहे! 🎉' : 'All members have already paid for this month.')
                    : t('modals.chooseMember', '-- Choose Member --')
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

            {/* Empty state banner when all members have already paid for this month */}
            {pendingMembers.length === 0 && !loadingMembers && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--success-light, #ECFDF5)',
                  color: 'var(--success-text, #065F46)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  marginTop: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>
                  {language === 'mr'
                    ? 'या महिन्यासाठी सर्व सभासदांची बचत जमा आहे! 🎉'
                    : 'All members have already paid for this month.'}
                </span>
              </div>
            )}

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
                  gap: '8px',
                  maxHeight: '260px',
                }}
              >
                {/* Dropdown Header: Pending Count */}
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
                    {language === 'mr' ? 'बाकी सभासद संख्या' : 'Pending Members'}:{' '}
                    <strong style={{ color: 'var(--primary)' }}>
                      {pendingMembers.length}
                    </strong>
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {currentMonthLabel} {formData.year}
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
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Scrollable Members List */}
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {loadingMembers ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {t('common.loadingData', 'Loading members...')}
                    </div>
                  ) : filteredPendingMembers.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {memberSearch
                        ? (language === 'mr' ? 'कोणताही सभासद सापडला नाही' : 'No matching members found')
                        : (language === 'mr' ? 'या महिन्यासाठी सर्व सभासदांची बचत जमा आहे! 🎉' : 'All members have already paid for this month.')}
                    </div>
                  ) : (
                    filteredPendingMembers.map((m) => {
                      const isSelected = formData.member_id === String(m.member_id || m.id);
                      const memberShare = m.monthly_contribution || m.monthlyContribution || (Number(m.shares || 1) * Number(configuredAmount || 1000));
                      const mCode = m.member_code || m.memberCode || m.id;
                      return (
                        <div
                          key={m.member_id || m.id}
                          onClick={() => handleSelectMember(m)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isSelected ? 'var(--accent-soft)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'var(--bg-subtle, #F1F5F9)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                background: isSelected ? 'rgba(190, 24, 93, 0.15)' : 'var(--bg-subtle, #F1F5F9)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                minWidth: '42px',
                                textAlign: 'center',
                              }}
                            >
                              {mCode}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                              {m.name}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)' }}>
                              {formatCurrency(memberShare)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info strip showing due schedule */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(59, 130, 246, 0.08)',
            color: 'var(--info-text, #1D4ED8)',
            fontSize: '0.8rem',
            fontWeight: 600,
            width: '100%',
          }}
        >
          <Clock size={14} />
          <span>{formatMonthlyHaftaDueDate(monthlyHaftaDay, language)}</span>
        </div>

        <div className="form-grid-2" style={{ gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('modals.month', 'Month *')}</label>
            <select name="month" className="form-select" value={formData.month} onChange={handleChange} required>
              {monthNames.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('modals.year', 'Year *')}</label>
            <input
              type="number"
              name="year"
              className="form-input"
              value={formData.year}
              onChange={handleChange}
              min="2020"
              max="2040"
              required
            />
          </div>
        </div>

        <div className="form-grid-2" style={{ gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('modals.contributionAmount', 'Contribution Amount (₹) *')}</label>
            <input
              type="number"
              name="amount"
              className="form-input"
              value={formData.amount}
              readOnly
              tabIndex={-1}
              style={{
                backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                cursor: 'not-allowed',
                color: 'var(--text-secondary, #475569)',
                fontWeight: 600,
                border: '1px solid var(--border-color, #E2E8F0)',
              }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('modals.paymentMode', 'Payment Mode')}</label>
            <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange}>
              <option value="CASH">{t('common.cash', 'Cash')}</option>
              <option value="UPI">{language === 'mr' ? 'यूपीआय / क्यूआर कोड' : 'UPI / QR Code'}</option>
            </select>
          </div>
        </div>

        <div className="form-grid-2" style={{ gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('modals.paymentDate', 'Payment Date')}</label>
            <input
              type="date"
              name="payment_date"
              className="form-input"
              value={formData.payment_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('modals.remarks', 'Remarks / Note')}</label>
            <input
              type="text"
              name="remarks"
              className="form-input"
              placeholder={language === 'mr' ? 'उदा. PhonePe / Google Pay द्वारे' : 'e.g. Paid via Google Pay'}
              value={formData.remarks}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>
    </Modal>

    {/* Double Confirmation Modal */}
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
            onClick={handleConfirmRecord}
            disabled={loading}
            data-autofocus
          >
            <Check size={16} />
            {loading
              ? (language === 'mr' ? 'नोंदवत आहे...' : 'Recording...')
              : (language === 'mr' ? 'होय, नोंदवा' : 'Yes, Record')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {language === 'mr'
            ? `तुम्ही ${currentMonthObj?.label || ''} ${formData.year} ची मासिक बचत नोंदवणार आहात.`
            : `You are about to record monthly saving for ${currentMonthObj?.en || currentMonthLabel} ${formData.year}.`}
        </p>

        {selectedMember && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle, #F8FAFC)',
              border: '1px solid var(--border-color, #E2E8F0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedMember.name} ({selectedMember.member_code || selectedMember.memberCode || selectedMember.id})
            </span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
              {formatCurrency(formData.amount)}
            </span>
          </div>
        )}
      </div>
    </Modal>
  </>
);
};

export default RecordSavingsModal;
