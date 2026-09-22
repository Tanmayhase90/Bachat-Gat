import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { memberService } from '../services/memberService';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import RecordSavingsAndLoanModal from '../components/forms/RecordSavingsAndLoanModal';
import CreateLoanModal from '../components/forms/CreateLoanModal';
import EditMemberModal from '../components/forms/EditMemberModal';
import DeleteMemberModal from '../components/forms/DeleteMemberModal';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import {
  ArrowLeft,
  Phone,
  Calendar,
  CreditCard,
  PiggyBank,
  HandCoins,
  ShieldCheck,
  Edit2,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Save,
  MessageCircle,
} from 'lucide-react';

const MemberDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { canManageMembers, canManageSavings, canManageLoans, isAdmin } = useAuth();
  const { t, language } = useLanguage();

  const selectedMonth = location.state?.selectedMonth;
  const selectedYear = location.state?.selectedYear;

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('savings');

  // Modals state
  const [isSavingsOpen, setIsSavingsOpen] = useState(false);
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  // Role editing state
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState('MEMBER');
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchMember = async () => {
    try {
      setLoading(true);
      const res = await memberService.getMemberById(id);
      if (res.success) {
        setMember(res.member);
        setSelectedRole(res.member.role_name || 'MEMBER');
      }
    } catch (err) {
      console.error('Failed to load member:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMember();
  }, [id]);

  const handleUpdateRole = async () => {
    try {
      setUpdatingRole(true);
      const res = await memberService.updateMemberRole(member.id || member.member_id, selectedRole);
      if (res.success) {
        setIsEditingRole(false);
        fetchMember();
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDeleteMember = () => {
    setIsDeleteOpen(true);
  };

  const getRoleBadge = (role) => {
    const r = (role || 'MEMBER').toUpperCase();
    const label = t(`common.roles.${r}`, r);
    if (r === 'ADMIN') return <span className="badge badge-pink">{label}</span>;
    if (r === 'TREASURER') return <span className="badge badge-warning">{label}</span>;
    if (r === 'SECRETARY') return <span className="badge badge-info">{label}</span>;
    return <span className="badge badge-success">{label}</span>;
  };

  if (loading) return <Loader text={t('common.loadingData', 'Loading member details...')} />;
  if (!member) return <EmptyState title={t('memberDetails.memberNotFoundTitle', 'Member not found')} description={t('memberDetails.memberNotFoundDesc', 'The requested member profile could not be located.')} />;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/members', {
          state: {
            selectedMonth: selectedMonth || undefined,
            selectedYear: selectedYear || undefined,
            activeTab: location.state?.activeTab || undefined,
          },
        })}
        style={{
          background: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: '0.875rem',
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={16} /> {t('common.backToMembers', 'Back to Members')}
      </button>

      {/* Member Profile Hero Card */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF5F8 100%)',
          borderColor: 'rgba(194, 24, 91, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--primary-gradient)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.75rem',
              boxShadow: 'var(--shadow-pink)',
            }}
          >
            {member.name.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{member.name}</h1>
              <span className={`badge ${member.is_active ? 'badge-success' : 'badge-danger'}`}>
                {member.is_active ? t('common.active', 'ACTIVE') : t('common.inactive', 'INACTIVE')}
              </span>
            </div>

            {/* Role Dedicated Field */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('members.tableRole', 'Role')}:
              </span>
              {isEditingRole ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="form-select"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="MEMBER">{t('common.roles.MEMBER', 'Member')}</option>
                    <option value="TREASURER">{t('common.roles.TREASURER', 'Treasurer')}</option>
                    <option value="SECRETARY">{t('common.roles.SECRETARY', 'Secretary')}</option>
                  </select>
                  <button
                    onClick={handleUpdateRole}
                    className="btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    disabled={updatingRole}
                  >
                    <Save size={12} /> {t('common.save', 'Save')}
                  </button>
                  <button
                    onClick={() => setIsEditingRole(false)}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getRoleBadge(member.role_name)}
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditingRole(true)}
                      style={{ background: 'none', color: 'var(--primary)', padding: '2px', display: 'flex', alignItems: 'center' }}
                      title={t('memberDetails.changeRoleTooltip', 'Change user role')}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={15} color="var(--primary)" /> <code>{member.member_code}</code>
              </span>
              {member.phone && (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={15} /> {member.phone}
                  </span>
                  <a
                    href={`https://wa.me/91${member.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#25D366',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                    title={t('memberDetails.sendWhatsAppTooltip', 'Send WhatsApp message')}
                  >
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                </>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={15} /> {t('members.joiningDate')}: {formatDate(member.joined_date || member.joinDate || member.joinedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canManageSavings && (
            <button onClick={() => setIsSavingsOpen(true)} className="btn-outline">
              <PiggyBank size={16} /> {t('header.addSavings', '+ Savings')}
            </button>
          )}
          {canManageLoans && (
            <button onClick={() => setIsLoanOpen(true)} className="btn-primary">
              <HandCoins size={16} /> {t('header.addLoan', '+ Loan')}
            </button>
          )}
          {canManageMembers && (
            <button onClick={() => setIsEditMemberOpen(true)} className="btn-outline">
              <Edit2 size={16} /> {t('members.editMember', 'Edit Member')}
            </button>
          )}
          {canManageMembers && (
            <button
              onClick={handleDeleteMember}
              className="btn-outline"
              style={{ color: 'var(--danger-text)', borderColor: 'var(--danger)' }}
            >
              <Trash2 size={16} /> {t('memberDetails.deleteMemberBtn', 'Delete Member Account')}
            </button>
          )}
        </div>
      </div>

      {/* Portfolio Metric Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('members.lifetimeSavings', 'TOTAL ACCUMULATED SAVINGS')}
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
            {formatCurrency(member.totalSavings || member.total_savings)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {formatCurrency(member.monthlyContribution || member.monthly_contribution)} {t('members.tableMonthlyShare', 'monthly share')}
          </span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('members.activeLoanAmount', 'ACTIVE LOAN OUTSTANDING')}
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (member.totalOutstanding || member.total_outstanding) > 0 ? 'var(--danger-text)' : 'var(--text-primary)', marginTop: '4px' }}>
            {formatCurrency(member.totalOutstanding || member.total_outstanding)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {(member.loans || []).filter((l) => l.status === 'ACTIVE').length} {t('loans.activeLoansTab', 'active loan(s)')}
          </span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('loans.summaryTotalDisbursed', 'TOTAL LOANS ISSUED')}
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {(member.loans || []).length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {(member.loans || []).filter((l) => l.status === 'CLOSED').length} {t('loans.closedLoansTab', 'closed')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab('savings')}
          className={`tab-btn ${activeTab === 'savings' ? 'active' : ''}`}
        >
          <PiggyBank size={18} /> {t('members.savingsHistory', 'Savings History')} ({(member.savingsHistory || []).length})
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          className={`tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
        >
          <HandCoins size={18} /> {t('members.loansHistory', 'Loans')} ({(member.loans || []).length})
        </button>

        <button
          onClick={() => setActiveTab('repayments')}
          className={`tab-btn ${activeTab === 'repayments' ? 'active' : ''}`}
        >
          <CreditCard size={18} /> {t('members.repaymentsHistory', 'Loan Repayments')} ({(member.repayments || []).length})
        </button>
      </div>

      {/* Tab 1: Savings History */}
      {activeTab === 'savings' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem' }}>{t('memberDetails.monthlySavingsRecords', 'Monthly Savings Records')}</h2>
            {canManageSavings && (
              <button onClick={() => setIsSavingsOpen(true)} className="btn-outline" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                <Plus size={14} /> {t('memberDetails.addEntry', 'Add Entry')}
              </button>
            )}
          </div>

          {(!member.savingsHistory || member.savingsHistory.length === 0) ? (
            <EmptyState
              icon={PiggyBank}
              title={t('memberDetails.noSavingsYet', 'No savings recorded yet')}
              description={t('memberDetails.noSavingsDesc', 'No monthly contribution records exist for this member.')}
            />
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{t('memberDetails.monthYear', 'Month / Year')}</th>
                    <th>{t('memberDetails.amount', 'Amount')}</th>
                    <th>{t('memberDetails.paymentDate', 'Payment Date')}</th>
                    <th>{t('memberDetails.paymentMode', 'Payment Mode')}</th>
                    <th>{t('memberDetails.remarks', 'Remarks')}</th>
                    <th>{t('memberDetails.recordedBy', 'Recorded By')}</th>
                  </tr>
                </thead>
                <tbody>
                  {member.savingsHistory.map((s) => (
                    <tr key={s.id || s.saving_id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {formatMonthYear(s.month, s.year, language)}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--success-text)' }}>{formatCurrency(s.amount)}</td>
                      <td>{formatDate(s.payment_date || s.paymentDate)}</td>
                      <td><span className="badge badge-info">{s.payment_mode || s.paymentMode || 'UPI'}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.remarks || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.recorded_by_name || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Loans */}
      {activeTab === 'loans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(!member.loans || member.loans.length === 0) ? (
            <div className="card">
              <EmptyState
                icon={HandCoins}
                title={t('memberDetails.noLoansYet', 'No loans on record')}
                description={t('memberDetails.noLoansDesc', 'This member has not taken any loans from the group.')}
              />
            </div>
          ) : (
            member.loans.map((loan) => (
              <div key={loan.id || loan.loan_id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.1rem' }}>
                        {t('loanDetails.loanNumber', { num: loan.loan_number || loan.loanNumber })}
                      </h3>
                      <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-warning' : 'badge-success'}`}>
                        {loan.status === 'ACTIVE' ? t('common.active', 'ACTIVE') : t('common.closed', 'CLOSED')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t('loanDetails.disbursed', { date: formatDate(loan.loan_date || loan.loanDate) })} • {t('loanDetails.purpose', { purpose: loan.purpose || 'General' })}
                    </div>
                  </div>

                  {canManageLoans && loan.status === 'ACTIVE' && (
                    <button
                      onClick={() => {
                        setSelectedLoanId(loan.id || loan.loan_id);
                        setIsRepayOpen(true);
                      }}
                      className="btn-primary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      <CreditCard size={14} /> {t('memberDetails.recordPayment', 'Record Payment')}
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: '#F8FAFC', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {t('memberDetails.principal', 'PRINCIPAL')}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{formatCurrency(loan.principal_amount || loan.principalAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {t('memberDetails.interestRate', 'INTEREST RATE')}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--info)' }}>
                      {loan.interest_rate || loan.interestRate || 2}% / {language === 'mr' ? 'महिना' : 'mo'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {t('memberDetails.principalRepaid', 'PRINCIPAL REPAID')}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success-text)' }}>{formatCurrency(loan.total_principal_paid)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {t('memberDetails.outstanding', 'OUTSTANDING')}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: loan.status === 'ACTIVE' ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                      {formatCurrency(loan.outstanding_amount || loan.outstandingAmount)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Repayments */}
      {activeTab === 'repayments' && (
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>
            {t('memberDetails.loanRepaymentsTransactions', 'Loan Repayment Transactions')}
          </h2>
          {(!member.repayments || member.repayments.length === 0) ? (
            <EmptyState
              icon={CreditCard}
              title={t('memberDetails.noRepaymentsYet', 'No repayments found')}
              description={t('memberDetails.noRepaymentsDesc', 'No repayment transactions recorded for this member.')}
            />
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{t('memberDetails.loanNo', 'Loan No')}</th>
                    <th>{t('memberDetails.monthYear', 'Month/Year')}</th>
                    <th>{t('memberDetails.principalRepaid', 'Principal Repaid')}</th>
                    <th>{t('loanDetails.tableInterestPaid', 'Interest Paid')}</th>
                    <th>{t('memberDetails.totalPaid', 'Total Paid')}</th>
                    <th>{t('memberDetails.date', 'Date')}</th>
                    <th>{t('memberDetails.mode', 'Mode')}</th>
                    <th>{t('memberDetails.recordedBy', 'Recorded By')}</th>
                  </tr>
                </thead>
                <tbody>
                  {member.repayments.map((r) => (
                    <tr key={r.id || r.repayment_id}>
                      <td style={{ fontWeight: 700 }}>{r.loan_number || r.loanNumber}</td>
                      <td>{r.payment_month || r.month}/{r.payment_year || r.year}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(r.principal_repayment_amount)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(r.interest_amount)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--success-text)' }}>{formatCurrency(r.total_payment)}</td>
                      <td>{formatDate(r.payment_date || r.paymentDate)}</td>
                      <td><span className="badge badge-info">{r.payment_mode || r.paymentMode || 'UPI'}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.recorded_by_name || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unified Recording Modals */}
      <RecordSavingsAndLoanModal
        key={`member-details-savings-modal-${id}-${selectedMonth || ''}-${selectedYear || ''}-${isSavingsOpen}`}
        isOpen={isSavingsOpen}
        onClose={() => setIsSavingsOpen(false)}
        onSuccess={fetchMember}
        initialMemberId={id}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
        initialMode="savings"
      />

      <CreateLoanModal
        isOpen={isLoanOpen}
        onClose={() => setIsLoanOpen(false)}
        onSuccess={fetchMember}
        initialMemberId={id}
      />

      <RecordSavingsAndLoanModal
        key={`member-details-repay-modal-${id}-${selectedLoanId || ''}-${isRepayOpen}`}
        isOpen={isRepayOpen}
        onClose={() => {
          setIsRepayOpen(false);
          setSelectedLoanId(null);
        }}
        onSuccess={fetchMember}
        initialMemberId={id}
        initialLoanId={selectedLoanId}
        initialMode="loan"
      />

      <EditMemberModal
        isOpen={isEditMemberOpen}
        onClose={() => setIsEditMemberOpen(false)}
        onSuccess={fetchMember}
        member={member}
      />

      <DeleteMemberModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        member={member}
        onSuccess={() => navigate('/members')}
      />
    </div>
  );
};

export default MemberDetails;
