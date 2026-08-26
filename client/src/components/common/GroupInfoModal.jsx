import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Building2, Calendar, Target, Users, ShieldCheck, Tag } from 'lucide-react';
import { groupService } from '../../services/dashboardService';

const GroupInfoModal = ({ isOpen, onClose }) => {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Group Information" maxWidth="500px">
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center' }}>Loading group information...</div>
      ) : group ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(194, 24, 91, 0.1) 0%, rgba(233, 30, 99, 0.05) 100%)',
              border: '1px solid rgba(194, 24, 91, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
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
              <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', fontWeight: 700 }}>{group.group_name}</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={12} /> ID: <code style={{ fontWeight: 600 }}>{group.group_code}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <ShieldCheck size={14} color="var(--primary)" /> MONTHLY SHARE
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                ₹{parseFloat(group.monthly_contribution_per_share).toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>per share / member</span>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Target size={14} color="var(--success)" /> MONTHLY TARGET
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                ₹{parseFloat(group.monthly_target).toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>group goal</span>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Users size={14} color="var(--info)" /> TOTAL MEMBERS
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {group.total_active_members} Active
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>out of {group.total_members} registered</span>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Calendar size={14} color="var(--warning)" /> CREATED DATE
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {new Date(group.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Admin: {group.created_by_name || 'System'}</span>
            </div>
          </div>

          {group.description && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: '#F8FAFC', padding: '12px', borderRadius: 'var(--radius-md)' }}>
              <strong>Description:</strong> {group.description}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default GroupInfoModal;
