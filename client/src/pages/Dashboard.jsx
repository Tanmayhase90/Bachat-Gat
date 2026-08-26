import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboardService';
import StatCard from '../components/common/StatCard';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import {
  Wallet,
  PiggyBank,
  HandCoins,
  TrendingUp,
  CreditCard,
  Users,
  FileBarChart2,
  Calendar,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const Dashboard = () => {
  const { user, groupName, isAdmin, isMember } = useAuth();
  const navigate = useNavigate();
  const { refreshTrigger, openAddMember, openRecordSavings, openCreateLoan, openRecordRepayment } = useOutletContext();

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [summary, setSummary] = useState(null);
  const [memberSummary, setMemberSummary] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sumRes, progRes, actRes] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getMonthlyProgress(selectedMonth, selectedYear),
        dashboardService.getRecentActivities(8),
      ]);

      if (sumRes.success) {
        setSummary(sumRes.summary);
        setMemberSummary(sumRes.memberSummary);
      }
      if (progRes.success) {
        setProgress(progRes.progress);
      }
      if (actRes.success) {
        setActivities(actRes.activities);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshTrigger, selectedMonth, selectedYear]);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  if (loading && !summary) {
    return <Loader text="Loading group financial metrics..." />;
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner / Total Fund Display */}
      <div
        style={{
          background: 'var(--primary-gradient)',
          borderRadius: 'var(--radius-xl)',
          padding: '30px 36px',
          color: '#FFFFFF',
          boxShadow: 'var(--shadow-pink)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.2)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '8px' }}>
            <ShieldCheck size={14} /> {(groupName || user?.groupName || summary?.groupName || 'BACHAT GAT').toUpperCase()}
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: '2.25rem', fontWeight: 800, marginBottom: '4px' }}>
            ₹{summary ? summary.totalGroupFund.toLocaleString('en-IN') : '0'}
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem' }}>
            Total Group Fund (Total Savings ₹{summary?.totalSavings.toLocaleString('en-IN')} + Interest ₹{summary?.totalInterest.toLocaleString('en-IN')})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '12px 20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>AVAILABLE BALANCE</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF' }}>
              ₹{summary ? summary.availableBalance.toLocaleString('en-IN') : '0'}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '12px 20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>ACTIVE LOANS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF' }}>
              ₹{summary ? summary.activeLoans.toLocaleString('en-IN') : '0'}
            </div>
          </div>
        </div>
      </div>

      {/* Member Personal Summary Panel (if logged in as Member) */}
      {isMember && memberSummary && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #FFF5F8 0%, #FFFFFF 100%)',
            borderColor: 'var(--primary-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <PiggyBank size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>My Personal Portfolio</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>My Total Savings</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success-text)' }}>
                ₹{memberSummary.mySavings.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Loan Dues</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: memberSummary.myLoanOutstanding > 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                ₹{memberSummary.myLoanOutstanding.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Interest Paid</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{memberSummary.myInterestPaid.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Financial Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          title="Total Savings"
          value={`₹${summary?.totalSavings.toLocaleString('en-IN')}`}
          subtitle="Cumulative member savings"
          icon={PiggyBank}
          colorScheme="pink"
        />
        <StatCard
          title="Active Loans"
          value={`₹${summary?.activeLoans.toLocaleString('en-IN')}`}
          subtitle={`${summary?.activeLoansCount} active loans outstanding`}
          icon={HandCoins}
          colorScheme="amber"
        />
        <StatCard
          title="Total Interest"
          value={`₹${summary?.totalInterest.toLocaleString('en-IN')}`}
          subtitle="Revenue generated from loans"
          icon={TrendingUp}
          colorScheme="purple"
        />
        <StatCard
          title="Available Balance"
          value={`₹${summary?.availableBalance.toLocaleString('en-IN')}`}
          subtitle="Ready for new loan disbursement"
          icon={Wallet}
          colorScheme="green"
          highlight
        />
      </div>

      {/* QUICK ACTIONS SECTION */}
      <div>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div
            className="card"
            onClick={() => navigate('/members')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--accent-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Members</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>View & manage list</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>

          {isAdmin && (
            <div
              className="card"
              onClick={openRecordSavings}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '18px 20px',
              }}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PiggyBank size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Add Savings</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Record monthly hafta</div>
              </div>
              <ArrowUpRight size={18} color="var(--text-muted)" />
            </div>
          )}

          <div
            className="card"
            onClick={() => navigate('/loans')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--warning-light)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HandCoins size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Loans</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Disburse & repayments</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>

          <div
            className="card"
            onClick={() => navigate('/reports')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileBarChart2 size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Reports</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Export CSV & Print</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* MONTHLY SAVINGS PROGRESS & RECENT ACTIVITY GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="dash-two-col">
        {/* Monthly Savings Progress Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem' }}>Monthly Savings Progress</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Collection vs Monthly Target</span>
              </div>

              {/* Month/Year Selector */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="form-select"
                  style={{ padding: '6px 10px', fontSize: '0.825rem' }}
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="form-select"
                  style={{ padding: '6px 10px', fontSize: '0.825rem' }}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
            </div>

            {progress && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>COLLECTED AMOUNT</span>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                      ₹{progress.collectedAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MONTHLY TARGET</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      ₹{progress.targetAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '12px', background: '#F1F5F9', borderRadius: 'var(--radius-full)', overflow: 'hidden', margin: '14px 0' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progress.progressPercentage}%`,
                      background: 'var(--primary-gradient)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--primary)' }}>{progress.progressPercentage}% Completed</span>
                  <span style={{ color: progress.pendingMembersCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {progress.pendingMembersCount} Pending Members
                  </span>
                </div>

                {/* Pending Members Pill List */}
                {progress.pendingMembers && progress.pendingMembers.length > 0 && (
                  <div style={{ marginTop: '20px', background: '#FFF5F8', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(194, 24, 91, 0.15)' }}>
                    <div style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                      MEMBERS PENDING FOR THIS MONTH ({progress.pendingMembers.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {progress.pendingMembers.map((pm) => (
                        <span
                          key={pm.member_id}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {pm.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Recent Activity</h2>
            <Clock size={18} color="var(--text-muted)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No recent activity recorded.
              </div>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: '#FAFAFA',
                    border: '1px solid #F1F5F9',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '2px',
                      flexShrink: 0,
                    }}
                  >
                    <ArrowUpRight size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {act.description}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(act.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dash-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
