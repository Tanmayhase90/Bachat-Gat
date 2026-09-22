import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { savingsService } from '../../services/savingsService';
import { loanService } from '../../services/loanService';
import { groupService } from '../../services/groupService';
import { formatCurrency, formatMonthlyHaftaDueDate, compareMemberNumericOrder, calculateLoanRepaymentEligibility } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Search,
  ChevronDown,
  X,
  Lock,
  Clock,
  Check,
  CreditCard,
  Calculator,
  Coins,
  Receipt,
  FileText,
} from 'lucide-react';

const cleanMemberId = (id) => String(id || '').trim().toLowerCase().replace(/[-_]/g, '');

const RecordSavingsAndLoanModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialMemberId = null,
  initialLoanId = null,
  initialMonth = null,
  initialYear = null,
  initialMode = 'savings', // 'savings' | 'loan'
}) => {
  const { t, language } = useLanguage();
  const { monthlyHaftaDay } = useAuth();
  const currentDate = new Date();

  const [allMembers, setAllMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [configuredAmount, setConfiguredAmount] = useState('1000');
  const [activeLoans, setActiveLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

  const [formData, setFormData] = useState({
    member_id: initialMemberId ? String(initialMemberId) : '',
    amount: '1000',
    month: (initialMonth !== null && initialMonth !== undefined && initialMonth !== '' ? String(initialMonth) : (currentDate.getMonth() + 1).toString()),
    year: (initialYear !== null && initialYear !== undefined && initialYear !== '' ? String(initialYear) : currentDate.getFullYear().toString()),
    payment_date: currentDate.toISOString().split('T')[0],
    payment_mode: 'CASH',
    remarks: '',
  });

  const [loanRepaymentAmount, setLoanRepaymentAmount] = useState('');
  const [skipLoanRepayment, setSkipLoanRepayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const loanInputRef = useRef(null);

  const isDirectCollection = Boolean(initialMemberId || initialLoanId);

  // Initialize/reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initM = (initialMonth !== null && initialMonth !== undefined && initialMonth !== '')
        ? String(initialMonth)
        : String(currentDate.getMonth() + 1);
      const initY = (initialYear !== null && initialYear !== undefined && initialYear !== '')
        ? String(initialYear)
        : String(currentDate.getFullYear());

      setFormData({
        member_id: initialMemberId ? String(initialMemberId) : '',
        amount: configuredAmount || '1000',
        month: initM,
        year: initY,
        payment_date: currentDate.toISOString().split('T')[0],
        payment_mode: 'CASH',
        remarks: '',
      });
      setLoanRepaymentAmount('');
      setSkipLoanRepayment(false);
      setIsMemberDropdownOpen(false);
      setMemberSearch('');
      setError('');
      setSuccess('');
      setShowConfirmModal(false);
    } else {
      setShowConfirmModal(false);
    }
  }, [isOpen, initialMemberId, initialLoanId, initialMonth, initialYear]);

  // Fetch members, group configuration, and active loans
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const fetchData = async () => {
      try {
        setLoadingMembers(true);
        setLoadingLoans(true);
        const reqMonth = parseInt(formData.month, 10);
        const reqYear = parseInt(formData.year, 10);

        const [memberRes, groupRes, loansRes] = await Promise.all([
          memberService.getAllMembers({
            status: 'active',
            month: reqMonth,
            year: reqYear,
          }),
          groupService.getGroupDetails(),
          loanService.getAllLoans({ status: 'ACTIVE' }),
        ]);

        if (active) {
          if (loansRes?.success) {
            const rawLoans = loansRes.loans || loansRes.allLoans || [];
            setActiveLoans(rawLoans);

            // If opened with initialLoanId, auto-select loan's member
            if (initialLoanId) {
              const matchedLoan = rawLoans.find(
                (l) => String(l.id || l.loan_id) === String(initialLoanId)
              );
              if (matchedLoan && (matchedLoan.memberId || matchedLoan.member_id)) {
                setFormData((prev) => ({
                  ...prev,
                  member_id: String(matchedLoan.memberId || matchedLoan.member_id),
                }));
              }
            }
          }

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
        console.error('Failed to load members/config/loans:', err);
      } finally {
        if (active) {
          setLoadingMembers(false);
          setLoadingLoans(false);
        }
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [isOpen, formData.month, formData.year, initialLoanId]);

  // Autofocus loan repayment input if opened in loan context
  useEffect(() => {
    if (isOpen && (initialMode === 'loan' || initialLoanId) && loanInputRef.current) {
      const timer = setTimeout(() => {
        if (loanInputRef.current) loanInputRef.current.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialMode, initialLoanId]);

  // Pending status helper for monthly savings
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

  // Dynamic count of pending members for the active month/year
  const pendingMembersCount = allMembers.filter((m) => isMemberPending(m)).length;

  // Selected member
  const selectedMember = allMembers.find(
    (m) => String(m.member_id) === String(formData.member_id) || String(m.id) === String(formData.member_id)
  );

  // Determine if selected member's savings for the selected month/year is already paid
  const isSelectedMemberSavingsPaid = selectedMember ? !isMemberPending(selectedMember) : false;

  // Active loans resolution for selected member
  const memberActiveLoans = activeLoans.filter((l) => {
    const lMemId = String(l.memberId || l.member_id || '').trim().toLowerCase();
    const lMemCode = String(l.memberCode || l.member_code || '').trim().toLowerCase();
    const lUserId = String(l.userId || l.authUid || '').trim().toLowerCase();

    const selId = String(selectedMember?.member_id || selectedMember?.id || formData.member_id || '').trim().toLowerCase();
    const selCode = String(selectedMember?.member_code || selectedMember?.memberCode || '').trim().toLowerCase();
    const selUserId = String(selectedMember?.userId || selectedMember?.authUid || '').trim().toLowerCase();

    const cleanLMemId = lMemId.replace(/[-_]/g, '');
    const cleanLMemCode = lMemCode.replace(/[-_]/g, '');
    const cleanSelId = selId.replace(/[-_]/g, '');
    const cleanSelCode = selCode.replace(/[-_]/g, '');

    const matchesId = selId && (
      lMemId === selId ||
      lMemCode === selId ||
      (cleanSelId && cleanLMemId === cleanSelId) ||
      (cleanSelId && cleanLMemCode === cleanSelId) ||
      (selUserId && (lUserId === selUserId || lMemId === selUserId))
    );
    const matchesCode = selCode && (
      lMemCode === selCode ||
      lMemId === selCode ||
      (cleanSelCode && cleanLMemCode === cleanSelCode) ||
      (cleanSelCode && cleanLMemId === cleanSelCode)
    );
    const matchesUserId = selUserId && (lUserId === selUserId || lMemId === selUserId);
    const matchesLoanId = initialLoanId && String(l.id || l.loanId || l.loan_id) === String(initialLoanId);

    const status = (l.status || 'ACTIVE').toUpperCase();
    const pending = Number(
      l.pendingPrincipal !== undefined && l.pendingPrincipal !== null
        ? l.pendingPrincipal
        : l.remainingAmount !== undefined && l.remainingAmount !== null
        ? l.remainingAmount
        : l.remainingPrincipal !== undefined && l.remainingPrincipal !== null
        ? l.remainingPrincipal
        : l.balanceAmount !== undefined && l.balanceAmount !== null
        ? l.balanceAmount
        : l.outstanding_amount || 0
    );
    return (matchesLoanId || matchesId || matchesCode || matchesUserId) && status === 'ACTIVE' && pending > 0;
  });

  const memberActiveLoan = memberActiveLoans[0] || null;

  // Selected period numbers
  const selectedMonthNum = parseInt(formData.month, 10);
  const selectedYearNum = parseInt(formData.year, 10);

  // Check whether repayment already exists for the selected month/year for this loan
  const isLoanRepaymentAlreadyPaid = Boolean(
    memberActiveLoan &&
    Array.isArray(memberActiveLoan.repayments) &&
    memberActiveLoan.repayments.some((r) => {
      const rMonth = parseInt(r.payment_month ?? r.paymentMonth ?? r.month, 10);
      const rYear = parseInt(r.payment_year ?? r.paymentYear ?? r.year, 10);
      if (rMonth === selectedMonthNum && rYear === selectedYearNum) {
        return true;
      }
      if ((isNaN(rMonth) || isNaN(rYear)) && (r.paymentDate || r.payment_date)) {
        const pd = new Date(r.paymentDate || r.payment_date);
        if (!isNaN(pd.getTime()) && (pd.getMonth() + 1) === selectedMonthNum && pd.getFullYear() === selectedYearNum) {
          return true;
        }
      }
      return false;
    })
  );

  // Loan Repayment Start Date / Due-Date Eligibility
  // When a loan is issued in the current month, repayment is blocked until the group's configured Monthly Hafta Due Date in NEXT applicable month.
  const loanRepaymentEligibility = memberActiveLoan
    ? calculateLoanRepaymentEligibility({
        loan: memberActiveLoan,
        monthlyHaftaDay: monthlyHaftaDay || 10,
        paymentDate: formData.payment_date,
        selectedMonth: selectedMonthNum,
        selectedYear: selectedYearNum,
        language,
      })
    : { isEligible: true, message: '', eligibleDateFormatted: '' };

  const isLoanRepaymentEligible = loanRepaymentEligibility.isEligible;

  // Loan metrics
  const currentOutstanding = memberActiveLoan
    ? Number(
        memberActiveLoan.pendingPrincipal !== undefined && memberActiveLoan.pendingPrincipal !== null
          ? memberActiveLoan.pendingPrincipal
          : memberActiveLoan.remainingAmount !== undefined && memberActiveLoan.remainingAmount !== null
          ? memberActiveLoan.remainingAmount
          : memberActiveLoan.remainingPrincipal !== undefined && memberActiveLoan.remainingPrincipal !== null
          ? memberActiveLoan.remainingPrincipal
          : memberActiveLoan.balanceAmount !== undefined && memberActiveLoan.balanceAmount !== null
          ? memberActiveLoan.balanceAmount
          : memberActiveLoan.outstanding_amount || 0
      )
    : 0;

  const originalPrincipal = memberActiveLoan
    ? Number(
        memberActiveLoan.originalPrincipal ||
        memberActiveLoan.principal_amount ||
        memberActiveLoan.amount ||
        currentOutstanding
      )
    : 0;

  const interestRate = memberActiveLoan
    ? Number(memberActiveLoan.interestRate || memberActiveLoan.interest_rate || 2.0)
    : 2.0;

  // Exact auto-calculated interest for the selected month/year
  const calculatedInterest = memberActiveLoan
    ? Math.round(((currentOutstanding * interestRate) / 100) * 100) / 100
    : 0;

  // Effective loan payment in this transaction (0 if already repaid for selected month/year, or skipped, or not yet eligible)
  const isLoanPaymentActive = Boolean(
    memberActiveLoan &&
    !skipLoanRepayment &&
    !isLoanRepaymentAlreadyPaid &&
    isLoanRepaymentEligible
  );

  const parsedRepayment = isLoanPaymentActive
    ? parseFloat(loanRepaymentAmount) || 0
    : 0;

  const outstandingAfterRepayment = memberActiveLoan
    ? Math.max(0, Math.round((currentOutstanding - parsedRepayment) * 100) / 100)
    : 0;

  // Effective savings collection
  const regularSavingsAmount = parseFloat(formData.amount) || 0;
  const effectiveSavingsAmount = isSelectedMemberSavingsPaid ? 0 : regularSavingsAmount;

  // Total Collection = Monthly Savings + Loan Principal + Loan Interest
  const totalCollection = Math.round(
    (effectiveSavingsAmount + (isLoanPaymentActive ? (parsedRepayment + calculatedInterest) : 0)) * 100
  ) / 100;

  // Validation
  const maxAllowedPrincipal = Math.max(0, currentOutstanding);
  const isRepayOverLimit = Boolean(isLoanPaymentActive && parsedRepayment > maxAllowedPrincipal);
  const isRepayNegative = Boolean(isLoanPaymentActive && parsedRepayment < 0);
  const isLoanRepayInvalid = isRepayOverLimit || isRepayNegative;

  const loanValidationError = isRepayNegative
    ? (language === 'mr' ? 'मुद्दल परतफेड रक्कम ० पेक्षा कमी असू शकत नाही.' : 'Principal repayment amount cannot be negative.')
    : isRepayOverLimit
    ? (language === 'mr'
        ? `परतफेड रक्कम बाकी मुद्दल ${formatCurrency(maxAllowedPrincipal)} पेक्षा जास्त असू शकत नाही.`
        : `Repayment amount cannot exceed the outstanding principal of ${formatCurrency(maxAllowedPrincipal)}.`)
    : '';

  // Quick Action Buttons
  const handleSetInterestOnly = () => {
    if (isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) return;
    setSkipLoanRepayment(false);
    setLoanRepaymentAmount('0');
    setError('');
  };

  const handleSetFullRepayment = () => {
    if (isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) return;
    setSkipLoanRepayment(false);
    setLoanRepaymentAmount(maxAllowedPrincipal.toString());
    setError('');
  };

  const handleSetSavingsOnly = () => {
    setSkipLoanRepayment(true);
    setLoanRepaymentAmount('0');
    setError('');
  };

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

  // Autofocus search in dropdown
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
    setLoanRepaymentAmount('');
    setSkipLoanRepayment(false);
    setError('');
    setIsMemberDropdownOpen(false);
    setMemberSearch('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'amount') return;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  // Filtered members for dropdown: display all active members, sorted with pending first
  const sortedMembers = [...allMembers].sort((a, b) => {
    const aPending = isMemberPending(a);
    const bPending = isMemberPending(b);
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    return compareMemberNumericOrder(a, b);
  });

  const filteredMembers = sortedMembers.filter((m) => {
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

  // Validation before opening confirmation modal
  // Validation before opening confirmation modal
  const handleOpenConfirm = (e) => {
    if (e) e.preventDefault();

    if (!formData.member_id) {
      setError(t('modals.selectMemberFirst', 'Please select a member first.'));
      return;
    }

    // If loan is not eligible for repayment yet, and user is trying to record loan repayment
    if (memberActiveLoan && !isLoanRepaymentEligible && (initialMode === 'loan' || parsedRepayment > 0)) {
      setError(loanRepaymentEligibility.message);
      return;
    }

    // If member has no active loan or loan is already repaid/skipped/not eligible, and savings is already paid
    if (!isLoanPaymentActive && isSelectedMemberSavingsPaid) {
      setError(
        language === 'mr'
          ? (!isLoanRepaymentEligible && memberActiveLoan
              ? loanRepaymentEligibility.message
              : (isLoanRepaymentAlreadyPaid
                  ? `${selectedMember?.name || 'सभासद'} यांच्यासाठी ${currentMonthLabel} ${formData.year} ची बचत आणि कर्ज परतफेड दोन्ही आधीच नोंदवले गेले आहेत.`
                  : `${selectedMember?.name || 'सभासद'} यांच्यासाठी ${currentMonthLabel} ${formData.year} ची बचत आधीच जमा आहे.`))
          : (!isLoanRepaymentEligible && memberActiveLoan
              ? loanRepaymentEligibility.message
              : (isLoanRepaymentAlreadyPaid
                  ? `Both monthly savings and loan repayment are already recorded for ${currentMonthLabel} ${formData.year} for ${selectedMember?.name || 'this member'}.`
                  : `Saving already recorded for ${currentMonthLabel} ${formData.year} for ${selectedMember?.name || 'this member'}.`))
      );
      return;
    }

    // If total collection is 0
    if (totalCollection <= 0) {
      setError(
        language === 'mr'
          ? (!isLoanRepaymentEligible && memberActiveLoan
              ? loanRepaymentEligibility.message
              : 'कृपया बचत किंवा कर्ज परतफेड रक्कम प्रविष्ट करा.')
          : (!isLoanRepaymentEligible && memberActiveLoan
              ? loanRepaymentEligibility.message
              : 'Please enter a savings or loan repayment amount greater than 0.')
      );
      return;
    }

    if (isLoanRepayInvalid) {
      setError(loanValidationError || (language === 'mr' ? 'अवैध परतफेड रक्कम.' : 'Invalid repayment amount.'));
      return;
    }

    setError('');
    setShowConfirmModal(true);
  };

  // Execution: Submit both or single operation
  const handleConfirmRecord = async () => {
    try {
      setLoading(true);
      setError('');

      let savingsRecorded = false;
      let loanRecorded = false;

      // 1. Record Monthly Savings if applicable
      if (effectiveSavingsAmount > 0) {
        await savingsService.recordSavings({
          ...formData,
          amount: effectiveSavingsAmount,
          month: parseInt(formData.month, 10),
          year: parseInt(formData.year, 10),
        });
        savingsRecorded = true;
      }

      // 2. Record Loan Repayment if member has an active loan, not skipped, and not already repaid for this month
      if (isLoanPaymentActive) {
        try {
          await loanService.recordRepayment({
            loan_id: memberActiveLoan.id,
            loanId: memberActiveLoan.id,
            payment_month: parseInt(formData.month, 10),
            payment_year: parseInt(formData.year, 10),
            regular_hafta_amount: 0,
            principal_repayment_amount: parsedRepayment,
            payment_date: formData.payment_date,
            payment_mode: formData.payment_mode,
            remarks: formData.remarks,
            monthlyHaftaDay: monthlyHaftaDay || 10,
            language,
          });
          loanRecorded = true;
        } catch (loanErr) {
          console.error('Failed to record loan repayment in combined workflow:', loanErr);
          setShowConfirmModal(false);
          setError(
            language === 'mr'
              ? (savingsRecorded
                  ? `मासिक बचत नोंदवली गेली, परंतु कर्ज परतफेड नोंदवण्यात त्रुटी आली: ${loanErr.message || 'त्रुटी'}`
                  : `कर्ज परतफेड नोंदवण्यात त्रुटी आली: ${loanErr.message || 'त्रुटी'}`)
              : (savingsRecorded
                  ? `Monthly saving was recorded, but loan repayment failed: ${loanErr.message || 'Error'}`
                  : `Loan repayment failed: ${loanErr.message || 'Error'}`)
          );
          if (onSuccess) onSuccess();
          return;
        }
      }

      setShowConfirmModal(false);
      const successMsg = (savingsRecorded && loanRecorded)
        ? (language === 'mr' ? 'मासिक बचत आणि कर्ज परतफेड यशस्वीरित्या नोंदवली गेली!' : 'Monthly savings and loan repayment recorded successfully!')
        : loanRecorded
        ? (language === 'mr' ? 'कर्ज परतफेड यशस्वीरित्या नोंदवली गेली!' : 'Loan repayment recorded successfully!')
        : t('modals.savingsRecordedSuccess', 'Monthly savings recorded successfully!');

      setSuccess(successMsg);
      setTimeout(() => {
        setSuccess('');
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setShowConfirmModal(false);
      setError(err.response?.data?.message || err.message || t('modals.failedRecordSavings', 'Failed to record transaction.'));
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading ||
    !formData.member_id ||
    isLoanRepayInvalid ||
    totalCollection <= 0 ||
    (!isLoanPaymentActive && isSelectedMemberSavingsPaid) ||
    (initialMode === 'loan' && (!isLoanPaymentActive || !isLoanRepaymentEligible));

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleOpenConfirm}
        title={language === 'mr' ? 'बचत आणि कर्ज नोंदवा' : 'Record Savings & Loan'}
        maxWidth="640px"
        footer={
          <>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitDisabled}
              style={{
                opacity: isSubmitDisabled ? 0.6 : 1,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <PiggyBank size={16} />
              {loading
                ? (language === 'mr' ? 'नोंदवत आहे...' : 'Recording...')
                : (language === 'mr' ? 'बचत आणि कर्ज नोंदवा' : 'Record Savings & Loan')}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

          {/* 1. MEMBER SELECTION */}
          {isDirectCollection && selectedMember ? (
            /* Direct / Pre-selected Member Mode */
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  {t('modals.selectMember', 'Selected Member *')}
                </label>
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
                  {language === 'mr' ? 'बाकी सभासद' : 'Pending Members'}: {pendingMembersCount}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-subtle, #F8FAFC)',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      background: 'rgba(190, 24, 93, 0.12)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {selectedMember.member_code || selectedMember.memberCode || selectedMember.id}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {selectedMember.name}
                  </span>
                </div>
                <Lock size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          ) : (
            /* Searchable Member Dropdown */
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={dropdownRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  {t('modals.selectMember', 'Select Member *')}
                </label>
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
                  {language === 'mr' ? 'बाकी सभासद' : 'Pending Members'}: {pendingMembersCount}
                </span>
              </div>
              <div
                onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: isMemberDropdownOpen ? '1.5px solid var(--primary)' : '1.5px solid var(--border-color)',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                {selectedMember ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        background: 'rgba(190, 24, 93, 0.12)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {selectedMember.member_code || selectedMember.memberCode || selectedMember.id}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {selectedMember.name}
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    {language === 'mr' ? '-- सभासद निवडा --' : '-- Choose Member --'}
                  </span>
                )}
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--text-secondary)',
                    transform: isMemberDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </div>

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
                    ) : filteredMembers.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {language === 'mr' ? 'कोणताही सभासद सापडला नाही' : 'No matching members found'}
                      </div>
                    ) : (
                      filteredMembers.map((m) => {
                        const isSelected = formData.member_id === String(m.member_id || m.id);
                        const mCode = m.member_code || m.memberCode || m.id;
                        const pending = isMemberPending(m);
                        const hasActiveLoan = activeLoans.some((l) => {
                          const lMemId = String(l.memberId || l.member_id || '').trim().toLowerCase();
                          const lMemCode = String(l.memberCode || l.member_code || '').trim().toLowerCase();
                          const memId = String(m.member_id || m.id || '').trim().toLowerCase();
                          const memCode = String(m.member_code || m.memberCode || '').trim().toLowerCase();
                          const status = (l.status || '').toUpperCase();
                          const bal = Number(l.pendingPrincipal ?? l.remainingAmount ?? l.remainingPrincipal ?? 0);
                          const isMatch = lMemId === memId || lMemCode === memCode || 
                            (cleanMemberId(lMemId) && cleanMemberId(lMemId) === cleanMemberId(memId)) || 
                            (cleanMemberId(lMemCode) && cleanMemberId(lMemCode) === cleanMemberId(memCode));
                          return isMatch && status === 'ACTIVE' && bal > 0;
                        });

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

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {hasActiveLoan && (
                                <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                  {language === 'mr' ? 'सक्रिय कर्ज' : 'Active Loan'}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: pending ? 'var(--warning-text, #B45309)' : 'var(--success-text, #065F46)',
                                  background: pending ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-full)',
                                }}
                              >
                                {pending
                                  ? (language === 'mr' ? 'बचत बाकी' : 'Savings Pending')
                                  : (language === 'mr' ? 'बचत जमा' : 'Savings Paid')}
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

          {/* 2. MONTHLY SAVINGS SECTION */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PiggyBank size={16} color="var(--primary)" />
                {language === 'mr' ? 'मासिक बचत' : 'MONTHLY SAVINGS'}
              </span>
              {isSelectedMemberSavingsPaid && (
                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                  {language === 'mr' ? 'या महिन्याची बचत जमा आहे' : 'Savings Already Paid'}
                </span>
              )}
            </div>

            {/* Info strip showing due schedule */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(59, 130, 246, 0.08)',
                color: 'var(--info-text, #1D4ED8)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <Clock size={13} />
              <span>{formatMonthlyHaftaDueDate(monthlyHaftaDay, language)}</span>
            </div>

            <div className="form-grid-2" style={{ gap: '10px' }}>
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

            {/* Contribution Amount Field */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  {t('modals.contributionAmount', 'Contribution Amount (₹) *')}
                </label>
                {isSelectedMemberSavingsPaid && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {language === 'mr' ? '(या व्यवहारात ० रु. आकारले जातील)' : '(₹0 charged in this transaction)'}
                  </span>
                )}
              </div>
              <input
                type="number"
                name="amount"
                className="form-input"
                value={isSelectedMemberSavingsPaid ? '0' : formData.amount}
                readOnly
                tabIndex={-1}
                style={{
                  backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                  cursor: 'not-allowed',
                  color: isSelectedMemberSavingsPaid ? 'var(--text-muted)' : 'var(--text-secondary, #475569)',
                  fontWeight: 600,
                  border: '1px solid var(--border-color, #E2E8F0)',
                }}
                required
              />
            </div>

            <div className="form-grid-2" style={{ gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('modals.paymentMode', 'Payment Mode')}</label>
                <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange}>
                  <option value="CASH">{t('common.cash', 'Cash')}</option>
                  <option value="UPI">{language === 'mr' ? 'यूपीआय / क्यूआर कोड' : 'UPI / QR Code'}</option>
                </select>
              </div>

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

          {/* 3. LOAN REPAYMENT SECTION (Immediately below Monthly Savings) */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: memberActiveLoan && isRepayOverLimit ? 'rgba(239, 68, 68, 0.05)' : '#FFFFFF',
              border: memberActiveLoan && isRepayOverLimit ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={16} color="var(--info-text, #1D4ED8)" />
                {language === 'mr' ? 'कर्ज परतफेड' : 'LOAN REPAYMENT'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {memberActiveLoan && !isLoanRepaymentEligible && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: 'var(--warning-text, #B45309)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 700,
                    }}
                  >
                    <Lock size={12} />
                    {language === 'mr' ? 'परतफेड लॉक आहे' : 'Repayment Locked'}
                  </span>
                )}
                {isLoanRepaymentAlreadyPaid && (
                  <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                    {language === 'mr' ? 'या महिन्याची परतफेड जमा आहे' : 'Repayment Already Recorded'}
                  </span>
                )}
                {memberActiveLoan && (
                  <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                    {memberActiveLoan.loanNumber || memberActiveLoan.loan_number || memberActiveLoan.id}
                  </span>
                )}
              </div>
            </div>

            {memberActiveLoan ? (
              <>
                {/* Repayment Start Date / Due Date Locked Banner */}
                {!isLoanRepaymentEligible && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: 'var(--warning-text, #B45309)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Clock size={16} style={{ flexShrink: 0, color: 'var(--warning-text, #B45309)' }} />
                    <span>{loanRepaymentEligibility.message}</span>
                  </div>
                )}

                {/* Duplicate Repayment Warning Banner */}
                {isLoanRepaymentAlreadyPaid && isLoanRepaymentEligible && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: 'var(--success-text, #065F46)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ flexShrink: 0, color: 'var(--success-text, #065F46)' }} />
                    <span>
                      {language === 'mr'
                        ? 'या महिन्यासाठी आधीच कर्ज परतफेड नोंदवली आहे. पुढील महिन्यात प्रयत्न करा.'
                        : 'Already repayment recorded for this month. Try next month.'}
                    </span>
                  </div>
                )}

                {/* Active Loan Details Card */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    textAlign: 'center',
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {language === 'mr' ? 'एकूण कर्ज' : 'Total Loan'}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {formatCurrency(originalPrincipal)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {language === 'mr' ? 'कर्ज मुद्दल' : 'Loan Principal'}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {formatCurrency(originalPrincipal)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {language === 'mr' ? 'एकूण व्याज' : 'Total Interest'}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--info-text, #1D4ED8)', marginTop: '2px' }}>
                      {formatCurrency(calculatedInterest)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {language === 'mr' ? 'बाकी मुद्दल' : 'Outstanding Principal'}
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                      {formatCurrency(currentOutstanding)}
                    </div>
                  </div>
                </div>

                {/* Applicable Interest & Month Indicator */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(59, 130, 246, 0.06)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {language === 'mr' ? 'निवडलेल्या महिन्यासाठी लागू व्याज:' : 'Applicable Interest for Selected Month:'}
                  </span>
                  <span style={{ fontWeight: 800, color: (!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid) ? 'var(--text-muted)' : 'var(--info-text, #1D4ED8)' }}>
                    {!isLoanRepaymentEligible ? '₹0' : formatCurrency(calculatedInterest)}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({currentMonthLabel} {formData.year})
                      {!isLoanRepaymentEligible ? (
                        <span style={{ color: 'var(--warning-text, #B45309)', marginLeft: '4px', fontWeight: 600 }}>
                          - {language === 'mr' ? 'लॉक' : 'Locked'}
                        </span>
                      ) : isLoanRepaymentAlreadyPaid ? (
                        <span style={{ color: 'var(--success-text, #065F46)', marginLeft: '4px', fontWeight: 600 }}>
                          - {language === 'mr' ? 'आधीच जमा' : 'Paid'}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>

                {/* Principal Repayment Input & Actions */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                        {language === 'mr' ? 'मुद्दल परतफेड (₹)' : 'Principal Repayment (₹)'}
                      </label>
                      {!isLoanRepaymentEligible ? (
                        <span style={{ fontSize: '0.72rem', color: 'var(--warning-text, #B45309)', fontWeight: 600 }}>
                          ({language === 'mr' ? 'अजून तारीख आलेली नाही' : 'Not yet eligible'})
                        </span>
                      ) : isLoanRepaymentAlreadyPaid ? (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {language === 'mr' ? '(या व्यवहारात ० रु. आकारले जातील)' : '(₹0 charged in this transaction)'}
                        </span>
                      ) : null}
                    </div>
                    {!isLoanRepaymentAlreadyPaid && isLoanRepaymentEligible && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={handleSetInterestOnly}
                          style={{ background: 'none', border: 'none', color: 'var(--info-text, #1D4ED8)', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >
                          {language === 'mr'
                            ? `फक्त व्याज (${formatCurrency(calculatedInterest)})`
                            : `Interest Only (${formatCurrency(calculatedInterest)})`}
                        </button>
                        <button
                          type="button"
                          onClick={handleSetFullRepayment}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >
                          {language === 'mr'
                            ? `पूर्ण मुद्दल (${formatCurrency(maxAllowedPrincipal)})`
                            : `Pay Full Principal (${formatCurrency(maxAllowedPrincipal)})`}
                        </button>
                        <button
                          type="button"
                          onClick={handleSetSavingsOnly}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >
                          {language === 'mr' ? 'कर्ज वगळा' : 'Skip Loan'}
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={loanInputRef}
                    type="number"
                    name="loan_repayment_amount"
                    className="form-input"
                    style={{
                      borderColor: isRepayOverLimit ? 'var(--danger)' : undefined,
                      background: (skipLoanRepayment || isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) ? 'var(--bg-subtle, #F8FAFC)' : '#FFFFFF',
                      cursor: (skipLoanRepayment || isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) ? 'not-allowed' : undefined,
                      color: (isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) ? 'var(--text-muted)' : undefined,
                      fontWeight: (isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) ? 600 : undefined,
                    }}
                    value={(!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid || skipLoanRepayment) ? '0' : loanRepaymentAmount}
                    onChange={(e) => {
                      if (isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible) return;
                      setSkipLoanRepayment(false);
                      setLoanRepaymentAmount(e.target.value);
                      setError('');
                    }}
                    disabled={skipLoanRepayment || isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible}
                    readOnly={isLoanRepaymentAlreadyPaid || !isLoanRepaymentEligible}
                    min="0"
                    max={maxAllowedPrincipal}
                    step="1"
                    placeholder="0"
                  />

                  {isRepayOverLimit && (
                    <div style={{ color: 'var(--danger-text, #DC2626)', fontSize: '0.78rem', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} />
                      {loanValidationError}
                    </div>
                  )}
                </div>

                {/* Status Breakdown: Interest Amount, Total Loan Repayment, Outstanding After Repayment */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    fontSize: '0.8rem',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color, #E2E8F0)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>
                    <span>{language === 'mr' ? 'व्याज रक्कम:' : 'Interest Amount:'} </span>
                    <strong style={{ color: (!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid) ? 'var(--text-muted)' : 'var(--info-text, #1D4ED8)' }}>
                      {(!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid) ? '₹0' : formatCurrency(calculatedInterest)}
                      {!isLoanRepaymentEligible ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--warning-text, #B45309)', marginLeft: '4px' }}>
                          ({language === 'mr' ? 'लॉक' : 'Locked'})
                        </span>
                      ) : isLoanRepaymentAlreadyPaid ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success-text, #065F46)', marginLeft: '4px' }}>
                          ({language === 'mr' ? 'आधीच जमा' : 'Paid'})
                        </span>
                      ) : null}
                    </strong>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <span>{language === 'mr' ? 'एकूण कर्ज परतफेड:' : 'Total Loan Repayment:'} </span>
                    <strong style={{ color: (!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid) ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {(!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid) ? '₹0' : formatCurrency(parsedRepayment + calculatedInterest)}
                    </strong>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span>{language === 'mr' ? 'परतफेडीनंतर शिल्लक:' : 'Outstanding After Repayment:'} </span>
                    <strong style={{ color: isRepayOverLimit ? 'var(--danger)' : outstandingAfterRepayment === 0 ? 'var(--success-text)' : 'var(--primary)' }}>
                      {formatCurrency((!isLoanRepaymentEligible || isLoanRepaymentAlreadyPaid) ? currentOutstanding : outstandingAfterRepayment)}
                      {isLoanRepaymentEligible && outstandingAfterRepayment === 0 && !skipLoanRepayment && !isLoanRepaymentAlreadyPaid && parsedRepayment > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success-text)', display: 'block' }}>
                          ({language === 'mr' ? 'कर्ज बंद होईल' : 'Closed'})
                        </span>
                      )}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              /* Informational state when member has no active loan */
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-subtle, #F8FAFC)',
                  border: '1px dashed var(--border-color, #CBD5E1)',
                  fontSize: '0.84rem',
                  color: 'var(--text-muted, #64748B)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                <span>
                  {!formData.member_id
                    ? (language === 'mr'
                        ? 'कर्ज परतफेड तपशील पाहण्यासाठी कृपया वर सभासद निवडा.'
                        : 'Please select a member above to check for active loans.')
                    : (language === 'mr'
                        ? `${selectedMember?.name || 'या सभासदासाठी'} कोणतेही सक्रिय / बाकी कर्ज नाही. (फक्त मासिक बचत नोंदवली जाईल)`
                        : `No active/outstanding loan for ${selectedMember?.name || 'this member'}. Only monthly savings will be recorded.`)}
                </span>
              </div>
            )}
          </div>

          {/* 4. PAYMENT SUMMARY */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              border: '1px solid rgba(190, 24, 93, 0.25)',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={14} />
              {language === 'mr' ? 'पेमेंट सारांश' : 'PAYMENT SUMMARY'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {language === 'mr' ? 'मासिक बचत' : 'Monthly Savings'}:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatCurrency(effectiveSavingsAmount)}
                  {isSelectedMemberSavingsPaid && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                      ({language === 'mr' ? 'आधीच जमा' : 'Already Paid'})
                    </span>
                  )}
                </span>
              </div>

              {memberActiveLoan && !skipLoanRepayment && (
                !isLoanRepaymentEligible ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {language === 'mr' ? 'कर्ज परतफेड' : 'Loan Repayment'}:
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--warning-text, #B45309)' }}>
                      ₹0
                      <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>
                        ({language === 'mr' ? 'अजून तारीख आलेली नाही' : 'Not Eligible Yet'})
                      </span>
                    </span>
                  </div>
                ) : isLoanRepaymentAlreadyPaid ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {language === 'mr' ? 'कर्ज परतफेड' : 'Loan Repayment'}:
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹0
                      <span style={{ fontSize: '0.75rem', color: 'var(--success-text, #065F46)', marginLeft: '4px' }}>
                        ({language === 'mr' ? 'या महिन्याची नोंद पूर्ण' : 'Already Paid This Month'})
                      </span>
                    </span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {language === 'mr' ? 'कर्ज मुद्दल परतफेड' : 'Loan Principal Repayment'}:
                      </span>
                      <span style={{ fontWeight: 600, color: isRepayOverLimit ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {formatCurrency(parsedRepayment)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {language === 'mr' ? 'कर्ज व्याज' : 'Loan Interest'}:
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--info-text, #1D4ED8)' }}>
                        {formatCurrency(calculatedInterest)}
                      </span>
                    </div>
                  </>
                )
              )}

              <div style={{ height: '1px', background: 'rgba(190, 24, 93, 0.2)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                <span>{language === 'mr' ? 'एकूण जमा रक्कम:' : 'TOTAL COLLECTION:'}</span>
                <span>{formatCurrency(totalCollection)}</span>
              </div>
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
            {effectiveSavingsAmount > 0 && isLoanPaymentActive
              ? (language === 'mr'
                  ? `तुम्ही ${currentMonthObj?.label || ''} ${formData.year} ची मासिक बचत आणि कर्ज परतफेड नोंदवणार आहात.`
                  : `You are about to record monthly saving and loan repayment for ${currentMonthObj?.en || currentMonthLabel} ${formData.year}.`)
              : isLoanPaymentActive
              ? (language === 'mr'
                  ? `तुम्ही कर्ज परतफेड नोंदवणार आहात.`
                  : `You are about to record loan repayment.`)
              : (language === 'mr'
                  ? `तुम्ही ${currentMonthObj?.label || ''} ${formData.year} ची मासिक बचत नोंदवणार आहात.`
                  : `You are about to record monthly saving for ${currentMonthObj?.en || currentMonthLabel} ${formData.year}.`)}
          </p>

          {selectedMember && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle, #F8FAFC)',
                border: '1px solid var(--border-color, #E2E8F0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #E2E8F0)', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedMember.name} ({selectedMember.member_code || selectedMember.memberCode || selectedMember.id})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{language === 'mr' ? 'मासिक बचत:' : 'Monthly Savings:'}</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(effectiveSavingsAmount)}</span>
              </div>

              {isLoanPaymentActive && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>{language === 'mr' ? 'कर्ज मुद्दल:' : 'Loan Principal:'}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(parsedRepayment)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>{language === 'mr' ? 'कर्ज व्याज:' : 'Loan Interest:'}</span>
                    <span style={{ fontWeight: 700, color: 'var(--info-text, #1D4ED8)' }}>{formatCurrency(calculatedInterest)}</span>
                  </div>
                </>
              )}

              <div style={{ height: '1px', background: 'var(--border-color, #E2E8F0)', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.98rem', fontWeight: 800 }}>
                <span style={{ color: 'var(--primary)' }}>{language === 'mr' ? 'एकूण जमा:' : 'Total Collection:'}</span>
                <span style={{ color: 'var(--primary)' }}>{formatCurrency(totalCollection)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default RecordSavingsAndLoanModal;
