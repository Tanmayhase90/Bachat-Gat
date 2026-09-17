import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dashboardService } from '../services/dashboardService';
import StatCard from '../components/common/StatCard';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import { formatCurrency, formatNumber, formatDate, formatMonthYear, formatPercentage, formatMonthlyHaftaDueDate } from '../utils/formatters';
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
  ArrowDownLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Search,
  Filter,
  Check,
  X,
} from 'lucide-react';

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'monthlyInvestment', label: 'monthlyInvestment' },
  { value: 'loanIssue', label: 'loanIssue' },
  { value: 'loanRepayment', label: 'loanRepayment' },
  { value: 'interestPayment', label: 'interestPayment' },
  { value: 'adjustment', label: 'adjustment' },
  { value: 'otherIncome', label: 'otherIncome' },
  { value: 'otherExpense', label: 'otherExpense' },
];

const matchesTransactionType = (act, filterType) => {
  if (!filterType || filterType === 'All') return true;

  const rawType = (act?.type || '').toUpperCase().trim();
  const desc = (act?.description || '').toLowerCase();
  const id = (act?.id || '').toLowerCase();

  switch (filterType) {
    case 'monthlyInvestment':
      return (
        rawType === 'SAVING' ||
        rawType === 'SAVINGS' ||
        rawType === 'MONTHLYINVESTMENT' ||
        rawType === 'MONTHLY_INVESTMENT' ||
        rawType === 'MONTHLY_CONTRIBUTION' ||
        rawType === 'INVESTMENT' ||
        id.includes('saving') ||
        desc.includes('monthly savings') ||
        desc.includes('मासिक बचत') ||
        desc.includes('monthly contribution') ||
        desc.includes('monthly investment') ||
        desc.includes('बचत जमा')
      );

    case 'loanIssue':
      return (
        rawType === 'LOAN' ||
        rawType === 'LOAN_ISSUE' ||
        rawType === 'LOANISSUE' ||
        rawType === 'DISBURSEMENT' ||
        rawType === 'LOAN_DISBURSEMENT' ||
        id.includes('_loan') ||
        desc.includes('loan approved') ||
        desc.includes('loan of') ||
        desc.includes('loan disbursed') ||
        desc.includes('loan issue') ||
        desc.includes('कर्ज वितरित') ||
        desc.includes('कर्ज वाटप') ||
        desc.includes('कर्ज मंजूर')
      );

    case 'loanRepayment':
      return (
        rawType === 'REPAYMENT' ||
        rawType === 'LOAN_REPAYMENT' ||
        rawType === 'LOANREPAYMENT' ||
        rawType === 'PRINCIPAL_REPAYMENT' ||
        id.includes('_repay') ||
        desc.includes('loan repayment') ||
        desc.includes('repayment') ||
        desc.includes('repaid') ||
        desc.includes('मुद्दल परतफेड') ||
        desc.includes('कर्ज परतफेड')
      );

    case 'interestPayment':
      return (
        rawType === 'INTEREST' ||
        rawType === 'INTEREST_PAYMENT' ||
        rawType === 'INTERESTPAYMENT' ||
        id.includes('interest') ||
        desc.includes('interest payment') ||
        desc.includes('interest paid') ||
        desc.includes('व्याज जमा') ||
        desc.includes('व्याज भरणा') ||
        (desc.includes('interest') && !desc.includes('repayment'))
      );

    case 'adjustment':
      return (
        rawType === 'ADJUSTMENT' ||
        rawType.includes('MEMBER') ||
        rawType.includes('DELETE') ||
        rawType.includes('DELETED') ||
        rawType.includes('UPDATE') ||
        rawType.includes('PROFILE') ||
        id.includes('_edit') ||
        id.includes('_upd') ||
        id.includes('_del') ||
        desc.includes('updated') ||
        desc.includes('deleted') ||
        desc.includes('added') ||
        desc.includes('adjustment') ||
        desc.includes('समायोजन') ||
        desc.includes('बदल') ||
        desc.includes('हटवला') ||
        desc.includes('हटवले') ||
        desc.includes('नोंदणी')
      );

    case 'otherIncome':
      return (
        rawType === 'OTHER_INCOME' ||
        rawType === 'OTHERINCOME' ||
        rawType === 'INCOME' ||
        rawType === 'PENALTY' ||
        rawType === 'FINE' ||
        rawType === 'DONATION' ||
        desc.includes('other income') ||
        desc.includes('penalty') ||
        desc.includes('fine') ||
        desc.includes('donation') ||
        desc.includes('इतर जमा') ||
        desc.includes('दंड')
      );

    case 'otherExpense':
      return (
        rawType === 'OTHER_EXPENSE' ||
        rawType === 'OTHEREXPENSE' ||
        rawType === 'EXPENSE' ||
        rawType === 'WITHDRAWAL' ||
        desc.includes('other expense') ||
        desc.includes('expense') ||
        desc.includes('withdrawal') ||
        desc.includes('withdrawn') ||
        desc.includes('इतर खर्च') ||
        desc.includes('खर्च')
      );

    default:
      return true;
  }
};

