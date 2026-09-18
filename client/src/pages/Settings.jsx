import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { licenseService } from '../services/licenseService';
import { backupService } from '../services/backupService';
import { formatNumber } from '../utils/formatters';
import Loader from '../components/common/Loader';
import { ActivateLicenseModal } from '../components/license/LicenseModals';
import {
  DriveRestoreModal,
  ConfirmRestoreModal,
  GoogleDriveSetupModal,
} from '../components/backup/BackupModals';
import {
  Settings as SettingsIcon,
  Building2,
  User,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  KeyRound,
  Cloud,
  CloudUpload,
  CloudDownload,
  Download,
  Upload,
  Copy,
  Check,
  RotateCcw,
  Sliders,
} from 'lucide-react';

const Settings = () => {
  const { user, refreshUser, updateGroupName, updateMonthlyHaftaDay, updateMonthlyContributionPerShare, isAdmin } = useAuth();
  const { t } = useLanguage();
  const outletContext = useOutletContext();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const triggerRefresh = outletContext?.triggerRefresh;
  const [loading, setLoading] = useState(true);

  const tabFromUrl = searchParams.get('tab') || location.state?.tab;
  const getInitialTab = (tab) => {
    if (tab === 'profile') return 'profile';
    if (tab === 'system' || tab === 'licence' || tab === 'backup') return 'system';
    return 'group';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab(tabFromUrl));

  useEffect(() => {
    const tab = searchParams.get('tab') || location.state?.tab;
    if (tab === 'profile' || tab === 'group' || tab === 'system' || tab === 'licence' || tab === 'backup') {
      setActiveTab(getInitialTab(tab));
    }
  }, [searchParams, location.state]);

  // Group settings state
  const [groupData, setGroupData] = useState({
    group_name: '',
    group_code: '',
    monthly_contribution_per_share: '1000',
    monthly_hafta_day: '10',
    description: '',
  });
  const [totalMembersCount, setTotalMembersCount] = useState(0);

  // Profile settings state
  const [profileData, setProfileData] = useState({
    name: user?.fullName || user?.name || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Licence and Backup state
  const [licenseStatus, setLicenseStatus] = useState(licenseService.getLicenseStatus());
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [isDriveRestoreOpen, setIsDriveRestoreOpen] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [isDriveSetupOpen, setIsDriveSetupOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState(null);
  const [pendingRestoreName, setPendingRestoreName] = useState('');
  const [driveBackups, setDriveBackups] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState('');
  const [driveProfile, setDriveProfile] = useState(backupService.getDriveProfile());
  const driveConnected = Boolean(driveProfile && (driveProfile.email || driveProfile.name));
  const [autoBackup, setAutoBackup] = useState(backupService.getAutoBackupEnabled());
  const [lastBackupTime, setLastBackupTime] = useState(backupService.getLastBackupTime());
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const fileInputRef = useRef(null);

  const refreshLicense = () => {
    setLicenseStatus(licenseService.getLicenseStatus());
  };

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(licenseStatus.machineId);
    setCopiedMachineId(true);
    setTimeout(() => setCopiedMachineId(false), 2000);
  };

  const handleConnectDrive = async () => {
    try {
      setBackupActionLoading('connect-drive');
      setMessage({ type: '', text: '' });
      const profile = await backupService.connectGoogleDrive();
      setDriveProfile(profile);
      setMessage({ type: 'success', text: 'Google Drive connected successfully!' });
    } catch (err) {
      if (err.message && err.message.includes('Google Client ID')) {
        setIsDriveSetupOpen(true);
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to connect Google Drive.' });
      }
    } finally {
      setBackupActionLoading('');
    }
  };

  const handleDisconnectDrive = () => {
    backupService.disconnectGoogleDrive();
    setDriveProfile(null);
    setAutoBackup(false);
    setMessage({ type: 'success', text: 'Google Drive disconnected.' });
  };

  const handleToggleAutoBackup = () => {
    const next = !autoBackup;
    backupService.setAutoBackupEnabled(next);
    setAutoBackup(next);
  };

  const handleGoogleDriveBackup = async () => {
    try {
      setBackupActionLoading('drive-backup');
      setMessage({ type: '', text: '' });
      const res = await backupService.uploadToGoogleDrive();
      setLastBackupTime(res.uploadedAt);
      setMessage({ type: 'success', text: `${t('settings.backupSuccess')} (${res.fileName})` });
    } catch (err) {
      if (err.message && err.message.includes('Google Client ID')) {
        setIsDriveSetupOpen(true);
      } else {
        setMessage({ type: 'error', text: err.message || 'Google Drive backup failed.' });
      }
    } finally {
      setBackupActionLoading('');
    }
  };

  const handleOpenDriveRestore = async () => {
    try {
      setDriveLoading(true);
      setIsDriveRestoreOpen(true);
      const files = await backupService.getGoogleDriveBackups();
      setDriveBackups(files);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load Google Drive backups.' });
      setIsDriveRestoreOpen(false);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleSelectDriveBackup = async (backupItem) => {
    try {
      setDriveLoading(true);
      setIsDriveRestoreOpen(false);
      setBackupActionLoading('downloading-drive-backup');
      await backupService.restoreFromGoogleDrive(backupItem.id);
      await refreshUser();
      if (triggerRefresh) triggerRefresh();
      setMessage({ type: 'success', text: t('settings.restoreSuccess') });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Restore from Google Drive failed.' });
    } finally {
      setDriveLoading(false);
      setBackupActionLoading('');
    }
  };

  const handleDownloadLocalBackup = async () => {
    try {
      setBackupActionLoading('local-backup');
      setMessage({ type: '', text: '' });
      const fileName = await backupService.downloadLocalBackup();
      setMessage({ type: 'success', text: `${t('settings.backupSuccess')} (${fileName})` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Local backup export failed.' });
    } finally {
      setBackupActionLoading('');
    }
  };

  const handleRestoreFromFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleLocalFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBackupActionLoading('reading-file');
      setMessage({ type: '', text: '' });
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.format !== 'bachat_gat_backup') {
        throw new Error('This is not a valid Bachat Gat backup file.');
      }

      setPendingRestoreData(parsed);
      setPendingRestoreName(file.name);
      setIsConfirmRestoreOpen(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Invalid backup file format.' });
    } finally {
      setBackupActionLoading('');
    }
  };

  const handleExecuteRestore = async () => {
    if (!pendingRestoreData) return;
    try {
      setBackupActionLoading('restoring');
      await backupService.restoreBackupData(pendingRestoreData);
      setIsConfirmRestoreOpen(false);
      setPendingRestoreData(null);
      await refreshUser();
      if (triggerRefresh) triggerRefresh();
      setMessage({ type: 'success', text: t('settings.restoreSuccess') });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Restore failed.' });
    } finally {
      setBackupActionLoading('');
    }
  };

  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({
        ...prev,
        name: user.fullName || user.name || '',
        phone: user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        setLoading(true);
        const res = await groupService.getGroupDetails();
        if (res.success) {
          const membersCount = Number(res.group.totalMembers ?? res.group.total_members ?? 0);
          setTotalMembersCount(membersCount);
          setGroupData({
            group_name: res.group.group_name || '',
            group_code: res.group.group_code || '',
            monthly_contribution_per_share: res.group.monthly_contribution_per_share?.toString() || '1000',
            monthly_hafta_day: (res.group.monthly_hafta_day ?? res.group.monthlyHaftaDay ?? 10).toString(),
            description: res.group.description || '',
          });
        }
      } catch (err) {
        console.error('Failed to load group details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, []);

  // Canonical auto-derived Monthly Target = TOTAL MEMBER COUNT × MONTHLY CONTRIBUTION PER SHARE
  const calculatedMonthlyTarget = (Number(totalMembersCount) || 0) * (parseFloat(groupData.monthly_contribution_per_share) || 0);

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const parsedDueDay = parseInt(groupData.monthly_hafta_day, 10);
      const safeDueDay = (!isNaN(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31) ? parsedDueDay : 10;

      const res = await groupService.updateGroupDetails({
        group_name: groupData.group_name,
        monthly_contribution_per_share: parseFloat(groupData.monthly_contribution_per_share),
        monthly_hafta_day: safeDueDay,
        monthlyHaftaDay: safeDueDay,
        monthly_target: calculatedMonthlyTarget,
        monthlyTarget: calculatedMonthlyTarget,
        description: groupData.description,
      });

      if (res.success) {
        if (res.group && res.group.group_name) {
          updateGroupName(res.group.group_name);
        }
        if (updateMonthlyHaftaDay) {
          updateMonthlyHaftaDay(safeDueDay);
        }
        if (updateMonthlyContributionPerShare) {
          updateMonthlyContributionPerShare(parseFloat(groupData.monthly_contribution_per_share));
        }
        await refreshUser();
        if (triggerRefresh) triggerRefresh();
        setMessage({ type: 'success', text: 'Group settings updated successfully!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update group settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const payload = {
        name: profileData.name,
        phone: profileData.phone,
      };
      if (profileData.newPassword) {
        payload.currentPassword = profileData.currentPassword;
        payload.newPassword = profileData.newPassword;
      }

      const res = await authService.updateProfile(payload);
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Profile updated successfully!' });
        setProfileData((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
        await refreshUser();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text={t('common.loadingData')} />;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('settings.title')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {t('settings.subtitle')}
        </p>
      </div>

      {message.text && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: message.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        {isAdmin && (
          <button
            onClick={() => {
              setActiveTab('group');
              setMessage({ type: '', text: '' });
            }}
            className={`tab-btn ${activeTab === 'group' ? 'active' : ''}`}
          >
            <Building2 size={18} /> {t('settings.generalTab')}
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('profile');
            setMessage({ type: '', text: '' });
          }}
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        >
          <User size={18} /> {t('members.personalInfo')}
        </button>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveTab('system');
              setMessage({ type: '', text: '' });
            }}
            className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          >
            <ShieldCheck size={18} /> {t('settings.systemTab', 'Backup')}
          </button>
        )}
      </div>

      {/* TAB 1: GROUP CONFIGURATION */}
      {activeTab === 'group' && isAdmin && (
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '18px' }}>{t('settings.groupNameLabel')}</h2>
          <form onSubmit={handleGroupSubmit}>
            <div className="form-group">
              <label className="form-label">{t('settings.groupNameLabel')} *</label>
              <input
                type="text"
                className="form-input"
                value={groupData.group_name}
                onChange={(e) => setGroupData({ ...groupData, group_name: e.target.value })}
                required
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{t('settings.monthlyHaftaAmount')} *</label>
                <input
                  type="number"
                  className="form-input"
                  value={groupData.monthly_contribution_per_share}
                  onChange={(e) => setGroupData({ ...groupData, monthly_contribution_per_share: e.target.value })}
                  min="1"
                  step="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('settings.monthlyHaftaDueDateLabel', 'Monthly Hafta Due Date (1 - 28)')} *</label>
                <input
                  type="number"
                  className="form-input"
                  value={groupData.monthly_hafta_day}
                  onChange={(e) => setGroupData({ ...groupData, monthly_hafta_day: e.target.value })}
                  min="1"
                  max="28"
                  step="1"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('dashboard.monthlyTarget')} (₹)</label>
              <input
                type="text"
                className="form-input"
                value={formatNumber(calculatedMonthlyTarget)}
                readOnly
                disabled
                tabIndex={-1}
                style={{
                  backgroundColor: 'var(--bg-card-hover, #F8FAFC)',
                  cursor: 'not-allowed',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.notes')}</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={groupData.description}
                onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={16} />
                {saving ? t('common.loading') : t('settings.saveChangesBtn')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '18px' }}>{t('members.personalInfo')}</h2>
          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label">{t('modals.fullName')}</label>
              <input
                type="text"
                className="form-input"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('modals.email')}</label>
              <input
                type="email"
                className="form-input"
                value={user?.email || ''}
                disabled
                style={{ background: '#F1F5F9', color: 'var(--text-muted)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('modals.phoneNumber')}</label>
              <input
                type="tel"
                className="form-input"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('members.tableRole')}</label>
              <input
                type="text"
                className="form-input"
                value={t(`common.roles.${(user?.role_name || user?.role || 'MEMBER').toUpperCase()}`, user?.role_name || user?.role || 'MEMBER')}
                disabled
                style={{ background: '#F1F5F9', fontWeight: 700, color: 'var(--primary)' }}
              />
            </div>

            <div style={{ margin: '20px 0 14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={16} /> {t('auth.password')}
              </h3>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">{t('auth.password')}</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter current password"
                    value={profileData.currentPassword}
                    onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('auth.password')}</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter new password"
                    value={profileData.newPassword}
                    onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={16} />
                {saving ? t('common.loading') : t('common.saveChanges')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: BACKUP & RESTORE */}
      {activeTab === 'system' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. LICENCE CARD (Hidden from UI; functionality preserved) */}
          {false && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#F3E8FF',
                      color: '#9333EA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                      {t('settings.licence', 'LICENCE')}
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Bachat Gat Digital Savings License Management
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    backgroundColor: licenseStatus.isExpired
                      ? '#FEE2E2'
                      : licenseStatus.needsWarning
                      ? '#FEF3C7'
                      : '#DCFCE7',
                    color: licenseStatus.isExpired
                      ? '#991B1B'
                      : licenseStatus.needsWarning
                      ? '#92400E'
                      : '#166534',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: licenseStatus.isExpired
                        ? '#DC2626'
                        : licenseStatus.needsWarning
                        ? '#D97706'
                        : '#16A34A',
                    }}
                  />
                  {licenseStatus.isExpired
                    ? t('settings.expired')
                    : licenseStatus.needsWarning
                    ? t('settings.expiringSoon')
                    : t('settings.active')}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {t('settings.expiryDate')}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {licenseStatus.expiryDate}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {t('settings.daysRemaining')}
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '1rem',
                      color: licenseStatus.isExpired
                        ? '#DC2626'
                        : licenseStatus.needsWarning
                        ? '#D97706'
                        : 'var(--primary)',
                    }}
                  >
                    {licenseStatus.daysRemaining} {t('settings.days', 'days')}
                  </div>
                </div>
              </div>

              {/* Machine ID */}
              <div style={{ marginBottom: '18px' }}>
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
                  <span>{licenseStatus.machineId}</span>
                  <button
                    type="button"
                    onClick={handleCopyMachineId}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                  >
                    {copiedMachineId ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                    {copiedMachineId ? t('settings.copied') : t('settings.copyMachineId')}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIsActivateOpen(true)}
                >
                  <KeyRound size={16} />
                  {t('settings.activateLicence')}
                </button>
              </div>
            </div>
          )}

          {/* 2. BACKUP & RESTORE CARD */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  <Cloud size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    {t('settings.backupAndRestore', 'BACKUP & RESTORE')}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Google Drive cloud synchronization and local JSON export/import
                  </span>
                </div>
              </div>
            </div>

            {/* Google Drive Status Box */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: '#F8FAFC',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('settings.googleDrive')}</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: driveConnected ? '#166534' : '#64748B',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: driveConnected ? '#16A34A' : '#94A3B8',
                        }}
                      />
                      {driveConnected ? t('settings.connected') : t('settings.notConnected')}
                    </span>
                  </div>

                  {driveProfile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      {driveProfile.picture ? (
                        <img
                          src={driveProfile.picture}
                          alt="Google Profile"
                          style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {driveProfile.name ? driveProfile.name[0] : 'G'}
                        </div>
                      )}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {driveProfile.name || driveProfile.email} {driveProfile.email ? `(${driveProfile.email})` : ''}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Connect your Google Drive account to backup and restore anytime.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {driveConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={handleConnectDrive}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        disabled={!!backupActionLoading}
                      >
                        {t('settings.switchAccount')}
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectDrive}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#DC2626' }}
                      >
                        {t('settings.disconnectDrive')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      disabled={backupActionLoading === 'connect-drive'}
                    >
                      <Cloud size={14} />
                      {backupActionLoading === 'connect-drive' ? t('common.loading') : t('settings.connectDrive')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsDriveSetupOpen(true)}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    title="Configure Google OAuth Client ID"
                  >
                    <Sliders size={14} />
                  </button>
                </div>
              </div>

              {/* Last backup info */}
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  {t('settings.lastBackup')}:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {lastBackupTime ? new Date(lastBackupTime).toLocaleString() : t('settings.never')}
                  </strong>
                </span>

                {/* 2-Day Auto Backup Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoBackup}
                    onChange={handleToggleAutoBackup}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600 }}>{t('settings.autoBackup')}</span>
                </label>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={handleGoogleDriveBackup}
                disabled={!driveConnected || !!backupActionLoading}
                style={{ padding: '10px 14px', justifyContent: 'center' }}
              >
                <CloudUpload size={16} />
                {backupActionLoading === 'drive-backup' ? t('settings.uploadingBackup') : t('settings.backupNow')}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleOpenDriveRestore}
                disabled={!driveConnected || !!backupActionLoading}
                style={{ padding: '10px 14px', justifyContent: 'center' }}
              >
                <CloudDownload size={16} />
                {driveLoading ? t('common.loading') : t('settings.restore')}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadLocalBackup}
                disabled={!!backupActionLoading}
                style={{ padding: '10px 14px', justifyContent: 'center' }}
              >
                <Download size={16} />
                {backupActionLoading === 'local-backup' ? t('common.loading') : t('settings.localBackup')}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleRestoreFromFileClick}
                disabled={!!backupActionLoading}
                style={{ padding: '10px 14px', justifyContent: 'center' }}
              >
                <Upload size={16} />
                {t('settings.restoreFromFile')}
              </button>
            </div>

            {/* Hidden local JSON file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLocalFileChange}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <ActivateLicenseModal
        isOpen={isActivateOpen}
        onClose={() => setIsActivateOpen(false)}
        onSuccess={() => {
          refreshLicense();
          setMessage({ type: 'success', text: 'Licence activated successfully!' });
        }}
        initialMachineId={licenseStatus.machineId}
      />

      <DriveRestoreModal
        isOpen={isDriveRestoreOpen}
        onClose={() => setIsDriveRestoreOpen(false)}
        backups={driveBackups}
        onSelectBackup={handleSelectDriveBackup}
        loading={driveLoading}
      />

      <ConfirmRestoreModal
        isOpen={isConfirmRestoreOpen}
        onClose={() => {
          setIsConfirmRestoreOpen(false);
          setPendingRestoreData(null);
        }}
        onConfirm={handleExecuteRestore}
        backupName={pendingRestoreName}
        loading={backupActionLoading === 'restoring'}
      />

      <GoogleDriveSetupModal
        isOpen={isDriveSetupOpen}
        onClose={() => setIsDriveSetupOpen(false)}
        currentClientId={backupService.getGoogleClientId()}
        onSave={(cid) => {
          backupService.setGoogleClientId(cid);
          setMessage({ type: 'success', text: 'Google OAuth Client ID saved.' });
        }}
      />
    </div>
  );
};

export default Settings;
