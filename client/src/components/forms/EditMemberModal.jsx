import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { groupService } from '../../services/groupService';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import {
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  Layers,
  Coins,
  Shield,
  Activity,
  Save,
  Loader2,
  Calendar,
  Lock,
} from 'lucide-react';

const EditMemberModal = ({ isOpen, onClose, onSuccess, member }) => {
  const { t, language } = useLanguage();

  const [groupRate, setGroupRate] = useState(1000);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    shares: '1',
    perShare: '1000',
    monthlyContribution: '1000',
    role: 'MEMBER',
    status: 'ACTIVE',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pre-fill form with member data and live group settings whenever modal opens
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !member) return;

    const loadData = async () => {
      let liveGroupRate = 1000;
      try {
        const groupRes = await groupService.getGroupDetails();
        if (groupRes?.success && groupRes?.group) {
          liveGroupRate = Number(
            groupRes.group.monthly_contribution_per_share ??
            groupRes.group.monthlyContributionPerShare ??
            groupRes.group.monthlyContribution ??
            groupRes.group.monthly_contribution ??
            groupRes.group.monthlyShare ??
            1000
          ) || 1000;
        }
      } catch (e) {
        console.warn('Error fetching group details in EditMemberModal:', e);
      }

      if (!isMounted) return;
      setGroupRate(liveGroupRate);

      const existingShares = Number(member.shares || member.shareCount || 1);
      const calculatedMonthly = existingShares * liveGroupRate;

      const statusName = (member.status || (member.is_active !== false && member.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase();

      const rawPhone = member?.phone ?? member?.phoneNumber ?? member?.phone_number ?? '';
      const cleanPhone = (typeof rawPhone === 'string' || typeof rawPhone === 'number')
        ? String(rawPhone).trim().replace(/\D/g, '').slice(0, 10)
        : '';

      setFormData({
        name: member.name || member.fullName || member.full_name || '',
        phone: cleanPhone,
        shares: String(existingShares),
        perShare: String(liveGroupRate),
        monthlyContribution: String(calculatedMonthly),
        role: 'MEMBER',
        status: statusName,
      });

      setError('');
      setSuccess('');
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, member]);

  // Recalculate monthly contribution when shares count changes using groupRate as single source of truth
  const handleSharesChange = (e) => {
    const val = e.target.value;
    const numShares = Math.max(1, parseInt(val, 10) || 1);
    setFormData((prev) => ({
      ...prev,
      shares: val,
      perShare: String(groupRate),
      monthlyContribution: String(numShares * groupRate),
    }));
    setError('');
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!member) return;

    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim();
    const numShares = Math.max(1, parseInt(formData.shares, 10) || 1);
    const numMonthlyContribution = numShares * groupRate;

    // Validation
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

    try {
      setLoading(true);
      setError('');

      const memberId = member.member_id || member.id;
      const existingRole = (member.role || 'member').toLowerCase();
      const existingRoleName = (member.role_name || member.roleName || member.role || 'MEMBER').toUpperCase();

      const updatePayload = {
        name: cleanName,
        fullName: cleanName,
        full_name: cleanName,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        phone_number: cleanPhone,
        shares: numShares,
        shareCount: numShares,
        monthlyContribution: numMonthlyContribution,
        monthly_contribution: numMonthlyContribution,
        monthlyContributionPerShare: groupRate,
        monthly_contribution_per_share: groupRate,
        monthlyHaftaAmount: numMonthlyContribution,
        monthlyShare: numMonthlyContribution,
        monthly_share: numMonthlyContribution,
        role: existingRole,
        role_name: existingRoleName,
        roleName: existingRoleName,
        status: formData.status.toUpperCase(),
        status_lower: formData.status.toLowerCase(),
        isActive: formData.status === 'ACTIVE',
        is_active: formData.status === 'ACTIVE',
      };

      const res = await memberService.updateMember(memberId, updatePayload);

      if (res.success) {
        setSuccess(t('modals.memberUpdatedSuccess', 'Member profile updated successfully!'));
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Failed to update member:', err);
      setError(err.response?.data?.message || err.message || t('modals.failedUpdateMember', 'Failed to update member profile.'));
    } finally {
      setLoading(false);
    }
  };

  const memberCode = member?.member_code || member?.memberCode || member?.id || '—';
  const joinDate = member?.joined_date || member?.joinDate || member?.joinedAt;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('members.editMember', 'Edit Member')}
      maxWidth="520px"
      dialogStyle={{ maxHeight: 'min(calc(100dvh - 130px), calc(100vh - 130px), 68vh)' }}
      onSubmit={handleSubmit}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ padding: '9px 18px', fontSize: '0.875rem' }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              padding: '9px 22px',
              fontSize: '0.875rem',
              fontWeight: 700,
              boxShadow: 'var(--shadow-pink)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('common.saving', 'Saving...')}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{t('common.saveChanges', 'Save Changes')}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
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

        {/* Member Header Badge / Metadata */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--bg-subtle, #F8FAFC)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color, #E2E8F0)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{memberCode}</span>
            <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>({member?.member_id || member?.id})</span>
          </div>
          {joinDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} color="var(--text-muted)" />
              <span>Joined {formatDate(joinDate, { month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </div>

        {/* 1. Full Name */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={15} color="var(--primary)" /> {t('modals.fullName', 'Full Name *')}
          </label>
          <input
            type="text"
            name="name"
            className="form-input"
            value={formData.name}
            onChange={handleChange}
            placeholder={language === 'mr' ? 'उदा. राहुल प्रकाश पाटील' : 'e.g. Rahul Prakash Patil'}
            required
            data-autofocus
          />
        </div>

        {/* 2. Mobile Number */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone size={15} color="var(--primary)" /> {t('modals.phone', 'Mobile Number')}
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
              }}
            >
              +91
            </span>
            <input
              type="tel"
              name="phone"
              className="form-input"
              style={{ paddingLeft: '48px' }}
              value={formData.phone}
              onChange={handlePhoneChange}
              maxLength={10}
            />
          </div>
        </div>

        {/* 3. Shares & Contribution Amount Grid */}
        <div className="form-grid-2" style={{ gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="var(--primary)" /> {t('modals.sharesCount', 'Number of Shares *')}
            </label>
            <input
              type="number"
              name="shares"
              className="form-input"
              value={formData.shares}
              onChange={handleSharesChange}
              min="1"
              max="50"
              required
            />
            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              1 {t('common.share', 'Share')} = {formatCurrency(groupRate)}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                <Coins size={15} color="var(--primary)" /> {t('modals.monthlyHafta', 'Monthly Hafta (₹) *')}
              </label>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-subtle, #F1F5F9)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #E2E8F0)',
                }}
                title="Controlled by Group Settings"
              >
                <Lock size={11} color="var(--primary)" />
                {t('modals.groupSettingRate', 'Group Setting')}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                name="monthlyContribution"
                className="form-input"
                value={formatCurrency(Number(formData.monthlyContribution) || ((parseInt(formData.shares, 10) || 1) * groupRate))}
                readOnly
                disabled
                tabIndex={-1}
                style={{
                  background: 'var(--bg-subtle, #F8FAFC)',
                  color: 'var(--text-primary, #1E293B)',
                  cursor: 'not-allowed',
                  fontWeight: 700,
                  borderColor: 'var(--border-color, #CBD5E1)',
                  userSelect: 'none',
                }}
              />
            </div>
            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>
                {formData.shares || 1} {Number(formData.shares) === 1 ? t('common.share', 'Share') : t('common.shares', 'Shares')} × {formatCurrency(groupRate)} = {formatCurrency(Number(formData.monthlyContribution) || ((parseInt(formData.shares, 10) || 1) * groupRate))}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Role & Status Grid */}
        <div className="form-grid-2" style={{ gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={15} color="var(--primary)" /> {t('members.tableRole', 'Role')}
            </label>
            <input
              type="text"
              name="role"
              className="form-input"
              value={t('common.roles.MEMBER', 'Member')}
              readOnly
              disabled
              tabIndex={-1}
              style={{
                background: 'var(--bg-subtle, #F8FAFC)',
                color: 'var(--text-primary, #1E293B)',
                cursor: 'not-allowed',
                fontWeight: 600,
                borderColor: 'var(--border-color, #CBD5E1)',
                userSelect: 'none',
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={15} color="var(--primary)" /> {t('members.tableStatus', 'Status')}
            </label>
            <select
              name="status"
              className="form-select"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="ACTIVE">{t('common.active', 'Active')}</option>
              <option value="INACTIVE">{t('common.inactive', 'Inactive')}</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EditMemberModal;
