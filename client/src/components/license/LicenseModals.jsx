import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { licenseService } from '../../services/licenseService';
import Modal from '../common/Modal';
import {
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  ShieldAlert,
  AlertTriangle,
  X,
} from 'lucide-react';

/**
 * Modal to enter and activate a licence key
 */
export const ActivateLicenseModal = ({ isOpen, onClose, onSuccess, initialMachineId }) => {
  const { t } = useLanguage();
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const machineId = initialMachineId || licenseService.getMachineId();

  const handleCopy = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!key.trim()) {
      setError(t('settings.enterLicenceKey'));
      return;
    }

    try {
      setLoading(true);
      const res = await licenseService.activate(key.trim());
      if (res.success) {
        setKey('');
        if (onSuccess) onSuccess(res);
        if (onClose) onClose();
      } else {
        setError(res.message || 'Licence activation failed.');
      }
    } catch (err) {
      setError(err.message || 'Activation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.activateLicence')}
      maxWidth="500px"
      onSubmit={handleActivate}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <KeyRound size={16} />
            {loading ? t('common.loading') : t('settings.activateLicence')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--danger-light, #FEE2E2)',
              color: 'var(--danger-text, #991B1B)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Machine ID Box */}
        <div>
          <label className="form-label">{t('settings.machineId')}</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <span>{machineId}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
            >
              {copied ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
              {copied ? t('settings.copied') : t('settings.copyMachineId')}
            </button>
          </div>
        </div>

        {/* WhatsApp Admin Contact Button */}
        <div>
          <a
            href={licenseService.getWhatsAppContactUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <MessageCircle size={18} />
            {t('settings.contactAdminWhatsApp')}
          </a>
        </div>

        {/* Licence Key Input */}
        <div className="form-group">
          <label className="form-label">{t('settings.licenceKey')} *</label>
          <textarea
            rows={3}
            className="form-textarea"
            placeholder={t('settings.licenceKeyPlaceholder')}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            required
          />
        </div>
      </div>
    </Modal>
  );
};

/**
 * Unclosable blocking modal displayed when licence has expired
 */
export const LicenseExpiredModal = ({ isOpen, onActivateSuccess }) => {
  const { t } = useLanguage();
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const machineId = licenseService.getMachineId();

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    if (!key.trim()) {
      setError(t('settings.enterLicenceKey'));
      return;
    }

    try {
      setLoading(true);
      const res = await licenseService.activate(key.trim());
      if (res.success) {
        if (onActivateSuccess) onActivateSuccess(res);
      } else {
        setError(res.message || 'Licence activation failed.');
      }
    } catch (err) {
      setError(err.message || 'Activation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg, 16px)',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Header with Danger Icon */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991B1B', marginBottom: '6px' }}>
            {t('settings.licenceExpiredTitle')}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {t('settings.licenceExpiredDesc')}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: '#FEE2E2',
              color: '#991B1B',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Machine ID Box */}
        <div>
          <label className="form-label">{t('settings.machineId')}</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              fontWeight: 700,
            }}
          >
            <span>{machineId}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
            >
              {copied ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
              {copied ? t('settings.copied') : t('settings.copyMachineId')}
            </button>
          </div>
        </div>

        {/* Contact WhatsApp */}
        <a
          href={licenseService.getWhatsAppContactUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            backgroundColor: '#25D366',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          <MessageCircle size={18} />
          {t('settings.contactAdminWhatsApp')}
        </a>

        {/* Key Activation Form */}
        <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">{t('settings.licenceKey')} *</label>
            <textarea
              rows={3}
              className="form-textarea"
              placeholder={t('settings.licenceKeyPlaceholder')}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            <KeyRound size={18} />
            {loading ? t('common.loading') : t('settings.activateLicence')}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * Top warning banner when licence has <= 8 days remaining
 */
export const LicenseExpiryWarningBanner = ({ status, onOpenActivate, onDismiss }) => {
  const { t } = useLanguage();
  if (!status || !status.needsWarning) return null;

  return (
    <div
      style={{
        backgroundColor: '#FEF3C7',
        borderBottom: '1px solid #FCD34D',
        color: '#92400E',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        zIndex: 997,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertTriangle size={18} color="#D97706" />
        <span>
          {t('settings.licenceExpiringNotice').replace('{days}', status.daysRemaining)}{' '}
          <span style={{ fontWeight: 400 }}>({t('settings.expiryDate')}: {status.expiryDate})</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={onOpenActivate}
          style={{
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            padding: '4px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('settings.activateLicence')}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#92400E',
              padding: '2px',
            }}
            title="Dismiss for today"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