const Dashboard = () => {
  const { user, groupName, isAdmin, isMember, monthlyHaftaDay } = useAuth();
  const { t, getGroupName, language } = useLanguage();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { refreshTrigger = 0, openAddMember, openRecordSavings, openCreateLoan, openRecordRepayment } = outletContext;

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [summary, setSummary] = useState(null);
  const [memberSummary, setMemberSummary] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAllActivitiesModalOpen, setIsAllActivitiesModalOpen] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [loadingAllActivities, setLoadingAllActivities] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const memberLookupId = user?.memberId || user?.uid || '';
      const [sumRes, progRes, actRes] = await Promise.allSettled([
        dashboardService.getSummary('chhatrapati_group_001', memberLookupId),
        dashboardService.getMonthlyProgress(selectedMonth, selectedYear, 'chhatrapati_group_001'),
        dashboardService.getRecentActivities(8, 'chhatrapati_group_001'),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
        setSummary(sumRes.value.summary || null);
        setMemberSummary(sumRes.value.memberSummary || null);
      }
      if (progRes.status === 'fulfilled' && progRes.value?.success) {
        setProgress(progRes.value.progress || null);
      }
      if (actRes.status === 'fulfilled' && actRes.value?.success) {
        setActivities(actRes.value.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let isInitialSnapshot = true;

    fetchDashboardData();

    // Set up real-time listener for instant sync with Flutter Mobile app
    const memberLookupId = user?.memberId || user?.uid || '';
    const unsubscribe = dashboardService.subscribeToDashboard('chhatrapati_group_001', memberLookupId, (liveData) => {
      if (!isMounted) return;
      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        return; // Initial load is handled cleanly by fetchDashboardData
      }
      if (liveData?.summary) {
        setSummary(liveData.summary);
        if (liveData.memberSummary) setMemberSummary(liveData.memberSummary);
      }
      dashboardService.getMonthlyProgress(selectedMonth, selectedYear, 'chhatrapati_group_001').then((pRes) => {
        if (isMounted && pRes?.success && pRes.progress) {
          setProgress(pRes.progress);
        }
      });
      dashboardService.getRecentActivities(8, 'chhatrapati_group_001').then((aRes) => {
        if (isMounted && aRes?.success && aRes.activities) {
          setActivities(aRes.activities);
        }
      });
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [refreshTrigger, selectedMonth, selectedYear, user?.uid, user?.memberId]);

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

  if (loading && !summary) {
    return <Loader text={t('common.loadingData')} />;
  }

  const safeTotalGroupFund = summary?.totalGroupFund ?? 0;
  const safeTotalSavings = summary?.totalSavings ?? 0;
  const safeActiveLoans = summary?.activeLoans ?? 0;
  const safeActiveLoansCount = summary?.activeLoansCount ?? 0;
  const safeTotalInterest = summary?.totalInterest ?? 0;
  const safeAvailableBalance = summary?.availableBalance ?? 0;
  const pendingCount = progress?.pendingMembersCount !== undefined
    ? progress.pendingMembersCount
    : (Array.isArray(progress?.pendingMembers) ? progress.pendingMembers.length : 0);
  const paidCount = progress?.paidMembers !== undefined
    ? progress.paidMembers
    : (progress?.membersPaid || 0);
  const totalCount = progress?.totalMembers !== undefined
    ? progress.totalMembers
    : (progress?.totalActiveMembers || 0);
  const expectedPendingAmount = progress?.expectedPending ?? progress?.expectedPendingAmount ?? (pendingCount * (progress?.monthlyShare || 1000));
  const effectiveDueDay = summary?.monthly_hafta_day ?? summary?.monthlyHaftaDay ?? progress?.monthly_hafta_day ?? progress?.monthlyHaftaDay ?? monthlyHaftaDay ?? 10;

  const openPendingReport = () => {
    navigate('/members', {
      state: {
        activeTab: 'pending',
        selectedMonth,
        selectedYear,
      },
    });
  };

  const handleOpenAllActivities = async () => {
    setIsAllActivitiesModalOpen(true);
    setSelectedTypeFilter('All');
    setIsFilterDropdownOpen(false);
    setActivitySearch('');
    setLoadingAllActivities(true);
    try {
      const res = await dashboardService.getRecentActivities(100, 'chhatrapati_group_001');
      if (res?.success && res.activities) {
        setAllActivities(res.activities);
      }
    } catch (err) {
      console.error('Failed to load all activities:', err);
    } finally {
      setLoadingAllActivities(false);
    }
  };

  const handleCloseAllActivities = () => {
    setIsAllActivitiesModalOpen(false);
    setActivitySearch('');
    setSelectedTypeFilter('All');
    setIsFilterDropdownOpen(false);
  };

  const renderActivityItem = (act) => {
    const type = (act.type || '').toUpperCase();
    const desc = (act.description || '').toLowerCase();
    const isPaidOut =
      type === 'LOAN' ||
      type === 'DISBURSEMENT' ||
      type === 'WITHDRAWAL' ||
      type === 'EXPENSE' ||
      type.includes('DELETE') ||
      type.includes('DELETED') ||
      desc.includes('loan approved') ||
      desc.includes('loan of') ||
      desc.includes('withdrawn') ||
      desc.includes('disbursed') ||
      desc.includes('deleted') ||
      desc.includes('कायमचा हटवला') ||
      desc.includes('हटवला');

    let amount = Number(act.amount || 0);
    if (!amount && act.description) {
      const match = act.description.match(/₹\s*([\d,]+)/);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) amount = parsed;
      }
    }

    const isMarathi = language === 'mr';
    const displayText = (() => {
      let memberName = (act.memberName || act.member_name || '').trim();
      const rawDesc = act.description || '';
      const lowerDesc = rawDesc.toLowerCase();
      const amtStr = amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : '';

      // 1. Member Permanent Deletion
      const isDeletion =
        type.includes('DELETE') ||
        type.includes('DELETED') ||
        type === 'MEMBER_DELETED' ||
        type === 'DELETE_MEMBER' ||
        type === 'MEMBER_DELETION' ||
        lowerDesc.includes('permanently deleted') ||
        lowerDesc.includes('deleted') ||
        lowerDesc.includes('कायमचा हटवला') ||
        lowerDesc.includes('हटवला') ||
        lowerDesc.includes('हटवले');

      if (isDeletion) {
        let resolvedName = memberName;
        if (!resolvedName && rawDesc) {
          const match = rawDesc.match(/(?:deleted|हटवला|हटवले)[:\s-]+(.+)$/i);
          if (match && match[1]) {
            resolvedName = match[1].replace(/\(.*\)/, '').trim();
          }
        }
        if (!resolvedName) resolvedName = 'Member';

        return isMarathi
          ? `सभासद कायमचा हटवला: ${resolvedName}`
          : `Member permanently deleted: ${resolvedName}`;
      }

      if (!memberName && rawDesc) {
        const match = rawDesc.match(/received from\s+([^—–-]+)/i) || rawDesc.match(/मिळाले\s*-\s*([^—–-]+)/i);
        if (match && match[1]) {
          memberName = match[1].trim();
        }
      }

      // 2. Monthly Savings
      if (type === 'SAVING' || type === 'SAVINGS' || type === 'MONTHLYINVESTMENT' || lowerDesc.includes('मासिक बचत') || lowerDesc.includes('saving') || lowerDesc.includes('monthly contribution')) {
        let m = act.month;
        let y = act.year;

        if ((!m || !y) && (act.id || act.referenceId)) {
          const match = (String(act.id || '') + ' ' + String(act.referenceId || '')).match(/_(\d{4})_(\d{1,2})/);
          if (match) {
            y = parseInt(match[1], 10);
            m = parseInt(match[2], 10);
          }
        }

        if ((!m || !y) && rawDesc) {
          const yearMatch = rawDesc.match(/\b(20\d{2})\b/);
          if (yearMatch) {
            y = parseInt(yearMatch[1], 10);
            const enMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            const mrMonths = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
            for (let i = 0; i < 12; i++) {
              if (lowerDesc.includes(enMonths[i]) || rawDesc.includes(mrMonths[i])) {
                m = i + 1;
                break;
              }
            }
          }
        }

        let periodStr = '';
        if (m !== undefined && m !== null && y) {
          periodStr = formatMonthYear(m, y, isMarathi ? 'mr' : 'en');
        }

        let formattedMember = memberName;
        if (formattedMember && formattedMember.toLowerCase() !== 'member') {
          formattedMember = formattedMember.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
        }

        if (isMarathi) {
          let msg = 'मासिक बचत';
          if (amtStr) msg += ` ${amtStr}`;
          msg += ' मिळाले';
          if (formattedMember && formattedMember.toLowerCase() !== 'member') {
            msg += ` - ${formattedMember}`;
          }
          if (periodStr) {
            msg += ` — ${periodStr}`;
          }
          return msg;
        } else {
          let msg = 'Monthly savings';
          if (amtStr) msg += ` ${amtStr}`;
          msg += ' received';
          if (formattedMember && formattedMember.toLowerCase() !== 'member') {
            msg += ` from ${formattedMember}`;
          }
          if (periodStr) {
            msg += ` — ${periodStr}`;
          }
          return msg;
        }
      }

      if (memberName) {

        // 3. Loan Disbursement
        if (type === 'LOAN' || type === 'DISBURSEMENT' || lowerDesc.includes('loan approved') || lowerDesc.includes('loan of') || lowerDesc.includes('कर्ज') || lowerDesc.includes('disbursed')) {
          return isMarathi
            ? (amtStr ? `कर्ज ${amtStr} वितरित - ${memberName}` : `कर्ज वितरित - ${memberName}`)
            : (amtStr ? `Loan of ${amtStr} disbursed - ${memberName}` : `Loan disbursed - ${memberName}`);
        }

        // 4. Loan Repayment
        if (type === 'REPAYMENT' || type === 'LOAN_REPAYMENT' || lowerDesc.includes('repay') || lowerDesc.includes('परतफेड')) {
          return isMarathi
            ? (amtStr ? `कर्ज परतफेड ${amtStr} मिळाले - ${memberName}` : `कर्ज परतफेड मिळाले - ${memberName}`)
            : (amtStr ? `Loan repayment ${amtStr} received - ${memberName}` : `Loan repayment received - ${memberName}`);
        }

        // 5. Member Registration / Login
        if (type.includes('MEMBER') || type.includes('LOGIN') || type.includes('REGISTER') || lowerDesc.includes('सभासद नोंदणी') || lowerDesc.includes('नोंदणी') || lowerDesc.includes('registration') || lowerDesc.includes('registered') || lowerDesc.includes('member login') || lowerDesc.includes('login')) {
          return isMarathi
            ? `नवीन सभासद नोंदणी - ${memberName}`
            : `New member registered - ${memberName}`;
        }

        // 6. Generic activity with memberName
        if (!rawDesc.includes(memberName)) {
          return `${rawDesc} - ${memberName}`;
        }
      }

      return rawDesc;
    })();

    return (
      <div
        key={act.id}
        style={{
          display: 'flex',
          alignItems: 'center',
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
            background: isPaidOut ? 'var(--danger-light)' : 'var(--success-light)',
            color: isPaidOut ? 'var(--danger-text)' : 'var(--success-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isPaidOut ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="activity-description" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {displayText}
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formatDate(act.created_at || act.date, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        {amount > 0 && (
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: isPaidOut ? 'var(--danger-text)' : 'var(--success-text)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              textAlign: 'right',
              marginLeft: '8px',
            }}
          >
            {isPaidOut ? `- ${formatCurrency(amount)}` : `+ ${formatCurrency(amount)}`}
          </div>
        )}
      </div>
    );
  };

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
            <ShieldCheck size={14} /> {getGroupName(groupName || user?.groupName || summary?.groupName).toUpperCase()}
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: '2.25rem', fontWeight: 800, marginBottom: '4px' }}>
            {formatCurrency(safeTotalGroupFund)}
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem' }}>
            {t('dashboard.totalGroupFund')} ({t('dashboard.totalSavings')} {formatCurrency(safeTotalSavings)} + {t('reports.totalInterestAccrued')} {formatCurrency(safeTotalInterest)})
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
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>{t('dashboard.availableBalance').toUpperCase()}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF' }}>
              {formatCurrency(safeAvailableBalance)}
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
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>{t('dashboard.activeLoans').toUpperCase()}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF' }}>
              {formatCurrency(safeActiveLoans)}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          title={t('dashboard.totalSavings')}
          value={formatCurrency(safeTotalSavings)}
          subtitle={t('dashboard.totalSavingsSub')}
          icon={PiggyBank}
          colorScheme="pink"
        />
        <StatCard
          title={t('dashboard.activeLoans')}
          value={formatCurrency(safeActiveLoans)}
          subtitle={t('dashboard.activeLoansSub')}
          icon={HandCoins}
          colorScheme="amber"
        />
        <StatCard
          title={t('loans.summaryInterestEarned')}
          value={formatCurrency(safeTotalInterest)}
          subtitle={t('loans.tableMonthlyInterest')}
          icon={TrendingUp}
          colorScheme="purple"
        />
        <StatCard
          title={t('dashboard.availableBalance')}
          value={formatCurrency(safeAvailableBalance)}
          subtitle={t('dashboard.availableBalanceSub')}
          icon={Wallet}
          colorScheme="green"
          highlight
        />
      </div>

      {/* QUICK ACTIONS SECTION */}
      <div>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px' }}>{t('dashboard.quickActionsTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div
            className="card keyboard-card"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/members')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/members');
              }
            }}
            aria-label="Open members"
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('nav.members')}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{t('members.subtitle')}</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>

          <div
            className="card keyboard-card"
            role="button"
            tabIndex={0}
            onClick={openRecordSavings}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openRecordSavings();
              }
            }}
            aria-label="Add monthly savings"
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('dashboard.recordSavings')}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{t('savings.subtitle')}</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>

          <div
            className="card keyboard-card"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/loans')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/loans');
              }
            }}
            aria-label="Open loans and repayments"
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('nav.loansAndRepayments')}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{t('loans.subtitle')}</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>

          <div
            className="card keyboard-card"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/reports')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/reports');
              }
            }}
            aria-label="Open reports"
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('nav.reports')}</div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{t('reports.subtitle')}</div>
            </div>
            <ArrowUpRight size={18} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* MONTHLY SAVINGS PROGRESS & RECENT ACTIVITY GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="dash-two-col">
        {/* Monthly Savings Progress Card */}
        <div className="card dashboard-progress-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem' }}>{t('dashboard.monthlyProgress')}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('dashboard.monthlyProgressSub')}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-soft)',
                      border: '1px solid rgba(236, 72, 153, 0.2)',
                      color: 'var(--primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={12} />
                    {formatMonthlyHaftaDueDate(effectiveDueDay, language)}
                  </span>
                </div>
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('dashboard.collectedAmount')}</span>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {formatCurrency(progress.targetAmount || progress.monthlyTarget ? Math.min(progress.collectedAmount, (progress.targetAmount || progress.monthlyTarget)) : progress.collectedAmount)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('dashboard.monthlyTarget')}</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {formatCurrency(progress.targetAmount || progress.monthlyTarget)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '12px', background: '#F1F5F9', borderRadius: 'var(--radius-full)', overflow: 'hidden', margin: '14px 0' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progress.progressPercentage || 0}%`,
                      background: 'var(--primary-gradient)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--primary)' }}>{progress.progressPercentage || 0}% {t('dashboard.completed')}</span>
                  <span style={{ color: (progress.pendingMembersCount > 0) ? 'var(--danger)' : 'var(--success)' }}>
                    {progress.pendingMembersCount || 0} {t('dashboard.pendingMembers')}
                  </span>
                </div>

                {/* Pending Collections or All Paid State */}
                {pendingCount > 0 ? (
                  <div style={{ marginTop: '18px', background: '#FFF5F8', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(194, 24, 91, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#FFFFFF', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.18)' }}>
                          <AlertCircle size={17} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>{t('members.pendingDuesTab')}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>Expected: {formatCurrency(expectedPendingAmount)}</div>
                        </div>
                      </div>
                      <span className="badge badge-danger">{pendingCount} {t('common.pending')}</span>
                    </div>

                    <div className="progress-members-grid">
                      <div className="progress-member-stat">
                        <span>{t('common.paid')}</span>
                        <strong style={{ color: 'var(--success-text)' }}>{paidCount}</strong>
                      </div>
                      <div className="progress-member-stat">
                        <span>{t('common.pending')}</span>
                        <strong style={{ color: 'var(--danger-text)' }}>{pendingCount}</strong>
                      </div>
                      <div className="progress-member-stat">
                        <span>{t('common.total')}</span>
                        <strong>{totalCount}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={openPendingReport}
                      style={{ width: '100%', marginTop: '12px', padding: '8px 14px' }}
                    >
                      {t('dashboard.viewPendingList')} <ChevronRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '18px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--success-light)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.85rem' }}>
                    <CheckCircle2 size={18} /> {t('dashboard.allMembersPaid')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="card dashboard-activity-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{t('dashboard.recentActivity')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleOpenAllActivities}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{t('common.viewAll', 'View All')}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {(!activities || activities.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('dashboard.noRecentActivity')}
              </div>
            ) : (
              activities.map((act) => renderActivityItem(act))
            )}
          </div>
        </div>
      </div>

      {/* All Recent Transactions & Activity Modal */}
      <Modal
        isOpen={isAllActivitiesModalOpen}
        onClose={handleCloseAllActivities}
        title={t('dashboard.recentActivity', 'Recent Transactions & Activity')}
        maxWidth="680px"
        headerAction={
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
              aria-label="Filter transactions by type"
              title="Filter by transaction type"
              style={{
                background: selectedTypeFilter !== 'All' ? 'var(--accent-soft)' : '#FFFFFF',
                border: selectedTypeFilter !== 'All' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                color: selectedTypeFilter !== 'All' ? 'var(--primary)' : 'var(--text-secondary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <Filter size={15} />
              {selectedTypeFilter !== 'All' ? (
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  {selectedTypeFilter}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Filter
                </span>
              )}
            </button>

            {isFilterDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  minWidth: '200px',
                  padding: '4px 0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  Transaction Type
                </div>
                {TRANSACTION_TYPE_OPTIONS.map((opt) => {
                  const isSelected = selectedTypeFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedTypeFilter(opt.value);
                        setIsFilterDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        textAlign: 'left',
                        background: isSelected ? 'var(--accent-soft)' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                        border: 'none',
                        fontSize: '0.825rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>{opt.value}</span>
                      {isSelected && <Check size={14} color="var(--primary)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        }
        footer={
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCloseAllActivities}
          >
            {t('common.close', 'Close')}
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search bar inside modal */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder={t('common.search', 'Search...')}
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '0.875rem' }}
            />
          </div>

          {/* Active filter badge if not 'All' */}
          {selectedTypeFilter !== 'All' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Filter: <strong style={{ color: 'var(--primary)' }}>{selectedTypeFilter}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('All')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={13} /> Reset Filter
              </button>
            </div>
          )}

          {loadingAllActivities ? (
            <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
              <Loader inline text={t('common.loadingData', 'Loading data...')} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {(() => {
                const listToDisplay = allActivities.length > 0 ? allActivities : activities;
                const filtered = listToDisplay.filter((act) => {
                  if (!matchesTransactionType(act, selectedTypeFilter)) {
                    return false;
                  }
                  if (!activitySearch.trim()) return true;
                  const q = activitySearch.toLowerCase().trim();
                  const desc = (act.description || '').toLowerCase();
                  const name = (act.memberName || act.member_name || '').toLowerCase();
                  const type = (act.type || '').toLowerCase();
                  return desc.includes(q) || name.includes(q) || type.includes(q);
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {activitySearch || selectedTypeFilter !== 'All' ? t('common.noDataFound', 'No data found') : t('dashboard.noRecentActivity', 'No recent transactions recorded yet')}
                    </div>
                  );
                }

                return filtered.map((act) => renderActivityItem(act));
              })()}
            </div>
          )}
        </div>
      </Modal>

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
