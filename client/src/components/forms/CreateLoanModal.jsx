import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { loanService } from '../../services/loanService';
import { formatCurrency } from '../../utils/formatters';
import { HandCoins, AlertCircle, CheckCircle2, Calculator } from 'lucide-react';

const CreateLoanModal = ({ isOpen, onClose, onSuccess, initialMemberId = null }) => {
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    member_id: initialMemberId || '',
    principal_amount: '1000',
    interest_rate: '2.0',
    duration_months: '12',
    loan_date: new Date().toISOString().split('T')[0],
    purpose: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchMembers = async () => {
        try {
          const res = await memberService.getAllMembers({ status: 'active' });
          if (res.success) {
            setMembers(res.members);
            if (initialMemberId) {
              setFormData((prev) => ({ ...prev, member_id: initialMemberId }));
            } else if (res.members.length > 0 && !formData.member_id) {
              setFormData((prev) => ({ ...prev, member_id: res.members[0].member_id }));
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchMembers();
    }
  }, [isOpen, initialMemberId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const principal = parseFloat(formData.principal_amount) || 0;
  const rate = parseFloat(formData.interest_rate) || 0;
  const monthlyInterest = (principal * rate) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.member_id || !formData.principal_amount) {
      setError('Please select a member and enter loan amount.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await loanService.createLoan({
        ...formData,
        principal_amount: parseFloat(formData.principal_amount),
        interest_rate: parseFloat(formData.interest_rate),
        duration_months: parseInt(formData.duration_months, 10),
      });

      if (res.success) {
        setSuccess(`Loan ${res.loanNumber} created successfully!`);
        setTimeout(() => {
          setSuccess('');
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create loan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Issue New Group Loan" maxWidth="540px">
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
          <label className="form-label">Borrowing Member *</label>
          <select name="member_id" className="form-select" value={formData.member_id} onChange={handleChange} data-autofocus required>
            <option value="">-- Choose Member --</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.name} ({m.member_code}) - Savings: {formatCurrency(m.total_savings || m.totalSavings)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Principal Amount (₹) *</label>
            <input
              type="number"
              name="principal_amount"
              className="form-input"
              value={formData.principal_amount}
              onChange={handleChange}
              min="500"
              step="100"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Interest Rate (%) *</label>
            <input
              type="number"
              name="interest_rate"
              className="form-input"
              value={formData.interest_rate}
              onChange={handleChange}
              min="0.1"
              max="20"
              step="0.1"
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
            <Calculator size={16} /> Monthly Interest Calculation:
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
            {formatCurrency(monthlyInterest)} / month
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Duration (Months)</label>
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
            <label className="form-label">Disbursement Date</label>
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
          <label className="form-label">Loan Purpose / Remarks</label>
          <input
            type="text"
            name="purpose"
            className="form-input"
            placeholder="e.g. Agricultural equipment, business expansion"
            value={formData.purpose}
            onChange={handleChange}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <HandCoins size={16} />
            {loading ? 'Disbursing...' : 'Disburse Loan'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateLoanModal;
