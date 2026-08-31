import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { savingsService } from '../services/savingsService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import { PiggyBank, Search, Plus, Filter, Calendar, Building2, User } from 'lucide-react';

const Savings = () => {
  const { user, isAdmin, isMember, canManageSavings } = useAuth();
  const outletContext = useOutletContext() || {};
  const { refreshTrigger = 0, openRecordSavings } = outletContext;

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [scope, setScope] = useState('all'); // 'all' | 'my'
  const [search, setSearch] = useState('');
  const [savingsList, setSavingsList] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSavings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;
      if (search) params.search = search;
      if (scope === 'my' && user?.memberId) {
        params.memberId = user.memberId;
      }

      const res = await savingsService.getAllSavings(params);
      if (res.success) {
        setSavingsList(res.savings || []);
        setTotalAmount(res.totalAmount || 0);
      }
    } catch (err) {
      console.error('Failed to load savings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavings();
  }, [refreshTrigger, selectedMonth, selectedYear, scope, search]);

  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Group Monthly Savings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Record and review member regular monthly contributions and hafta records
          </p>
        </div>

        {isAdmin && (
          <button onClick={openRecordSavings} className="btn-primary">
            <Plus size={18} /> Record Monthly Savings
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Scope Filter for Members */}
          {user?.memberId && (
            <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: 'var(--radius-md)', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setScope('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: scope === 'all' ? '#FFFFFF' : 'transparent',
                  color: scope === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: scope === 'all' ? 'var(--shadow-xs)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Building2 size={13} /> All Group Savings
              </button>
              <button
                type="button"
                onClick={() => setScope('my')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: scope === 'my' ? '#FFFFFF' : 'transparent',
                  color: scope === 'my' ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: scope === 'my' ? 'var(--shadow-xs)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <User size={13} /> My Savings
              </button>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-select"
              style={{ width: '140px', fontSize: '0.85rem' }}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="form-select"
              style={{ width: '120px', fontSize: '0.85rem' }}
            >
              <option value="">All Years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {(selectedMonth || selectedYear) && (
            <button
              onClick={() => {
                setSelectedMonth('');
                setSelectedYear('');
              }}
              style={{ background: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search
              size={17}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
              placeholder="Search member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Aggregated Total Badge */}
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Total: {formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Savings Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        {loading ? (
          <Loader text="Loading savings records..." />
        ) : (!savingsList || savingsList.length === 0) ? (
          <EmptyState
            icon={PiggyBank}
            title="No savings records found"
            description="No savings records match your active search and filters."
            actionText={isAdmin ? 'Record Savings' : undefined}
            onAction={openRecordSavings}
          />
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Month & Year</th>
                  <th>Amount</th>
                  <th>Payment Date</th>
                  <th>Mode</th>
                  <th>Remarks</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {savingsList.map((s) => (
                  <tr key={s.id || s.saving_id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.member_name || s.memberName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.member_code || s.memberCode}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {formatMonthYear(s.month, s.year)}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--success-text)', fontSize: '1rem' }}>
                      {formatCurrency(s.amount)}
                    </td>
                    <td>{formatDate(s.payment_date || s.paymentDate)}</td>
                    <td>
                      <span className="badge badge-info">{s.payment_mode || s.paymentMode || 'UPI'}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.remarks || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.recorded_by_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Savings;
