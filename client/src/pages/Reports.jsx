import React, { useState, useEffect } from 'react';
import { reportService } from '../services/dashboardService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatMonthYear,
} from '../utils/formatters';
import {
  FileBarChart2,
  Download,
  Printer,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  HandCoins,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const Reports = () => {
  const currentDate = new Date();
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'pending' | 'loans'
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [search, setSearch] = useState('');

  const [monthlyData, setMonthlyData] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [loansData, setLoansData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      if (activeTab === 'monthly') {
        const res = await reportService.getMonthlyReport(selectedMonth, selectedYear);
        if (res.success) setMonthlyData(res);
      } else if (activeTab === 'pending') {
        const res = await reportService.getPendingDuesReport(selectedMonth, selectedYear, search);
        if (res.success) setPendingData(res);
      } else if (activeTab === 'loans') {
        const res = await reportService.getLoansOverviewReport();
        if (res.success) setLoansData(res);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab, selectedMonth, selectedYear, search]);

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = (filename, rows) => {
    if (!rows || rows.length === 0) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows
        .map((row) =>
          keys
            .map((k) => {
              let cell = row[k] === null || row[k] === undefined ? '' : row[k];
              cell = typeof cell === 'object' ? JSON.stringify(cell) : String(cell).replace(/"/g, '""');
              if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
              return cell;
            })
            .join(separator)
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (activeTab === 'monthly' && monthlyData) {
      const list = monthlyData.savingsTransactions || monthlyData.collections || [];
      const exportList = list.map((s) => ({
        Type: 'Savings',
        Member: s.member_name || s.memberName,
        MemberCode: s.member_code || s.memberCode,
        Amount: s.amount || s.paid_amount,
        Month: s.month,
        Year: s.year,
        Date: s.payment_date || s.paymentDate,
        Mode: s.payment_mode || s.paymentMode,
      }));
      exportToCSV(`Monthly_Report_${selectedMonth}_${selectedYear}`, exportList);
    } else if (activeTab === 'pending' && pendingData) {
      const list = pendingData.duesList || pendingData.pendingMembers || [];
      const exportList = list.map((d) => ({
        Member: d.memberName || d.member_name,
        Code: d.memberCode || d.member_code,
        PendingHafta: d.pendingHafta || d.monthly_contribution,
        OutstandingPrincipal: d.outstandingPrincipal,
        PendingInterest: d.pendingInterest,
        TotalPending: d.totalPending || d.due_amount,
      }));
      exportToCSV(`Pending_Dues_${selectedMonth}_${selectedYear}`, exportList);
    } else if (activeTab === 'loans' && loansData) {
      const list = loansData.loans || [];
      const exportList = list.map((l) => ({
        LoanNumber: l.loan_number || l.loanNumber,
        Member: l.member_name || l.memberName,
        Code: l.member_code || l.memberCode,
        OriginalLoan: l.principal_amount || l.principalAmount,
        InterestRate: l.interest_rate || l.interestRate,
        PrincipalPaid: l.total_principal_paid,
        InterestPaid: l.total_interest_paid,
        Outstanding: l.outstanding_amount || l.outstandingAmount,
        Status: l.status,
      }));
      exportToCSV('Loans_Overview_Report', exportList);
    }
  };

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

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Export & Print */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Financial Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Comprehensive accounting summaries, pending collections, and loan performance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePrint} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Printer size={16} /> Print Report
          </button>
          <button onClick={handleExport} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab('monthly')}
          className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
        >
          <FileBarChart2 size={18} /> Monthly Report
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
        >
          <AlertCircle size={18} /> Pending Dues
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          className={`tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
        >
          <HandCoins size={18} /> Loans Overview
        </button>
      </div>

      {/* Period Filter for Monthly & Pending Dues */}
      {(activeTab === 'monthly' || activeTab === 'pending') && (
        <div
          className="card"
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Select Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="form-select"
              style={{ width: '150px', fontSize: '0.85rem' }}
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
              style={{ width: '110px', fontSize: '0.85rem' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {activeTab === 'pending' && (
            <div style={{ position: 'relative', width: '260px' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                placeholder="Search member..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Loader text="Generating report data..." />
      ) : (
        <>
          {/* TAB 1: MONTHLY REPORT */}
          {activeTab === 'monthly' && monthlyData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Collection Summary Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL SAVINGS (MONTH)</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                    {formatCurrency(monthlyData.summary?.monthSavings ?? monthlyData.summary?.totalSavingsCollected)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Collected in {months.find(m => m.value === selectedMonth)?.label}</span>
                </div>

                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INTEREST (MONTH)</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
                    {formatCurrency(monthlyData.summary?.monthInterest ?? monthlyData.summary?.totalInterestCollected)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From loan repayments</span>
                </div>

                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>OUTSTANDING PRINCIPAL</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-text)', marginTop: '4px' }}>
                    {formatCurrency(monthlyData.summary?.outstandingPrincipal)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active loan balance</span>
                </div>

                <div className="card" style={{ padding: '18px', borderColor: 'var(--success)', background: 'linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVAILABLE GROUP BALANCE</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
                    {formatCurrency(monthlyData.summary?.availableGroupBalance)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Net liquid cash in fund</span>
                </div>
              </div>

              {/* Monthly Savings Transactions Table */}
              <div className="card">
                <h3 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>Monthly Savings Transactions</h3>
                {(!monthlyData.savingsTransactions || monthlyData.savingsTransactions.length === 0) ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No savings recorded for this selected month.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Code</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.savingsTransactions.map((s) => (
                          <tr key={s.id || s.member_id}>
                            <td style={{ fontWeight: 700 }}>{s.member_name || s.memberName}</td>
                            <td>{s.member_code || s.memberCode}</td>
                            <td style={{ fontWeight: 800, color: 'var(--success-text)' }}>{formatCurrency(s.amount || s.paid_amount)}</td>
                            <td>{formatDate(s.payment_date || s.paymentDate)}</td>
                            <td><span className="badge badge-info">{s.payment_mode || s.paymentMode || 'UPI'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PENDING DUES REPORT */}
          {activeTab === 'pending' && pendingData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary Alert */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--danger-light)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <h3 style={{ color: 'var(--danger-text)', fontSize: '1.1rem', fontWeight: 800 }}>
                    {formatNumber(pendingData.summary?.totalPendingMembers ?? pendingData.count)} Member(s) have pending balances
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                    For period {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger-text)' }}>TOTAL PENDING DUES</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                    {formatCurrency(pendingData.summary?.totalPendingAmount ?? pendingData.totalPendingAmount)}
                  </div>
                </div>
              </div>

              {/* Dues Table */}
              <div className="card">
                {(!pendingData.duesList || pendingData.duesList.length === 0) ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="All dues cleared!"
                    description="There are no pending savings or loan dues for the selected period."
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Member Name</th>
                          <th>Pending Hafta</th>
                          <th>Loan Outstanding</th>
                          <th>Pending Interest</th>
                          <th>Total Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingData.duesList.map((d) => (
                          <tr key={d.memberId || d.member_id || d.memberName}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{d.memberName || d.member_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.memberCode || d.member_code} • {d.memberPhone || d.phone || 'No Phone'}</div>
                            </td>
                            <td style={{ fontWeight: 600, color: (d.pendingHafta || d.monthly_contribution) > 0 ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                              {formatCurrency(d.pendingHafta || d.monthly_contribution)}
                            </td>
                            <td style={{ fontWeight: 600, color: (d.outstandingPrincipal || 0) > 0 ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                              {formatCurrency(d.outstandingPrincipal)}
                            </td>
                            <td style={{ fontWeight: 600, color: (d.pendingInterest || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                              {formatCurrency(d.pendingInterest)} ({d.interestRate || 2}%)
                            </td>
                            <td style={{ fontWeight: 800, color: 'var(--danger-text)', fontSize: '1rem' }}>
                              {formatCurrency(d.totalPending || d.due_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LOANS OVERVIEW REPORT */}
          {activeTab === 'loans' && loansData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL DISBURSED</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
                    {formatCurrency(loansData.summary?.totalPrincipalDisbursed)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Across {formatNumber(loansData.summary?.totalLoans ?? loansData.summary?.totalLoansCount)} loan(s)</span>
                </div>

                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PRINCIPAL COLLECTED</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
                    {formatCurrency(loansData.summary?.totalPrincipalCollected ?? loansData.summary?.totalPrincipalRecovered)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Recovered principal</span>
                </div>

                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>INTEREST EARNED</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                    {formatCurrency(loansData.summary?.totalInterestCollected ?? loansData.summary?.totalInterestEarned)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cumulative interest</span>
                </div>

                <div className="card" style={{ padding: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>REMAINING OUTSTANDING</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-text)', marginTop: '4px' }}>
                    {formatCurrency(loansData.summary?.totalOutstanding)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active loan balance</span>
                </div>
              </div>

              {/* Table */}
              <div className="card">
                {(!loansData.loans || loansData.loans.length === 0) ? (
                  <EmptyState
                    icon={HandCoins}
                    title="No loans found"
                    description="There are currently no loans recorded in the system."
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Loan #</th>
                          <th>Member</th>
                          <th>Original Loan</th>
                          <th>Principal Paid</th>
                          <th>Interest Paid</th>
                          <th>Outstanding</th>
                          <th>Repayments</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loansData.loans.map((l) => (
                          <tr key={l.id || l.loan_id}>
                            <td style={{ fontWeight: 700 }}>{l.loan_number || l.loanNumber}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{l.member_name || l.memberName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.member_code || l.memberCode}</div>
                            </td>
                            <td style={{ fontWeight: 700 }}>{formatCurrency(l.principal_amount || l.principalAmount)}</td>
                            <td style={{ fontWeight: 600, color: 'var(--success-text)' }}>{formatCurrency(l.total_principal_paid)}</td>
                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(l.total_interest_paid)}</td>
                            <td style={{ fontWeight: 800, color: l.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                              {formatCurrency(l.outstanding_amount || l.outstandingAmount)}
                            </td>
                            <td>{formatNumber(l.repayments_count)} installments</td>
                            <td>
                              <span className={`badge ${l.status === 'ACTIVE' ? 'badge-warning' : 'badge-success'}`}>
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
