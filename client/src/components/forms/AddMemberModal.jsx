import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { groupService } from '../../services/groupService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import {
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  Layers,
  Coins,
  Calculator,
  Loader2,
} from 'lucide-react';

const AddMemberModal = ({ isOpen, onClose, onSuccess }) => {
  const { t, language } = useLanguage();
  const { monthlyContributionPerShare } = useAuth();
  const currentPerShare = (monthlyContributionPerShare || 1000).toString();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    shares: '1',
    perShare: currentPerShare,
    member_code: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-fetch next member code and latest group contribution per share on modal open
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError('');
    setSuccess('');

    Promise.all([
      memberService.getNextMemberCode().catch(() => null),
      groupService.getGroupDetails().catch(() => null),
    ]).then(([codeResult, groupResult]) => {
      if (!active) return;
      const latestCode = codeResult?.memberCode || '';
      const latestPerShare = groupResult?.group?.monthly_contribution_per_share ??
        groupResult?.group?.monthlyContributionPerShare ??
        groupResult?.group?.monthlyContribution ??
        monthlyContributionPerShare ??
        1000;

      setFormData((prev) => ({
        ...prev,
        ...(latestCode ? { member_code: latestCode } : {}),
        perShare: latestPerShare.toString(),
      }));
    });

    return () => {
      active = false;
    };
  }, [isOpen, monthlyContributionPerShare]);

  // Dynamically calculate monthly contribution = shares * perShare
  const numShares = Math.max(1, parseInt(formData.shares, 10) || 1);
  const numPerShare = Math.max(0, parseFloat(formData.perShare) || 0);
  const calculatedMonthlyContribution = numShares * numPerShare;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handlePhoneChange = (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: rawDigits }));
    setError('');
  };

  const handleReset = useCallback(() => {
    const resetPerShare = (monthlyContributionPerShare || 1000).toString();
    setFormData({
      name: '',
      phone: '',
      shares: '1',
      perShare: resetPerShare,
      member_code: '',
    });
    setError('');
    setSuccess('');
  }, [monthlyContributionPerShare]);

  const handleCancel = useCallback(() => {
    handleReset();
    onClose?.();
  }, [handleReset, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim();

    // 1. Validation
    if (!cleanName || cleanName.length < 2) {
      setError(t('modals.enterValidName', 'Please enter a valid member Full Name.'));
      return;
    }

    if (cleanPhone && cleanPhone.length < 10) {
      setError(t('modals.enterValidPhone', 'Please enter a valid 10-digit mobile phone number.'));
      return;
    }

    if (numShares < 1) {
      setError(t('modals.sharesCountMin', 'Shares count must be at least 1.'));
      return;
    }

    if (numPerShare <= 0) {
      setError(t('modals.perShareMin', 'Per Share amount must be greater than ₹0.'));
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Auto-generate standard credentials for the member
      const cleanDigits = cleanPhone.replace(/\D/g, '');
      const codeSuffix = (formData.member_code || '').replace(/\D/g, '') || Date.now().toString().slice(-4);
      const emailPrefix = cleanDigits || (formData.member_code ? formData.member_code.toLowerCase().replace(/[^a-z0-9]/g, '') : `mem_${Date.now()}`);
      const standardEmail = `${emailPrefix}_${codeSuffix}@bachatgat.local`;
      const standardPassword = `Pass@${cleanDigits ? cleanDigits.slice(-4) : (codeSuffix.padStart(4, '0').slice(-4) || '1234')}`;

      // Call existing member creation service without changing backend/schema
      const res = await memberService.createMember({
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        email: standardEmail,
        password: standardPassword,
        shares: numShares,
        shareCount: numShares,
        monthlyContribution: calculatedMonthlyContribution,
        monthly_contribution: calculatedMonthlyContribution,
        monthlyContributionPerShare: numPerShare,
        role_name: 'MEMBER',
        joined_date: new Date().toISOString().split('T')[0],
      });

      if (res.success) {
        setSuccess(t('modals.memberCreatedSuccess', `Member ${res.member?.member_code || formData.member_code || ''} successfully recorded!`));
        setTimeout(() => {
          handleReset();
          if (onSuccess) onSuccess();
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to add member:', err);
      setError(err.response?.data?.message || err.message || t('modals.failedAddMember', 'Failed to record member.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={t('members.addMemberBtn', 'Add Member')}
      maxWidth="500px"
      onSubmit={handleSubmit}
      footer={
        <>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn-secondary"
            style={{
              padding: '10px 22px',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '10px 26px',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-full)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-pink)',
              minWidth: '110px',
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin-animation" />
                <span>{t('common.saving', 'Saving...')}</span>
              </>
            ) : (
              <span>{t('common.record', 'Record')}</span>
            )}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Error Notification */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--danger-light)',
              color: 'var(--danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {success && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--success-light)',
              color: 'var(--success-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Full Name */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={15} color="var(--primary)" /> {t('modals.fullName', 'Full Name *')}
          </label>
          <input
            type="text"
            name="name"
            className="form-input"
            placeholder={t('modals.namePlaceholder', 'Enter member full name')}
            value={formData.name}
            onChange={handleChange}
            disabled={loading}
            data-autofocus
            required
          />
        </div>

        {/* 2. Phone Number */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone size={15} color="var(--primary)" /> {t('modals.phoneLabel', 'Phone Number')}
          </label>
          <input
            type="tel"
            name="phone"
            className="form-input"
            placeholder={t('modals.phonePlaceholder', '10-digit mobile number')}
            value={formData.phone}
            onChange={handlePhoneChange}
            disabled={loading}
            maxLength={10}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            {t('modals.phoneHint', 'Enter 10 digit Indian mobile number (e.g. 9822012345)')}
          </span>
        </div>

        {/* 3 & 4. Shares Count and Per Share Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Shares Count */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="var(--primary)" /> {t('modals.sharesCount', 'Shares Count *')}
            </label>
            <input
              type="number"
              name="shares"
              className="form-input"
              min="1"
              max="20"
              value={formData.shares}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          {/* Per Share (₹) */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Coins size={15} color="var(--primary)" /> {t('modals.perShare', 'Per Share (₹) *')}
            </label>
            <input
              type="number"
              name="perShare"
              className="form-input"
              min="1"
              step="1"
              value={formData.perShare}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>
        </div>

        {/* 5. Dynamic Calculated Monthly Contribution Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FFF5F8 0%, #FDF2F8 100%)',
            border: '1px solid rgba(194, 24, 91, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              }}
            >
              <Calculator size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('modals.monthlyContribution', 'Monthly Contribution')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {numShares} {numShares === 1 ? (language === 'mr' ? 'हिस्सा' : 'Share') : (language === 'mr' ? 'हिस्से' : 'Shares')} × {formatCurrency(numPerShare)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
            {formatCurrency(calculatedMonthlyContribution)}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddMemberModal;
