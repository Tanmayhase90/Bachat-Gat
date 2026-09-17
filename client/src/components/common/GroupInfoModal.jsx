import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useLanguage } from '../../context/LanguageContext';
import { Building2, Calendar, Target, Users, ShieldCheck, Tag } from 'lucide-react';
import { groupService } from '../../services/dashboardService';
import { formatCurrency, formatDate, formatNumber, DEFAULT_GROUP_ID } from '../../utils/formatters';

const GroupInfoModal = ({ isOpen, onClose }) => {
  const { t, getGroupName } = useLanguage();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchGroup = async () => {
        try {
          setLoading(true);
          const res = await groupService.getGroupDetails();
          if (res.success) {
            setGroup(res.group);
          }
        } catch (err) {
          console.error('Failed to load group details:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchGroup();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('groupInfo.title', 'Bachat Gat Profile')}
      maxWidth="520px"
      footer={
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
      }
    >
      {loading || !group ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('common.loading', 'Loading details...')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px',
              background: 'var(--bg-subtle, #F8FAFC)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color, #E2E8F0)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.25rem',
              }}
            >
              BG
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', fontWeight: 700 }}>
                {getGroupName(group.group_name || group.groupName)}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={12} /> ID: <code style={{ fontWeight: 600 }}>{group.group_code || group.groupCode || DEFAULT_GROUP_ID}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <ShieldCheck size={14} color="var(--primary)" /> MONTHLY SHARE
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {formatCurrency(group.monthly_contribution_per_share || group.monthlyContribution || 1000)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>per share / member</span>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Target size={14} color="var(--success)" /> MONTHLY TARGET
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {formatCurrency(group.monthly_target || group.monthlyTarget || ((group.total_active_members || group.totalActiveMembers || 0) * (group.monthly_contribution_per_share || group.monthlyContribution || 1000)) || 0)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>group goal</span>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Users size={14} color="var(--info)" /> TOTAL MEMBERS
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {formatNumber(group.total_active_members || group.totalActiveMembers)} Active
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>out of {formatNumber(group.total_members || group.totalMembers)} registered</span>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Calendar size={14} color="var(--warning)" /> CREATED DATE
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {formatDate(group.created_at || group.createdAt)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Admin: {group.created_by_name || group.createdByName || 'Admin'}</span>
            </div>
          </div>

          {group.description && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: '#F8FAFC', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <strong>Description:</strong> {group.description}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default GroupInfoModal;
