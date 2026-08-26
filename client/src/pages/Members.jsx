import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { memberService } from '../services/memberService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import {
  Users,
  Search,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  HandCoins,
  ChevronRight,
  Shield,
} from 'lucide-react';

const Members = () => {
  const { canManageMembers } = useAuth();
  const navigate = useNavigate();
  const { refreshTrigger, openAddMember } = useOutletContext();

  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await memberService.getAllMembers({ search });
      if (res.success) {
        setMembers(res.members);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [refreshTrigger, search]);

  const displayedMembers = activeTab === 'all'
    ? members
    : members.filter((m) => m.is_pending_dues);

  const getRoleBadge = (role) => {
    const r = (role || 'MEMBER').toUpperCase();
    if (r === 'ADMIN') return <span className="badge badge-pink">ADMIN</span>;
    if (r === 'TREASURER') return <span className="badge badge-warning">TREASURER</span>;
    if (r === 'SECRETARY') return <span className="badge badge-info">SECRETARY</span>;
    return <span className="badge badge-success">MEMBER</span>;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Action Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Group Members</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage registered members, assigned roles, monthly shares, and pending dues
          </p>
        </div>

        {canManageMembers && (
          <button onClick={openAddMember} className="btn-primary">
            <UserPlus size={18} /> Add New Member
          </button>
        )}
      </div>

      {/* Tabs & Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'all' ? 'var(--primary)' : 'var(--bg-subtle)',
              color: activeTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            All Members ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'pending' ? 'var(--danger)' : 'var(--bg-subtle)',
              color: activeTab === 'pending' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Pending Dues ({members.filter((m) => m.is_pending_dues).length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search
            size={18}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', paddingRight: '12px', fontSize: '0.875rem' }}
            placeholder="Search by name, code, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Members Grid / Cards */}
      {loading ? (
        <Loader text="Fetching member records..." />
      ) : displayedMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={activeTab === 'pending' ? 'No Pending Dues!' : 'No Members Found'}
          description={
            activeTab === 'pending'
              ? 'All active members have successfully contributed their monthly savings.'
              : 'Try modifying your search or register a new member.'
          }
          actionText={canManageMembers && activeTab === 'all' ? 'Add Member' : undefined}
          onAction={openAddMember}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {displayedMembers.map((m) => (
            <div
              key={m.member_id}
              className="card"
              onClick={() => navigate(`/members/${m.member_id}`)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
                borderLeft: m.is_pending_dues ? '4px solid var(--danger)' : '4px solid var(--success)',
              }}
            >
              <div>
                {/* Member Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: 'var(--accent-soft)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                      }}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {m.member_code} • Joined {new Date(m.joined_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {getRoleBadge(m.role_name)}
                </div>

                {/* Contribution & Status Tag */}
                <div
                  style={{
                    background: m.is_pending_dues ? 'var(--danger-light)' : 'var(--bg-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {m.is_pending_dues ? 'Current Dues' : 'Monthly Share'}
                    </span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: m.is_pending_dues ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                      ₹{m.is_pending_dues ? m.pending_amount.toLocaleString('en-IN') : m.monthly_contribution.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: m.is_pending_dues ? 'var(--danger-text)' : 'var(--success-text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {m.is_pending_dues ? (
                      <>
                        <AlertCircle size={14} /> Pending
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Monthly
                      </>
                    )}
                  </span>
                </div>

                {/* Savings & Loan Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.825rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <PiggyBank size={15} color="var(--primary)" />
                    <span>Total: ₹{m.total_savings.toLocaleString('en-IN')}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <HandCoins size={15} color="var(--warning)" />
                    <span>Loans: ₹{m.outstanding_loans.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                <span>View Full Member Profile</span>
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Members;
