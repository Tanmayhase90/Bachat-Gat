import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { useLanguage } from '../../context/LanguageContext';

const EditMemberLoginModal = ({ isOpen, onClose, onSuccess, member }) => {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const loginEnabled = Boolean(member?.authUid || member?.userId || member?.firebaseUid);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(member?.email || '');
    setPassword('');
    setError('');
    setSuccess('');
  }, [isOpen, member]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      const result = await memberService.assignMemberLogin(member.member_id || member.id, { email, password });
      setSuccess(`${t('modals.loginEnabled', 'Login enabled.')} ${t('auth.email', 'Member Login ID')}: ${result.email}`);
      setPassword('');
      await onSuccess();
    } catch (err) {
      setError(err.message || t('modals.failedEnableLogin', 'Failed to enable member login.'));
    } finally {
      setLoading(false);
    }
  };

  const isFormActive = !loginEnabled && !success;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('members.editLogin', 'Edit Member Login')}
      maxWidth="500px"
      onSubmit={isFormActive ? handleSubmit : null}
      footer={
        isFormActive ? (
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <KeyRound size={16} /> {loading ? t('modals.enablingLogin', 'Enabling Login...') : t('modals.enableLoginBtn', 'Enable Member Login')}
            </button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.close', 'Close')}
          </button>
        )
      }
    >
      <div>
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-light)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {loginEnabled && !success ? (
          <div style={{ padding: '16px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)' }}>
            <strong>{language === 'mr' ? 'सभासद लॉगिन आधीच सक्षम केले आहे.' : 'Member login is already enabled.'}</strong>
            <div style={{ marginTop: '6px', fontSize: '0.875rem' }}>{t('auth.email', 'Login ID')}: {member.email}</div>
          </div>
        ) : !success && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '18px' }}>
              {language === 'mr'
                ? `${member?.name} साठी ईमेल आणि तात्पुरता पासवर्ड प्रविष्ट करा.`
                : `Add an email and temporary password for ${member?.name}. The member can use these details from the Member Login tab.`}
            </p>
            <div className="form-group">
              <label className="form-label">{t('modals.memberEmail', 'Member Email ID *')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" className="form-input" style={{ paddingLeft: '38px' }} value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus required />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('modals.tempPassword', 'Temporary Password *')}</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="password" className="form-input" style={{ paddingLeft: '38px' }} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditMemberLoginModal;
