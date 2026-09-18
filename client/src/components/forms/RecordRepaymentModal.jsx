import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { loanService } from '../../services/loanService';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import {
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Calculator,
  ArrowLeft,
  Search,
  Users,
  CheckCircle,
  Coins,
  Receipt,
  Percent,
  Check,
} from 'lucide-react';

const RecordRepaymentModal = ({ isOpen, onClose, onSuccess, initialLoanId = null }) => {
  const { language } = useLanguage();
  const currentDate = new Date();

  const [activeLoans, setActiveLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(initialLoanId ? initialLoanId.toString() : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [formData, setFormData] = useState({
    loan_id: '',
    payment_month: (currentDate.getMonth() + 1).toString(),
    payment_year: currentDate.getFullYear().toString(),
    regular_hafta_amount: '0',
    principal_repayment_amount: '0',
    payment_date: currentDate.toISOString().split('T')[0],
    payment_mode: 'CASH',
    remarks: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch active loans whenever modal opens
  const fetchLoans = async () => {
    try {
      setLoadingLoans(true);
      const res = await loanService.getAllLoans({ status: 'ACTIVE' });
      if (res.success) {
        setActiveLoans(res.loans || res.allLoans || []);
      }
    } catch (err) {
      console.error('Failed to fetch active loans:', err);
    } finally {
      setLoadingLoans(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setSearchQuery('');
      setShowConfirmModal(false);
      setSelectedLoanId(initialLoanId ? initialLoanId.toString() : null);
      setFormData({
        loan_id: initialLoanId ? initialLoanId.toString() : '',
        payment_month: (currentDate.getMonth() + 1).toString(),
        payment_year: currentDate.getFullYear().toString(),
        regular_hafta_amount: '0',
        principal_repayment_amount: '0',
        payment_date: currentDate.toISOString().split('T')[0],
        payment_mode: 'CASH',
        remarks: '',
      });
      fetchLoans();
    }
  }, [isOpen, initialLoanId]);

  // Compute pending loans list (only active loans with pendingPrincipal > 0)
  const pendingLoans = activeLoans
    .filter((l) => {
      const status = (l.status || '').toUpperCase();
      const pending = Number(
        l.pendingPrincipal !== undefined && l.pendingPrincipal !== null
          ? l.pendingPrincipal
          : l.remainingAmount !== undefined && l.remainingAmount !== null
          ? l.remainingAmount
          : l.outstanding_amount || 0
      );
      return status === 'ACTIVE' && pending > 0;
    })
    .map((l) => {
      const originalPrincipal = Number(l.originalPrincipal || l.principal_amount || l.amount || 0);
      const pendingPrincipal = Number(
        l.pendingPrincipal !== undefined && l.pendingPrincipal !== null
          ? l.pendingPrincipal
          : l.remainingAmount !== undefined && l.remainingAmount !== null
          ? l.remainingAmount
          : l.outstanding_amount || 0
      );
      const paidPrincipal = Number(
        l.totalPrincipalPaid !== undefined && l.totalPrincipalPaid !== null
          ? l.totalPrincipalPaid
          : l.total_principal_paid !== undefined && l.total_principal_paid !== null
          ? l.total_principal_paid
          : Math.max(0, originalPrincipal - pendingPrincipal)
      );
      const interestRate = Number(l.interestRate || l.interest_rate || 2.0);
      const applicableInterest = Math.round(((pendingPrincipal * interestRate) / 100) * 100) / 100;
      const totalPending = Math.round((pendingPrincipal + applicableInterest) * 100) / 100;

      return {
        ...l,
        originalPrincipal,
        paidPrincipal,
        pendingPrincipal,
        interestRate,
        applicableInterest,
        totalPending,
      };
    });

  // Filter by search query if present
  const filteredLoans = pendingLoans.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (l.memberName || l.member_name || '').toLowerCase();
    const code = (l.memberCode || l.member_code || '').toLowerCase();
    const loanNum = (l.loanNumber || l.loan_number || '').toLowerCase();
    return name.includes(q) || code.includes(q) || loanNum.includes(q);
  });

  // Aggregates for header summary in list view
  const totalPendingMembers = pendingLoans.length;
  const totalPendingPrincipalSum = pendingLoans.reduce((sum, l) => sum + l.pendingPrincipal, 0);
  const totalApplicableInterestSum = pendingLoans.reduce((sum, l) => sum + l.applicableInterest, 0);
  const totalPendingAmountSum = pendingLoans.reduce((sum, l) => sum + l.totalPending, 0);

  // Selected loan details for repayment recording
  const selectedLoan = pendingLoans.find((l) => l.id.toString() === (selectedLoanId || '').toString()) ||
    activeLoans.find((l) => l.id.toString() === (selectedLoanId || '').toString());

  const currentOutstanding = selectedLoan
    ? Number(
        selectedLoan.pendingPrincipal !== undefined && selectedLoan.pendingPrincipal !== null
          ? selectedLoan.pendingPrincipal
          : selectedLoan.remainingAmount !== undefined && selectedLoan.remainingAmount !== null
          ? selectedLoan.remainingAmount
          : selectedLoan.outstanding_amount || 0
      )
    : 0;

  const interestRate = selectedLoan ? Number(selectedLoan.interestRate || selectedLoan.interest_rate || 2.0) : 2.0;
  const regularHafta = parseFloat(formData.regular_hafta_amount) || 0;
  const principalRepay = parseFloat(formData.principal_repayment_amount) || 0;
  const calculatedInterest = selectedLoan ? Math.round(((currentOutstanding * interestRate) / 100) * 100) / 100 : 0;
  const totalPayment = Math.round((principalRepay + calculatedInterest + regularHafta) * 100) / 100;
  const newOutstanding = Math.max(0, Math.round((currentOutstanding - principalRepay) * 100) / 100);

  // Maximum repayment boundaries
  const maxAllowedPrincipal = Math.max(0, currentOutstanding);
  const maxAllowedTotal = Math.round((maxAllowedPrincipal + calculatedInterest) * 100) / 100;
  const maxAllowedTotalWithHafta = Math.round((maxAllowedTotal + regularHafta) * 100) / 100;

  const isPrincipalOverLimit = principalRepay > maxAllowedPrincipal;
  const isTotalOverLimit = totalPayment > maxAllowedTotalWithHafta;
  const isPrincipalNegative = principalRepay < 0;
  const isAmountInvalid = isPrincipalOverLimit || isTotalOverLimit || isPrincipalNegative;

  const validationError = isPrincipalNegative
    ? (language === 'mr' ? 'मुद्दल परतफेड रक्कम ० पेक्षा कमी असू शकत नाही.' : 'Principal repayment amount cannot be negative.')
    : isPrincipalOverLimit
    ? (language === 'mr'
        ? `मुद्दल परतफेड बाकी मुद्दल ${formatCurrency(maxAllowedPrincipal)} पेक्षा जास्त असू शकत नाही.`
        : `Principal repayment cannot exceed the outstanding principal of ${formatCurrency(maxAllowedPrincipal)}.`)
    : isTotalOverLimit
    ? (language === 'mr'
        ? `एकूण परतफेड ${formatCurrency(maxAllowedTotalWithHafta)} (${formatCurrency(maxAllowedPrincipal)} मुद्दल + ${formatCurrency(calculatedInterest)} व्याज) पेक्षा जास्त असू शकत नाही.`
        : `Total repayment cannot exceed ${formatCurrency(maxAllowedTotalWithHafta)} (${formatCurrency(maxAllowedPrincipal)} principal + ${formatCurrency(calculatedInterest)} interest).`)
    : '';

  const handleSelectLoan = (loan) => {
    setSelectedLoanId(loan.id.toString());
    setFormData((prev) => ({
      ...prev,
      loan_id: loan.id.toString(),
      principal_repayment_amount: '0',
      regular_hafta_amount: '0',
      payment_date: currentDate.toISOString().split('T')[0],
      payment_mode: 'CASH',
      remarks: '',
    }));
    setError('');
    setSuccess('');
  };

  const handleBackToList = () => {
    setSelectedLoanId(null);
    setShowConfirmModal(false);
    setError('');
    setSuccess('');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSetFullRepayment = () => {
    setFormData((prev) => ({
      ...prev,
      principal_repayment_amount: maxAllowedPrincipal.toString(),
    }));
    setError('');
  };

  const handleSetInterestOnly = () => {
    setFormData((prev) => ({
      ...prev,
      principal_repayment_amount: '0',
    }));
    setError('');
  };

  const handleOpenConfirm = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedLoanId) {
      setError(language === 'mr' ? 'कृपया सक्रिय कर्ज निवडा.' : 'Please select an active loan.');
      return;
    }

    if (isPrincipalNegative) {
      setError(language === 'mr' ? 'मुद्दल परतफेड रक्कम ० पेक्षा कमी असू शकत नाही.' : 'Principal repayment amount cannot be negative.');
      return;
    }

    if (isPrincipalOverLimit) {
      setError(
        language === 'mr'
          ? `मुद्दल परतफेड बाकी मुद्दल ${formatCurrency(maxAllowedPrincipal)} पेक्षा जास्त असू शकत नाही.`
          : `Principal repayment cannot exceed the outstanding principal of ${formatCurrency(maxAllowedPrincipal)}.`
      );
      return;
    }

    if (isTotalOverLimit) {
      setError(
        language === 'mr'
          ? `एकूण परतफेड ${formatCurrency(maxAllowedTotalWithHafta)} (${formatCurrency(maxAllowedPrincipal)} मुद्दल + ${formatCurrency(calculatedInterest)} व्याज) पेक्षा जास्त असू शकत नाही.`
          : `Total repayment cannot exceed ${formatCurrency(maxAllowedTotalWithHafta)} (${formatCurrency(maxAllowedPrincipal)} principal + ${formatCurrency(calculatedInterest)} interest).`
      );
      return;
    }

    if (totalPayment <= 0) {
      setError(language === 'mr' ? 'एकूण देय रक्कम ० पेक्षा जास्त असणे आवश्यक आहे.' : 'Total payment must be greater than zero.');
      return;
    }

    setError('');
    setShowConfirmModal(true);
  };

  const handleConfirmRepay = async () => {
    try {
      if (isAmountInvalid) {
        setError(validationError || (language === 'mr' ? 'अवैध परतफेड रक्कम.' : 'Invalid repayment amount.'));
        setShowConfirmModal(false);
        return;
      }

      setLoading(true);
      setError('');
      const res = await loanService.recordRepayment({
        loan_id: selectedLoanId,
        loanId: selectedLoanId,
        payment_month: parseInt(formData.payment_month, 10),
        payment_year: parseInt(formData.payment_year, 10),
        regular_hafta_amount: regularHafta,
        principal_repayment_amount: principalRepay,
        payment_date: formData.payment_date,
        payment_mode: formData.payment_mode,
        remarks: formData.remarks,
      });

      if (res.success) {
        setShowConfirmModal(false);
        setSuccess(res.message || (language === 'mr' ? 'कर्ज परतफेड यशस्वीरित्या नोंदवली गेली!' : 'Loan repayment recorded successfully!'));
        if (onSuccess) onSuccess();

        // Refresh internal loans
        await fetchLoans();

        setTimeout(() => {
          setSuccess('');
          if (initialLoanId) {
            onClose();
          } else {
            setSelectedLoanId(null);
          }
        }, 1200);
      }
    } catch (err) {
      setShowConfirmModal(false);
      setError(err.response?.data?.message || err.message || (language === 'mr' ? 'कर्ज परतफेड नोंदवण्यात त्रुटी आली.' : 'Failed to record loan payment.'));
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: 1, label: language === 'mr' ? 'जानेवारी' : 'January' },
    { value: 2, label: language === 'mr' ? 'फेब्रुवारी' : 'February' },
    { value: 3, label: language === 'mr' ? 'मार्च' : 'March' },
    { value: 4, label: language === 'mr' ? 'एप्रिल' : 'April' },
    { value: 5, label: language === 'mr' ? 'मे' : 'May' },
    { value: 6, label: language === 'mr' ? 'जून' : 'June' },
    { value: 7, label: language === 'mr' ? 'जुलै' : 'July' },
    { value: 8, label: language === 'mr' ? 'ऑगस्ट' : 'August' },
    { value: 9, label: language === 'mr' ? 'सप्टेंबर' : 'September' },
    { value: 10, label: language === 'mr' ? 'ऑक्टोबर' : 'October' },
    { value: 11, label: language === 'mr' ? 'नोव्हेंबर' : 'November' },
    { value: 12, label: language === 'mr' ? 'डिसेंबर' : 'December' },
  ];

  const modalTitle = selectedLoanId
    ? (language === 'mr' ? 'कर्ज परतफेड नोंदवा' : 'Record Loan Repayment')
    : (language === 'mr' ? 'थकीत कर्ज व परतफेड यादी' : 'Pending Loans & Repayment');

  const modalMaxWidth = selectedLoanId ? '600px' : '880px';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        maxWidth={modalMaxWidth}
        onSubmit={selectedLoanId ? handleOpenConfirm : null}
      footer={
        selectedLoanId ? (
          <>
            {!initialLoanId && (
              <button type="button" onClick={handleBackToList} className="btn-secondary" tabIndex={0} disabled={loading}>
                <ArrowLeft size={16} /> {language === 'mr' ? 'मागे यादीकडे' : 'Back to List'}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary" tabIndex={0} disabled={loading}>
              {language === 'mr' ? 'रद्द करा' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedLoan || isAmountInvalid}
              style={isAmountInvalid ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              tabIndex={0}
            >
              <CreditCard size={16} />
              {loading
                ? (language === 'mr' ? 'नोंदवत आहे...' : 'Recording...')
                : (language === 'mr' ? 'परतफेड नोंदवा' : 'Record Payment')}
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className="btn-secondary" tabIndex={0}>
            {language === 'mr' ? 'बंद करा' : 'Close'}
          </button>
        )
      }
    >
      <div>
        {(error || validationError) && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--danger-light)',
              color: 'var(--danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} /> {error || validationError}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--success-light)',
              color: 'var(--success-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* VIEW 1: Pending Loans List View */}
        {!selectedLoanId && (
          <div>
            {/* Top Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--accent-soft)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'थकीत कर्ज सभासद' : 'Pending Members'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {totalPendingMembers}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--warning-light)',
                    color: 'var(--warning-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Coins size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'एकूण बाकी मुद्दल' : 'Total Pending Principal'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning-text)' }}>
                    {formatCurrency(totalPendingPrincipalSum)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--info-light)',
                    color: 'var(--info-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Percent size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'चालू मासिक व्याज' : 'Monthly Interest'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--info-text)' }}>
                    {formatCurrency(totalApplicableInterestSum)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(190, 24, 93, 0.08) 0%, rgba(219, 39, 119, 0.04) 100%)',
                  border: '1px solid rgba(190, 24, 93, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Receipt size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'एकूण देय रक्कम' : 'Total Pending Due'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {formatCurrency(totalPendingAmountSum)}
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            {pendingLoans.length > 3 && (
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={language === 'mr' ? 'सभासदाचे नाव किंवा कोड शोधा...' : 'Search member by name or code...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.875rem' }}
                />
              </div>
            )}

            {/* Pending Loans Table */}
            {loadingLoans ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {language === 'mr' ? 'माहिती लोड होत आहे...' : 'Loading pending loans...'}
              </div>
            ) : filteredLoans.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <CheckCircle size={40} style={{ color: 'var(--success)', marginBottom: '10px' }} />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {language === 'mr' ? 'कोणतेही थकीत कर्ज नाही!' : 'No Pending Loans Found!'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {language === 'mr'
                    ? 'सर्व सभासदांची कर्जे पूर्णपणे भरलेली आहेत किंवा कोणतेही सक्रिय कर्ज पेंडिंग नाही.'
                    : 'All member loans are fully settled or there are no active outstanding loans.'}
                </div>
              </div>
            ) : (
              <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="custom-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '140px' }}>{language === 'mr' ? 'सभासद' : 'Member'}</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{language === 'mr' ? 'मूळ कर्ज' : 'Total Loan'}</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{language === 'mr' ? 'भरलेले मुद्दल' : 'Paid Principal'}</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{language === 'mr' ? 'बाकी मुद्दल' : 'Pending Principal'}</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{language === 'mr' ? 'चालू व्याज' : 'Applicable Interest'}</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{language === 'mr' ? 'एकूण देय' : 'Total Pending'}</th>
                      <th style={{ textAlign: 'center', minWidth: '130px' }}>{language === 'mr' ? 'कृती' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoans.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {l.memberName || l.member_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {l.memberCode || l.member_code} • {l.loanNumber || l.loan_number}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(l.originalPrincipal)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--success-text)', fontWeight: 600 }}>
                          {formatCurrency(l.paidPrincipal)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--warning-text)', fontWeight: 700 }}>
                          {formatCurrency(l.pendingPrincipal)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--info-text)', fontWeight: 600 }}>
                          {formatCurrency(l.applicableInterest)}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                            ({l.interestRate}%/mo)
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 800 }}>
                          {formatCurrency(l.totalPending)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectLoan(l)}
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '5px' }}
                            title={language === 'mr' ? 'परतफेड नोंदवा' : 'Record Repayment'}
                          >
                            <CreditCard size={14} />
                            {language === 'mr' ? 'परतफेड' : 'Pay Now'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Loan Repayment Form */}
        {selectedLoanId && selectedLoan && (
          <div>
            {/* Top Navigation & Selected Member Banner */}
            {!initialLoanId && (
              <button
                type="button"
                onClick={handleBackToList}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '14px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <ArrowLeft size={16} /> {language === 'mr' ? 'सर्व थकीत कर्जे यादीकडे परत' : 'Back to Pending Loans List'}
              </button>
            )}

            {/* Selected Loan Info Card */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: '#F8FAFC',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedLoan.memberName || selectedLoan.member_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {language === 'mr' ? 'सभासद कोड' : 'Member Code'}: <strong style={{ color: 'var(--text-secondary)' }}>{selectedLoan.memberCode || selectedLoan.member_code}</strong> | {selectedLoan.loanNumber || selectedLoan.loan_number}
                  </div>
                </div>
                <span className="badge badge-pink" style={{ fontSize: '0.75rem' }}>
                  {language === 'mr' ? 'सक्रिय कर्ज' : 'ACTIVE LOAN'}
                </span>
              </div>

              <div
                className="form-grid-3"
                style={{
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'मूळ कर्ज' : 'Original Loan'}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {formatCurrency(selectedLoan.originalPrincipal || selectedLoan.principal_amount || 0)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'चालू बाकी मुद्दल' : 'Outstanding Principal'}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {formatCurrency(currentOutstanding)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {language === 'mr' ? 'मासिक व्याज दर' : 'Monthly Rate'}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--info)' }}>
                    {interestRate}% / {language === 'mr' ? 'महिना' : 'mo'}
                  </div>
                </div>
              </div>
            </div>

            {/* Month and Year Selection */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{language === 'mr' ? 'महिना *' : 'Payment Month *'}</label>
                <select name="payment_month" className="form-select" value={formData.payment_month} onChange={handleChange} tabIndex={0} required>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{language === 'mr' ? 'वर्ष *' : 'Payment Year *'}</label>
                <input
                  type="number"
                  name="payment_year"
                  className="form-input"
                  value={formData.payment_year}
                  onChange={handleChange}
                  tabIndex={0}
                  min="2020"
                  max="2040"
                  required
                />
              </div>
            </div>

            {/* Applicable Monthly Interest Display */}
            <div className="form-group">
              <label className="form-label">
                {language === 'mr'
                  ? `चालू महिन्याचे व्याज (${interestRate}% of ${formatCurrency(currentOutstanding)})`
                  : `Applicable Monthly Interest (${interestRate}% of ${formatCurrency(currentOutstanding)})`}
              </label>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--info-text)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{formatCurrency(calculatedInterest)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {language === 'mr' ? 'आपोआप मोजलेले व्याज' : 'Auto-calculated'}
                </span>
              </div>
            </div>

            {/* Principal Repayment Input */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">
                  {language === 'mr' ? 'मुद्दल परतफेड रक्कम (₹)' : 'Principal Repayment (₹)'}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleSetInterestOnly}
                    tabIndex={0}
                    style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    {language === 'mr' ? 'फक्त व्याज (₹0 मुद्दल)' : 'Interest Only (₹0)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSetFullRepayment}
                    tabIndex={0}
                    style={{ background: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    {language === 'mr' ? `पूर्ण मुद्दल भरा (${formatCurrency(maxAllowedPrincipal)})` : `Pay Full Principal (${formatCurrency(maxAllowedPrincipal)})`}
                  </button>
                </div>
              </div>
              <input
                type="number"
                name="principal_repayment_amount"
                className="form-input"
                style={isPrincipalOverLimit ? { borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' } : {}}
                value={formData.principal_repayment_amount}
                onChange={handleChange}
                tabIndex={0}
                min="0"
                max={maxAllowedPrincipal}
                step="1"
                placeholder="0"
              />
              {isPrincipalOverLimit && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={14} />
                  {language === 'mr'
                    ? `कमाल मुद्दल परतफेड ${formatCurrency(maxAllowedPrincipal)} अनुज्ञेय आहे.`
                    : `Maximum principal repayment allowed is ${formatCurrency(maxAllowedPrincipal)}.`}
                </div>
              )}
            </div>

            {/* Automatic Live Calculation Box */}
            <div
              style={{
                padding: '16px',
                background: isAmountInvalid
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.03) 100%)'
                  : 'linear-gradient(135deg, rgba(190, 24, 93, 0.08) 0%, rgba(233, 30, 99, 0.03) 100%)',
                borderRadius: 'var(--radius-lg)',
                border: isAmountInvalid
                  ? '1.5px solid rgba(239, 68, 68, 0.5)'
                  : '1px solid rgba(190, 24, 93, 0.25)',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isAmountInvalid ? 'var(--danger)' : 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '10px' }}>
                <Calculator size={16} /> {language === 'mr' ? 'एकूण रक्कम गणना' : 'AUTOMATIC PAYMENT CALCULATION'}
              </div>

              {isAmountInvalid && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--danger-light, #fee2e2)',
                    color: 'var(--danger-text, #991b1b)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '10px',
                  }}
                >
                  <AlertCircle size={15} />
                  {validationError || (language === 'mr' ? 'अवैध रक्कम: परतफेड मर्यादा ओलांडली आहे' : 'Invalid Amount: Repayment limit exceeded')}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {language === 'mr' ? 'चालू व्याज रक्कम' : 'Monthly Interest Amount'}:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(calculatedInterest)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {language === 'mr' ? 'मुद्दल परतफेड' : 'Principal Repayment'}:
                  </span>
                  <span style={{ fontWeight: 600, color: isPrincipalOverLimit ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {formatCurrency(principalRepay)} {isPrincipalOverLimit && '(Over Limit)'}
                  </span>
                </div>
                {regularHafta > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {language === 'mr' ? 'मासिक हप्ता' : 'Regular Hafta'}:
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(regularHafta)}</span>
                  </div>
                )}
                <div style={{ height: '1px', background: isAmountInvalid ? 'rgba(239, 68, 68, 0.3)' : 'rgba(190, 24, 93, 0.2)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800 }}>
                  <span style={{ color: isAmountInvalid ? 'var(--danger)' : 'var(--primary)' }}>
                    {language === 'mr' ? 'एकूण जमा रक्कम (व्याज + मुद्दल):' : 'Total Payment Collected:'}
                  </span>
                  <span style={{ color: isAmountInvalid ? 'var(--danger)' : 'var(--primary)' }}>
                    {formatCurrency(totalPayment)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <span>{language === 'mr' ? 'नवीन बाकी मुद्दल शिल्लक:' : 'New Outstanding Balance:'}</span>
                  <span style={{ fontWeight: 700, color: isPrincipalOverLimit ? 'var(--danger)' : newOutstanding === 0 ? 'var(--success-text)' : 'var(--text-primary)' }}>
                    {isPrincipalOverLimit ? (language === 'mr' ? '— (अवैध रक्कम)' : '— (Invalid Amount)') : `${formatCurrency(newOutstanding)} ${newOutstanding === 0 ? (language === 'mr' ? '(कर्ज पूर्ण बंद होईल)' : '(Will mark loan as CLOSED)') : ''}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Date and Mode */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{language === 'mr' ? 'परतफेड तारीख' : 'Payment Date'}</label>
                <input
                  type="date"
                  name="payment_date"
                  className="form-input"
                  value={formData.payment_date}
                  onChange={handleChange}
                  tabIndex={0}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{language === 'mr' ? 'पेमेंट पद्धत' : 'Payment Mode'}</label>
                <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange} tabIndex={0}>
                  <option value="CASH">{language === 'mr' ? 'रोख (Cash)' : 'Cash'}</option>
                  <option value="UPI">{language === 'mr' ? 'UPI / QR Code' : 'UPI / QR Code'}</option>
                  <option value="BANK_TRANSFER">{language === 'mr' ? 'बँक ट्रान्सफर (Bank Transfer)' : 'Bank Transfer'}</option>
                  <option value="CHEQUE">{language === 'mr' ? 'धनादेश (Cheque)' : 'Cheque'}</option>
                </select>
              </div>
            </div>

            {/* Remarks */}
            <div className="form-group">
              <label className="form-label">{language === 'mr' ? 'नोंद / शेरा' : 'Payment Remarks'}</label>
              <input
                type="text"
                name="remarks"
                className="form-input"
                placeholder={language === 'mr' ? 'उदा. GPay द्वारे प्राप्त, पावती क्र. १०४' : 'e.g. Received via GPay, receipt #104'}
                value={formData.remarks}
                onChange={handleChange}
                tabIndex={0}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Double Confirmation Modal for Loan Repayment */}
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
            onClick={handleConfirmRepay}
            disabled={loading}
            data-autofocus
          >
            <Check size={16} />
            {loading
              ? (language === 'mr' ? 'नोंदवत आहे...' : 'Recording...')
              : (language === 'mr' ? 'होय, पुष्टी करा' : 'Yes, Confirm')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {language === 'mr'
            ? `तुम्ही ${formatCurrency(totalPayment)} ची कर्ज परतफेड नोंदवणार आहात.`
            : `You are about to record a loan repayment of ${formatCurrency(totalPayment)}.`}
        </p>

        {selectedLoan && (
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
                {selectedLoan.memberName || selectedLoan.member_name || selectedLoan.member?.name || 'Member'}
                {selectedLoan.memberCode || selectedLoan.member_code ? ` (${selectedLoan.memberCode || selectedLoan.member_code})` : ''}
              </span>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {language === 'mr' ? 'परतफेड रक्कम' : 'Repayment Amount'}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                {formatCurrency(totalPayment)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  </>
);
};

export default RecordRepaymentModal;
