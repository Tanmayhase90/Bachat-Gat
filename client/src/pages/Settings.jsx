import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/dashboardService';
import { authService } from '../services/authService';
import Loader from '../components/common/Loader';
import {
  Settings as SettingsIcon,
  Building2,
  User,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';

const Settings = () => {
  const { user, refreshUser, updateGroupName, isAdmin } = useAuth();
  const outletContext = useOutletContext();
  const triggerRefresh = outletContext?.triggerRefresh;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('group'); // 'group' | 'profile'

  // Group settings state
  const [groupData, setGroupData] = useState({
    group_name: '',
    group_code: '',
    monthly_contribution_per_share: '1000',
    monthly_target: '363000',
    description: '',
  });

  // Profile settings state
  const [profileData, setProfileData] = useState({
    name: user?.fullName || user?.name || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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
          setGroupData({
            group_name: res.group.group_name || '',
            group_code: res.group.group_code || '',
            monthly_contribution_per_share: res.group.monthly_contribution_per_share?.toString() || '1000',
            monthly_target: res.group.monthly_target?.toString() || '0',
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

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const res = await groupService.updateGroupDetails({
        group_name: groupData.group_name,
        monthly_contribution_per_share: parseFloat(groupData.monthly_contribution_per_share),
        monthly_target: parseFloat(groupData.monthly_target),
        description: groupData.description,
      });

      if (res.success) {
        if (res.group && res.group.group_name) {
          updateGroupName(res.group.group_name);
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

  if (loading) return <Loader text="Loading system settings..." />;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Settings & Configurations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Configure Bachat Gat parameters, monthly contribution rules, and admin profile
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
            <Building2 size={18} /> Group Configuration
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('profile');
            setMessage({ type: '', text: '' });
          }}
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        >
          <User size={18} /> Account Profile
        </button>
      </div>

      {/* TAB 1: GROUP CONFIGURATION */}
      {activeTab === 'group' && isAdmin && (
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '18px' }}>Bachat Gat Parameters</h2>
          <form onSubmit={handleGroupSubmit}>
            <div className="form-group">
              <label className="form-label">Group Name *</label>
              <input
                type="text"
                className="form-input"
                value={groupData.group_name}
                onChange={(e) => setGroupData({ ...groupData, group_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Group Code (Unique Identifier)</label>
              <input
                type="text"
                className="form-input"
                value={groupData.group_code}
                disabled
                style={{ background: '#F1F5F9', color: 'var(--text-muted)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Group code cannot be altered.</span>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Monthly Share Contribution (₹) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={groupData.monthly_contribution_per_share}
                  onChange={(e) => setGroupData({ ...groupData, monthly_contribution_per_share: e.target.value })}
                  min="100"
                  step="50"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Monthly Group Target (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={groupData.monthly_target}
                  onChange={(e) => setGroupData({ ...groupData, monthly_target: e.target.value })}
                  min="0"
                  step="1000"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Group Description</label>
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
                {saving ? 'Saving Changes...' : 'Save Group Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '18px' }}>Admin Profile & Security</h2>
          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={user?.email || ''}
                disabled
                style={{ background: '#F1F5F9', color: 'var(--text-muted)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Role</label>
              <input
                type="text"
                className="form-input"
                value={user?.role_name || user?.role || 'MEMBER'}
                disabled
                style={{ background: '#F1F5F9', fontWeight: 700, color: 'var(--primary)' }}
              />
            </div>

            <div style={{ margin: '20px 0 14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={16} /> Change Password (Optional)
              </h3>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter current password"
                    value={profileData.currentPassword}
                    onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
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
                {saving ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;
