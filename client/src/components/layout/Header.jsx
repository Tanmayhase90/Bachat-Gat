import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationDropdown from '../common/NotificationDropdown';
import GroupInfoModal from '../common/GroupInfoModal';
import {
  Menu,
  Building2,
  PiggyBank,
  HandCoins,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from 'lucide-react';

const Header = ({ onOpenMobileSidebar, onOpenRecordSavings, onOpenCreateLoan }) => {
  const { user, logout, roleName, canManageSavings, canManageLoans, canManageGroup } = useAuth();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigateProfile = () => {
    setIsProfileOpen(false);
    if (user?.memberId) {
      navigate(`/members/${user.memberId}`);
    } else {
      navigate('/settings');
    }
  };

  const handleNavigateSettings = () => {
    setIsProfileOpen(false);
    navigate('/settings');
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'badge-pink';
      case 'TREASURER':
        return 'badge-warning';
      case 'SECRETARY':
        return 'badge-info';
      default:
        return 'badge-success';
    }
  };

  return (
    <>
      <header
        style={{
          height: 'var(--header-height)',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Left Side: Mobile Menu & Greeting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onOpenMobileSidebar}
            style={{
              display: 'none',
              background: 'var(--bg-subtle)',
              border: 'none',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
            }}
            className="mobile-menu-btn"
            aria-label="Toggle Navigation"
          >
            <Menu size={22} />
          </button>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {getGreeting()},
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{user?.name || 'Member'}</span>
              <button
                onClick={() => setIsGroupModalOpen(true)}
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--primary)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid rgba(194, 24, 91, 0.15)',
                }}
                title="View Group Information"
              >
                <Building2 size={12} /> {user?.groupName || 'Chhatrapati Bachat Gat'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action buttons + Notification Bell + User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Quick Actions */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {canManageSavings && onOpenRecordSavings && (
              <button
                onClick={onOpenRecordSavings}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <PiggyBank size={15} /> + Savings
              </button>
            )}
            {canManageLoans && onOpenCreateLoan && (
              <button
                onClick={onOpenCreateLoan}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '7px 14px' }}
              >
                <HandCoins size={15} /> + Loan
              </button>
            )}
          </div>

          {/* Notification Dropdown */}
          <NotificationDropdown />

          {/* User Profile Section with Dropdown */}
          <div style={{ position: 'relative' }} ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '5px 12px 5px 6px',
                borderRadius: 'var(--radius-full)',
                background: isProfileOpen ? 'var(--accent-soft)' : '#FFFFFF',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                transition: 'var(--transition)',
                boxShadow: 'var(--shadow-xs)',
              }}
              onMouseEnter={(e) => {
                if (!isProfileOpen) e.currentTarget.style.background = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                if (!isProfileOpen) e.currentTarget.style.background = '#FFFFFF';
              }}
              aria-label="User profile menu"
            >
              {/* Circular Avatar with Initials */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--primary-gradient)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  boxShadow: 'var(--shadow-pink)',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {getInitials(user?.name)}
              </div>

              {/* User Name & Role (Stacked Layout) */}
              <div
                className="header-profile-info"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  lineHeight: 1.25,
                }}
              >
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.name || 'User'}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {roleName}
                </span>
              </div>

              {/* Dropdown Chevron Arrow */}
              <ChevronDown
                size={15}
                color="var(--text-secondary)"
                style={{
                  transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease',
                  marginLeft: '2px',
                }}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div
                className="fade-in"
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: 0,
                  width: '240px',
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-color)',
                  zIndex: 1000,
                  overflow: 'hidden',
                }}
              >
                {/* User Info Header Snippet */}
                <div style={{ padding: '16px', background: '#F8FAFC', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <span className={`badge ${getRoleBadgeClass(roleName)}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                      Role: {roleName}
                    </span>
                  </div>
                </div>

                {/* Dropdown Items */}
                <div style={{ padding: '6px' }}>
                  <button
                    onClick={handleNavigateProfile}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={16} color="var(--primary)" />
                    <span>My Profile</span>
                  </button>

                  {canManageGroup && (
                    <button
                      onClick={handleNavigateSettings}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        transition: 'var(--transition)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Settings size={16} color="var(--primary)" />
                      <span>Settings</span>
                    </button>
                  )}

                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      color: 'var(--danger)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Group Info Modal */}
      <GroupInfoModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />

      <style>{`
        @media (max-width: 992px) {
          .mobile-menu-btn {
            display: flex !important;
          }
          header {
            padding: 0 16px !important;
          }
        }
        @media (max-width: 768px) {
          .header-profile-info {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .header-actions {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Header;
