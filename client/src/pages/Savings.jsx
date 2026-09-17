import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { savingsService } from '../services/savingsService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatDate, formatMonthYear, formatMonthlyHaftaDueDate } from '../utils/formatters';
import { PiggyBank, Search, Plus, Filter, Calendar, Building2, User, Clock } from 'lucide-react';

const Savings = () => {
  const { monthlyHaftaDay, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const outletContext = useOutletContext() || {};
  const { refreshTrigger = 0, openRecordSavings } = outletContext;

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savingsList, setSavingsList] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchSavings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;
      if (debouncedSearch) params.search = debouncedSearch;

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
  }, [refreshTrigger, selectedMonth, selectedYear, debouncedSearch]);

  const months = [
    { value: '', label: t('common.all') + ' ' + t('reports.selectMonthYear') },
    { value: '1', label: t('common.months.1', 'January') },
    { value: '2', label: t('common.months.2', 'February') },
    { value: '3', label: t('common.months.3', 'March') },
    { value: '4', label: t('common.months.4', 'April') },
    { value: '5', label: t('common.months.5', 'May') },
    { value: '6', label: t('common.months.6', 'June') },
    { value: '7', label: t('common.months.7', 'July') },
    { value: '8', label: t('common.months.8', 'August') },
    { value: '9', label: t('common.months.9', 'September') },
    { value: '10', label: t('common.months.10', 'October') },
    { value: '11', label: t('common.months.11', 'November') },
    { value: '12', label: t('common.months.12', 'December') },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('savings.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('savings.subtitle')}
          </p>
        </div>

        <button
          onClick={() => openRecordSavings({
            month: selectedMonth ? Number(selectedMonth) : (currentDate.getMonth() + 1),
            year: selectedYear ? Number(selectedYear) : currentDate.getFullYear(),
          })}
          className="btn-primary"
        >
          <Plus size={18} /> {t('savings.recordSavingsBtn')}
        </button>
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

          <div style={{ position: 'relative' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-select"
              style={{ width: '160px', fontSize: '0.85rem' }}
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
              <option value="">{t('common.all')} {t('common.date')}</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Monthly Hafta Due Date Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              color: 'var(--primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <Clock size={14} />
            <span>{formatMonthlyHaftaDueDate(monthlyHaftaDay, language)}</span>
          </div>

          {(selectedMonth || selectedYear) && (
            <button
              onClick={() => {
                setSelectedMonth('');
                setSelectedYear('');
              }}
              style={{ background: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {t('common.cancel')}
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
              placeholder={t('members.searchPlaceholder')}
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
            <span>{t('common.total')}: {formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Savings Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        {loading ? (
          <Loader text={t('common.loadingData')} />
        ) : (!savingsList || savingsList.length === 0) ? (
          <EmptyState
            icon={PiggyBank}
            title={t('savings.noSavingsRecorded')}
            description={t('savings.noSavingsRecorded')}
            actionText={isAdmin ? t('savings.recordSavingsBtn') : undefined}
            onAction={() => openRecordSavings({
              month: selectedMonth ? Number(selectedMonth) : (currentDate.getMonth() + 1),
              year: selectedYear ? Number(selectedYear) : currentDate.getFullYear(),
            })}
          />
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>{t('savings.tableMemberName')}</th>
                  <th>{t('savings.monthYearFilter')}</th>
                  <th>{t('savings.tableShareAmount')}</th>
                  <th>{t('savings.tablePaymentDate')}</th>
                  <th>{t('savings.tablePaymentMode')}</th>
                  <th>{t('common.notes')}</th>
                  <th>{t('common.status')}</th>
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
                      {formatMonthYear(s.month, s.year, language)}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--success-text)', fontSize: '1rem' }}>
                      {formatCurrency(s.amount)}
                    </td>
                    <td>{formatDate(s.payment_date || s.paymentDate)}</td>
                    <td>
                      <span className="badge badge-info">{s.payment_mode || s.paymentMode || 'UPI'}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.remarks || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span className="badge badge-success">{t('common.paid')}</span>
                    </td>
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
