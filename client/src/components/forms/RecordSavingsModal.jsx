import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { savingsService } from '../../services/savingsService';
import { formatCurrency } from '../../utils/formatters';
import { CheckCircle2, AlertCircle, PiggyBank } from 'lucide-react';

const RecordSavingsModal = ({ isOpen, onClose, onSuccess, initialMemberId = null }) => {
  const currentDate = new Date();
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    member_id: initialMemberId || '',
    amount: '1000',
    month: (currentDate.getMonth() + 1).toString(),
    year: currentDate.getFullYear().toString(),
    payment_date: currentDate.toISOString().split('T')[0],
    payment_mode: 'UPI',
    remarks: '',
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
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'member_id') {
        const selected = members.find((m) => String(m.member_id) === String(value) || String(m.id) === String(value));
        if (selected) {
          updated.amount = selected.monthly_contribution.toString();
        }
      }
      return updated;
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.member_id || !formData.amount || !formData.month || !formData.year) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await savingsService.recordSavings({
        ...formData,
        amount: parseFloat(formData.amount),
        month: parseInt(formData.month, 10),
        year: parseInt(formData.year, 10),
      });

      if (res.success) {
        setSuccess('Monthly savings recorded successfully!');
        setTimeout(() => {
          setSuccess('');
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record savings.');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Record Monthly Savings" maxWidth="520px">
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
          <label className="form-label">Select Member *</label>
          <select name="member_id" className="form-select" value={formData.member_id} onChange={handleChange} required>
            <option value="">-- Choose Member --</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.name} ({m.member_code}) - Share: {formatCurrency(m.monthly_contribution || m.monthlyContribution)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Month *</label>
            <select name="month" className="form-select" value={formData.month} onChange={handleChange} required>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Contribution Amount (₹) *</label>
            <input
              type="number"
              name="amount"
              className="form-input"
              value={formData.amount}
              onChange={handleChange}
              min="1"
              step="50"
              required
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
          <label className="form-label">Remarks / Note</label>
          <input
            type="text"
            name="remarks"
            className="form-input"
            placeholder="e.g. Paid via Google Pay"
            value={formData.remarks}
            onChange={handleChange}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <PiggyBank size={16} />
            {loading ? 'Recording...' : 'Record Savings'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordSavingsModal;
