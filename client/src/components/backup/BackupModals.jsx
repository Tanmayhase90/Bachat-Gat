import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Modal from '../common/Modal';
import {
  CloudDownload,
  AlertTriangle,
  RotateCcw,
  FileJson,
  CheckCircle2,
  Calendar,
  Settings as SettingsIcon,
} from 'lucide-react';

/**
 * Modal to view and select available Google Drive backups
 */
export const DriveRestoreModal = ({ isOpen, onClose, backups = [], onSelectBackup, loading }) => {
  const { t } = useLanguage();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.restoreFromDrive')}
      maxWidth="600px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>{t('common.loading')}</p>
          </div>
        ) : backups.length === 0 ? (
          <div
            style={{
              padding: '30px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-color)',
            }}
          >
            <FileJson size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('settings.noBackupsFound')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
            {backups.map((b) => {
              const dateStr = b.modifiedTime ? new Date(b.modifiedTime).toLocaleString() : '';
              const sizeKb = b.size ? `${(parseInt(b.size, 10) / 1024).toFixed(1)} KB` : '';

              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FFFFFF',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileJson size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {b.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px' }}>
                        {dateStr && <span>{dateStr}</span>}
                        {sizeKb && <span>• {sizeKb}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    onClick={() => onSelectBackup(b)}
                  >
                    <RotateCcw size={14} />
                    {t('settings.selectBackup', 'Select')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

/**
 * Confirmation dialog before destructive overwrite
 */
export const ConfirmRestoreModal = ({
  isOpen,
  onClose,
  onConfirm,
  backupName = '',
  loading = false,
  error = '',
}) => {
  const { t } = useLanguage();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.restoreConfirmTitle')}
      maxWidth="500px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-danger"
            style={{ backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-md)' }}
            onClick={onConfirm}
            disabled={loading}
          >
            <RotateCcw size={16} />
            {loading ? t('settings.restoringBackup') : t('settings.restore')}
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
              background: '#FEE2E2',
              color: '#991B1B',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: '50%',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {t('settings.restoreConfirmDesc')}
            </p>
            {backupName && (
              <div
                style={{
                  margin: '8px 0',
                  padding: '8px 12px',
                  backgroundColor: '#F1F5F9',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {backupName}
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: '#DC2626', marginTop: '6px' }}>
              {t('settings.restoreWarning')}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/**
 * Google Drive Client ID configuration dialog
 */
export const GoogleDriveSetupModal = ({ isOpen, onClose, onSave, currentClientId = '' }) => {
  const { t } = useLanguage();
  const [clientId, setClientId] = useState(currentClientId);

  const handleSave = (e) => {
    e.preventDefault();
    onSave(clientId.trim());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Drive Setup (OAuth Client ID)"
      maxWidth="540px"
      onSubmit={handleSave}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          To connect Google Drive from this browser, configure your Google OAuth 2.0 Web Client ID:
        </p>

        <div className="form-group">
          <label className="form-label">Google OAuth Client ID</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 1038306626235-xxxxxxxxxxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          />
        </div>

        <div
          style={{
            padding: '12px',
            backgroundColor: '#F8FAFC',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Google Cloud Console Setup:</strong>
          <ol style={{ paddingLeft: '18px', marginTop: '6px' }}>
            <li>Create an OAuth 2.0 Client ID for <em>Web application</em>.</li>
            <li>Add your authorized origin: <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</code></li>
            <li>Enable the <strong>Google Drive API</strong> in APIs & Services.</li>
            <li>Add scope: <code>https://www.googleapis.com/auth/drive.file</code>.</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
};
