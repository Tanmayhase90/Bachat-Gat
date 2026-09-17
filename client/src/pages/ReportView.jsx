import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { reportService, groupService } from '../services/dashboardService';
import Loader from '../components/common/Loader';
import FinancialReportDocument from '../components/reports/FinancialReportDocument';
import {
  ArrowLeft,
  Printer,
  Download,
  Calendar,
} from 'lucide-react';

const MONTHS = [
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

const ReportView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentDate = new Date();
  const queryMonth = parseInt(searchParams.get('month'), 10) || location.state?.selectedMonth || (currentDate.getMonth() + 1);
  const queryYear = parseInt(searchParams.get('year'), 10) || location.state?.selectedYear || currentDate.getFullYear();
  const shouldAutoPrint = searchParams.get('print') === 'true' || Boolean(location.state?.autoPrint);

  const [selectedMonth, setSelectedMonth] = useState(queryMonth);
  const [selectedYear, setSelectedYear] = useState(queryYear);
  const [groupInfo, setGroupInfo] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [loansData, setLoansData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync state when URL params change
  useEffect(() => {
    const m = parseInt(searchParams.get('month'), 10);
    const y = parseInt(searchParams.get('year'), 10);
    if (m && m !== selectedMonth) setSelectedMonth(m);
    if (y && y !== selectedYear) setSelectedYear(y);
  }, [searchParams]);

  const loadReportData = async (m, y) => {
    try {
      setLoading(true);
      const [mRes, pRes, lRes, gRes] = await Promise.all([
        reportService.getMonthlyReport(m, y),
        reportService.getPendingDuesReport(m, y),
        reportService.getLoansOverviewReport(),
        groupService.getGroupDetails(),
      ]);

      if (mRes.success) setMonthlyData(mRes);
      if (pRes.success) setPendingData(pRes);
      if (lRes.success) setLoansData(lRes);
      if (gRes.success) setGroupInfo(gRes.group);
    } catch (err) {
      console.error('Failed to load comprehensive report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const executePrint = () => {
    const originalTitle = document.title;
    document.title = ' ';
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    
    window.print();
    
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  // Handle auto-print after data finishes loading
  useEffect(() => {
    if (!loading && shouldAutoPrint && monthlyData) {
      const timer = setTimeout(() => {
        executePrint();
        if (searchParams.get('print')) {
          setSearchParams({ month: selectedMonth, year: selectedYear }, { replace: true });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, shouldAutoPrint, monthlyData, selectedMonth, selectedYear]);

  const handleMonthChange = (e) => {
    const newM = parseInt(e.target.value, 10);
    setSelectedMonth(newM);
    setSearchParams({ month: newM, year: selectedYear });
  };

  const handleYearChange = (e) => {
    const newY = parseInt(e.target.value, 10);
    setSelectedYear(newY);
    setSearchParams({ month: selectedMonth, year: newY });
  };

  const handleBack = () => {
    navigate('/reports', {
      state: {
        selectedMonth,
        selectedYear,
        activeTab: 'monthly',
      },
    });
  };

  const handlePrint = () => {
    executePrint();
  };

  const handleExportCSV = () => {
    if (!monthlyData) return;
    const list = monthlyData.collections || monthlyData.savingsTransactions || [];
    if (list.length === 0) return;

    const rows = list.map((s) => ({
      MemberName: s.memberName || s.member_name,
      MemberCode: s.memberCode || s.member_code,
      ExpectedHafta: s.expected_amount || s.savingsAmount || 0,
      PaidAmount: s.paid_amount || s.amount || 0,
      Status: s.status,
      PaymentDate: s.paymentDate || s.payment_date || '-',
      PendingAmount: s.pendingAmount !== undefined ? s.pendingAmount : (((s.pendingLoan || s.outstandingLoan || 0)) + (s.pendingHafta !== undefined ? s.pendingHafta : Math.max(0, (s.expected_amount || s.savingsAmount || 0) - (s.paid_amount || s.paidAmount || 0)))),
    }));

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
    link.setAttribute('download', `Financial_Report_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fade-in report-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Top Action & Navigation Bar (Hidden during Print) */}
      <div className="no-print report-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <button
          onClick={handleBack}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.875rem' }}
        >
          <ArrowLeft size={16} /> {t('common.backToReports')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <select
              value={selectedMonth}
              onChange={handleMonthChange}
              className="form-select"
              style={{ width: '130px', fontSize: '0.85rem', padding: '4px 8px' }}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(`common.months.${m.value}`, m.label)}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={handleYearChange}
              className="form-select"
              style={{ width: '90px', fontSize: '0.85rem', padding: '4px 8px' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <button
            onClick={handlePrint}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Printer size={16} /> {t('reports.printReportBtn')}
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Download size={16} /> {t('reports.exportCSVBtn')}
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text={t('common.loadingData')} />
      ) : (
        /* Reusable, Authoritative Financial Report Document */
        <FinancialReportDocument
          groupInfo={groupInfo}
          monthlyData={monthlyData}
          pendingData={pendingData}
          loansData={loansData}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      )}
    </div>
  );
};

export default ReportView;
