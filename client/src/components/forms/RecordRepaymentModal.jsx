import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { loanService } from '../../services/loanService';
import { CreditCard, AlertCircle, CheckCircle2, Calculator, Info } from 'lucide-react';

const RecordRepaymentModal = ({ isOpen, onClose, onSuccess, initialLoanId = null }) => {
  const currentDate = new Date();
  const [activeLoans, setActiveLoans] = useState([]);
  const [formData, setFormData] = useState({
    loan_id: initialLoanId ? initialLoanId.toString() : '',
    payment_month: (currentDate.getMonth() + 1).toString(),
    payment_year: currentDate.getFullYear().toString(),
    regular_hafta_amount: '0',
    principal_repayment_amount: '0',
    payment_date: currentDate.toISOString().split('T')[0],
    payment_mode: 'UPI',
    remarks: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchLoans = async () => {
        try {
          const res = await loanService.getAllLoans({ status: 'ACTIVE' });
          if (res.success) {
            setActiveLoans(res.loans);
            if (initialLoanId) {
              setFormData((prev) => ({ ...prev, loan_id: initialLoanId.toString() }));
            } else if (res.loans.length > 0 && !formData.loan_id) {
              setFormData((prev) => ({ ...prev, loan_id: res.loans[0].id.toString() }));
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchLoans();
    }
  }, [isOpen, initialLoanId]);

  const selectedLoan = activeLoans.find((l) => l.id.toString() === formData.loan_id.toString());
  const currentOutstanding = selectedLoan ? parseFloat(selectedLoan.outstanding_amount) : 0;
  const interestRate = selectedLoan ? parseFloat(selectedLoan.interest_rate) : 0;

  const regularHafta = parseFloat(formData.regular_hafta_amount) || 0;
  const principalRepay = parseFloat(formData.principal_repayment_amount) || 0;
  const calculatedInterest = selectedLoan ? Math.round(((currentOutstanding * interestRate) / 100) * 100) / 100 : 0;
  const totalPayment = Math.round((regularHafta + principalRepay + calculatedInterest) * 100) / 100;
  const newOutstanding = Math.max(0, Math.round((currentOutstanding - principalRepay) * 100) / 100);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSetFullRepayment = () => {
    setFormData((prev) => ({
      ...prev,
      principal_repayment_amount: currentOutstanding.toString(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loan_id) {
      setError('Please select an active loan.');
      return;
    }

    if (principalRepay > currentOutstanding) {
      setError(`Principal repayment (₹${principalRepay}) cannot exceed outstanding amount (₹${currentOutstanding}).`);
      return;
    }

    if (totalPayment <= 0) {
      setError('Total payment must be greater than zero.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await loanService.recordRepayment(formData.loan_id, {
        payment_month: parseInt(formData.payment_month, 10),
        payment_year: parseInt(formData.payment_year, 10),
        regular_hafta_amount: regularHafta,
        principal_repayment_amount: principalRepay,
        payment_date: formData.payment_date,
        payment_mode: formData.payment_mode,
        remarks: formData.remarks,
      });

      if (res.success) {
        setSuccess(res.message);
        setTimeout(() => {
          setSuccess('');
          onSuccess();
          onClose();
        }, 1300);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record loan payment.');
    } finally {
      setLoading(false);
    }
  };

  const months = [
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Loan Payment" maxWidth="560px">
      <form onSubmit={handleSubmit}>
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

        <div className="form-group">
          <label className="form-label">Select Active Loan *</label>
          <select name="loan_id" className="form-select" value={formData.loan_id} onChange={handleChange} required>
            <option value="">-- Select Active Loan --</option>
            {activeLoans.map((l) => (
              <option key={l.id} value={l.id}>
                {l.member_name} ({l.member_code}) — {l.loan_number} | Outstanding: ₹{l.outstanding_amount} (@ {l.interest_rate}%/mo)
              </option>
            ))}
          </select>
        </div>

        {selectedLoan && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: '#F8FAFC',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ORIGINAL LOAN</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>₹{selectedLoan.principal_amount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OUTSTANDING</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>₹{currentOutstanding}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>MONTHLY RATE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--info)' }}>{interestRate}%</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Month *</label>
            <select name="payment_month" className="form-select" value={formData.payment_month} onChange={handleChange} required>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Year *</label>
            <input
              type="number"
              name="payment_year"
              className="form-input"
              value={formData.payment_year}
              onChange={handleChange}
              min="2020"
              max="2040"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Regular Hafta Amount (₹)</label>
            <input
              type="number"
              name="regular_hafta_amount"
              className="form-input"
              value={formData.regular_hafta_amount}
              onChange={handleChange}
              min="0"
              step="50"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Principal Repayment (₹)</label>
              {selectedLoan && (
                <button
                  type="button"
                  onClick={handleSetFullRepayment}
                  style={{ background: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Pay Full
                </button>
              )}
            </div>
            <input
              type="number"
              name="principal_repayment_amount"
              className="form-input"
              value={formData.principal_repayment_amount}
              onChange={handleChange}
              min="0"
              max={currentOutstanding}
              step="10"
            />
          </div>
        </div>

        {/* Automatic Live Calculation Box */}
        <div
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(194, 24, 91, 0.08) 0%, rgba(233, 30, 99, 0.03) 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(194, 24, 91, 0.25)',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '10px' }}>
            <Calculator size={16} /> AUTOMATIC PAYMENT CALCULATION
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Calculated Monthly Interest ({interestRate}% of ₹{currentOutstanding}):</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{calculatedInterest.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Principal Repayment:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{principalRepay.toFixed(2)}</span>
            </div>
            {regularHafta > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Regular Hafta:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{regularHafta.toFixed(2)}</span>
              </div>
            )}
            <div style={{ height: '1px', background: 'rgba(194, 24, 91, 0.2)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
              <span style={{ color: 'var(--primary)' }}>Total Payment Collected:</span>
              <span style={{ color: 'var(--primary)' }}>₹{totalPayment.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>New Outstanding Balance:</span>
              <span style={{ fontWeight: 700, color: newOutstanding === 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                ₹{newOutstanding.toFixed(2)} {newOutstanding === 0 && '(Will mark loan as CLOSED)'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Payment Date</label>
            <input
              type="date"
              name="payment_date"
              className="form-input"
              value={formData.payment_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange}>
              <option value="UPI">UPI / QR Code</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Payment Remarks</label>
          <input
            type="text"
            name="remarks"
            className="form-input"
            placeholder="e.g. Received via GPay, receipt #104"
            value={formData.remarks}
            onChange={handleChange}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !selectedLoan}>
            <CreditCard size={16} />
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordRepaymentModal;
