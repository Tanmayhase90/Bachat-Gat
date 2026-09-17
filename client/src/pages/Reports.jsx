import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
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
  Eye,
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
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const reportState = location.state || {};
  const [activeTab, setActiveTab] = useState(reportState.activeTab || 'monthly'); // 'monthly' | 'pending' | 'loans'
  const [selectedMonth, setSelectedMonth] = useState(reportState.selectedMonth || currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(reportState.selectedYear || currentDate.getFullYear());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [monthlyData, setMonthlyData] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [loansData, setLoansData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      if (activeTab === 'monthly') {
        const res = await reportService.getMonthlyReport(selectedMonth, selectedYear);
        if (res.success) setMonthlyData(res);
      } else if (activeTab === 'pending') {
        const res = await reportService.getPendingDuesReport(selectedMonth, selectedYear, debouncedSearch);
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
  }, [activeTab, selectedMonth, selectedYear, debouncedSearch]);

  const handlePrint = () => {
    navigate(`/reports/view?month=${selectedMonth}&year=${selectedYear}&print=true`, {
      state: { selectedMonth, selectedYear, activeTab, autoPrint: true },
    });
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
      const list = monthlyData.collections || monthlyData.savingsTransactions || [];
      const exportList = list.map((s, idx) => ({
        'Sr No': idx + 1,
        'Member Name': s.memberName || s.member_name,
        'Member Code': s.memberCode || s.member_code,
        'Monthly Savings': s.savingsAmount || s.savings_amount || s.paid_amount || 0,
        'Loan Principal': s.loanPrincipal || s.loan_principal || 0,
        'Monthly Interest': s.interestPaid || s.interest_paid || s.interestAmount || 0,
        'Principal Repaid': s.principalRepaid || s.principal_repaid || 0,
        'Total Payment': s.totalPayment || s.total_payment || s.amount || 0,
        'Outstanding Loan': s.outstandingLoan || s.outstanding_loan || 0,
        'Payment Date': s.paymentDate || s.payment_date || '',
        'Pending Amount': s.pendingAmount !== undefined ? s.pendingAmount : (((s.pendingLoan || s.outstandingLoan || 0)) + (s.pendingHafta !== undefined ? s.pendingHafta : Math.max(0, (s.expected_amount || s.savingsAmount || 0) - (s.paid_amount || s.paidAmount || 0)))),
        'Status': s.status,
      }));
      exportToCSV(`Monthly_Register_${selectedMonth}_${selectedYear}`, exportList);
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
    { value: 1, label: t('common.months.1', 'January') },
    { value: 2, label: t('common.months.2', 'February') },
    { value: 3, label: t('common.months.3', 'March') },
    { value: 4, label: t('common.months.4', 'April') },
    { value: 5, label: t('common.months.5', 'May') },
    { value: 6, label: t('common.months.6', 'June') },
    { value: 7, label: t('common.months.7', 'July') },
    { value: 8, label: t('common.months.8', 'August') },
    { value: 9, label: t('common.months.9', 'September') },
    { value: 10, label: t('common.months.10', 'October') },
    { value: 11, label: t('common.months.11', 'November') },
    { value: 12, label: t('common.months.12', 'December') },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Export & Print */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('reports.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('reports.subtitle')}
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() =>
              navigate(`/reports/view?month=${selectedMonth}&year=${selectedYear}`, {
                state: { selectedMonth, selectedYear, activeTab },
              })
            }
            className="btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Eye size={16} /> {t('reports.viewReportBtn')}
          </button>
          <button onClick={handlePrint} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Printer size={16} /> {t('reports.printReportBtn')}
          </button>
          <button onClick={handleExport} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Download size={16} /> {t('reports.exportCSVBtn')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container no-print">
        <button
          onClick={() => setActiveTab('monthly')}
          className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
        >
          <FileBarChart2 size={18} /> {t('reports.monthlyTab')}
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
        >
          <AlertCircle size={18} /> {t('reports.pendingTab')}
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          className={`tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
        >
          <HandCoins size={18} /> {t('reports.loansTab')}
        </button>
      </div>

      {/* Period Filter for Monthly & Pending Dues */}
      {(activeTab === 'monthly' || activeTab === 'pending') && (
        <div
          className="card no-print"
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

              {/* Monthly Financial Register Table */}
              {(() => {
                const registerList = [...(monthlyData.collections || [])].sort((a, b) => {
                  const idA = a.memberCode || a.member_code || a.memberId || a.member_id || a.id || '';
                  const idB = b.memberCode || b.member_code || b.memberId || b.member_id || b.id || '';
                  const numA = parseInt(String(idA).replace(/\D/g, ''), 10);
                  const numB = parseInt(String(idB).replace(/\D/g, ''), 10);
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  if (!isNaN(numA)) return -1;
                  if (!isNaN(numB)) return 1;
                  return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
                });
                const totalSavingsSum = registerList.reduce((acc, r) => acc + (r.savingsAmount || r.savings_amount || r.paid_amount || 0), 0);
                const totalLoanPrincipalSum = registerList.reduce((acc, r) => acc + (r.loanPrincipal || r.loan_principal || 0), 0);
                const totalInterestSum = registerList.reduce((acc, r) => acc + (r.interestPaid || r.interest_paid || r.interestAmount || 0), 0);
                const totalPrincipalRepaidSum = registerList.reduce((acc, r) => acc + (r.principalRepaid || r.principal_repaid || 0), 0);
                const totalPaymentSum = registerList.reduce((acc, r) => acc + (r.totalPayment || r.total_payment || r.amount || 0), 0);
                const totalOutstandingSum = registerList.reduce((acc, r) => acc + (r.outstandingLoan || r.outstanding_loan || 0), 0);
                const paidCount = registerList.filter((r) => (r.paid_amount || r.paidAmount || 0) >= (r.expected_amount || r.expectedAmount || r.savingsAmount || 0)).length;
                const pendingCount = registerList.filter((r) => (r.paid_amount || r.paidAmount || 0) < (r.expected_amount || r.expectedAmount || r.savingsAmount || 0)).length;

                return (
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                        {language === 'mr' ? 'मासिक आर्थिक नोंदवही' : 'Monthly Financial Register'} ({months.find(m => m.value === selectedMonth)?.label} {selectedYear})
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {language === 'mr' ? 'एकूण नोंदणी:' : 'Total Members:'} <strong>{registerList.length}</strong>
                      </span>
                    </div>

                    {registerList.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {language === 'mr' ? 'निवडलेल्या महिन्यासाठी कोणतीही नोंद आढळली नाही.' : 'No records found for the selected month.'}
                      </div>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '650px', overflowY: 'auto' }}>
                        <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>#</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'सभासदाचे नाव' : 'Member Name'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'मासिक शेअर्स' : 'Monthly Savings'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'कर्ज रक्कम' : 'Loan Principal'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'मासिक व्याज' : 'Monthly Interest'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'मुद्दल परतफेड' : 'Principal Repaid'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'एकूण जमा' : 'Total Payment'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'शिल्लक कर्ज' : 'Outstanding Loan'}</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'दिनांक' : 'Payment Date'}</th>
                              <th style={{ textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'थकबाकी रक्कम' : 'Pending Amount'}</th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC', boxShadow: 'inset 0 -1.5px 0 var(--border-color)' }}>{language === 'mr' ? 'स्थिती' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {registerList.map((r, idx) => {
                              const sAmt = r.savingsAmount !== undefined ? r.savingsAmount : (r.savings_amount !== undefined ? r.savings_amount : (r.expected_amount || r.expectedAmount || 0));
                              const lPrin = r.loanPrincipal || r.loan_principal || 0;
                              const iAmt = r.interestPaid || r.interest_paid || r.interestAmount || 0;
                              const pRepaid = r.principalRepaid || r.principal_repaid || 0;
                              const tPay = r.totalPayment || r.total_payment || r.amount || ((r.paid_amount || r.paidAmount || 0) + pRepaid + iAmt);
                              const outLoan = r.outstandingLoan || r.outstanding_loan || 0;
                              const expHafta = Number(r.expected_amount || r.expectedAmount || sAmt);
                              const pHafta = r.pendingHafta !== undefined ? r.pendingHafta : Math.max(0, expHafta - (r.paid_amount || r.paidAmount || 0));
                              const pLoan = r.pendingLoan !== undefined ? r.pendingLoan : outLoan;
                              const pAmt = r.pendingAmount !== undefined ? r.pendingAmount : (pLoan + pHafta);

                              return (
                                <tr key={r.id || r.memberId || idx}>
                                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ fontWeight: 700 }}>{r.memberName || r.member_name}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: sAmt > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {formatCurrency(sAmt)}
                                  </td>
                                  <td style={{ textAlign: 'right', color: lPrin > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {lPrin > 0 ? formatCurrency(lPrin) : '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', color: iAmt > 0 ? 'var(--success-text)' : 'var(--text-muted)', fontWeight: iAmt > 0 ? 600 : 400 }}>
                                    {iAmt > 0 ? formatCurrency(iAmt) : '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', color: pRepaid > 0 ? 'var(--info)' : 'var(--text-muted)', fontWeight: pRepaid > 0 ? 600 : 400 }}>
                                    {pRepaid > 0 ? formatCurrency(pRepaid) : '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: tPay > 0 ? 'var(--primary)' : 'var(--danger-text)' }}>
                                    {formatCurrency(tPay)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: outLoan > 0 ? 700 : 400, color: outLoan > 0 ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                                    {outLoan > 0 ? formatCurrency(outLoan) : '-'}
                                  </td>
                                  <td>{r.paymentDate || r.payment_date ? formatDate(r.paymentDate || r.payment_date) : '-'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: pAmt > 0 ? 700 : 400, color: pAmt > 0 ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                                    {formatCurrency(pAmt)}
                                  </td>
                                  <td>
                                    <span
                                      className={`badge ${
                                        r.status === 'PAID'
                                          ? 'badge-success'
                                          : r.status === 'PARTIAL'
                                          ? 'badge-warning'
                                          : 'badge-danger'
                                      }`}
                                      style={{ fontSize: '0.7rem' }}
                                    >
                                      {r.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#F8FAFC', fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                              <td colSpan={2} style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                                {language === 'mr' ? 'एकूण बेरीज (GRAND TOTAL)' : 'GRAND TOTAL'} ({registerList.length} {language === 'mr' ? 'सभासद' : 'Members'})
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--primary)' }}>
                                {formatCurrency(totalSavingsSum)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {totalLoanPrincipalSum > 0 ? formatCurrency(totalLoanPrincipalSum) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>
                                {totalInterestSum > 0 ? formatCurrency(totalInterestSum) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--info)' }}>
                                {totalPrincipalRepaidSum > 0 ? formatCurrency(totalPrincipalRepaidSum) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 900 }}>
                                {formatCurrency(totalPaymentSum)}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>
                                {totalOutstandingSum > 0 ? formatCurrency(totalOutstandingSum) : '-'}
                              </td>
                              <td colSpan={3} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {paidCount} {language === 'mr' ? 'जमा' : 'Paid'} • {pendingCount} {language === 'mr' ? 'शिल्लक' : 'Pending'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                        {[...(pendingData.duesList || [])].sort((a, b) => {
                          const idA = a.memberCode || a.member_code || a.memberId || a.member_id || a.id || '';
                          const idB = b.memberCode || b.member_code || b.memberId || b.member_id || b.id || '';
                          const numA = parseInt(String(idA).replace(/\D/g, ''), 10);
                          const numB = parseInt(String(idB).replace(/\D/g, ''), 10);
                          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                          if (!isNaN(numA)) return -1;
                          if (!isNaN(numB)) return 1;
                          return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
                        }).map((d) => (
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
