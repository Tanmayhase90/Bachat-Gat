import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { loanService } from '../../services/loanService';
import { savingsService } from '../../services/savingsService';
import { formatCurrency } from '../../utils/formatters';
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  DollarSign,
  ShieldAlert,
  Loader2,
  Receipt,
  PiggyBank,
  Check,
} from 'lucide-react';

const DeleteMemberModal = ({ isOpen, onClose, member, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [balanceData, setBalanceData] = useState(null);

  const fetchBalance = async () => {
    if (!member?.id && !member?.member_id) return;
    const memberId = member.id || member.member_id;
    try {
      setLoading(true);
      setError('');
      const data = await memberService.getMemberFinancialBalance(memberId);
      setBalanceData(data);
    } catch (err) {
      console.error('Failed to load member financial balance:', err);
      setError(err.message || 'Failed to calculate account balance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && member) {
      setError('');
      setSuccessMsg('');
      fetchBalance();
    } else {
      setBalanceData(null);
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, member]);

  const handleSettleDues = async () => {
    if (!balanceData) return;
    const memberId = member.id || member.member_id;
    try {
      setProcessingPayment(true);
      setError('');
      setSuccessMsg('');

      // 1. Settle all active loans
      if (balanceData.activeLoans && balanceData.activeLoans.length > 0) {
        for (const loan of balanceData.activeLoans) {
          const principalToPay = Number(loan.pendingPrincipal !== undefined ? loan.pendingPrincipal : (loan.outstandingAmount || 0));
          if (principalToPay > 0) {
            await loanService.recordRepayment({
              loan_id: loan.id || loan.loan_id,
              principal_repayment_amount: principalToPay,
              payment_mode: 'CASH',
              remarks: 'Settlement before member deletion',
              payment_date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      // 2. Settle pending monthly savings if any
      if (balanceData.pendingSavings > 0) {
        const currentDate = new Date();
        await savingsService.recordSavings({
          member_id: memberId,
          amount: balanceData.pendingSavings,
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          payment_mode: 'CASH',
          remarks: 'Settlement before member deletion',
          payment_date: currentDate.toISOString().split('T')[0],
        });
      }

      setSuccessMsg('All dues settled successfully! Account balance is now clear. Please review and confirm final deletion.');
      // Refresh balance data (do NOT automatically delete)
      await fetchBalance();
    } catch (err) {
      console.error('Failed to settle dues:', err);
      setError(err.message || 'Failed to settle remaining dues.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!balanceData?.isClear) {
      setError('Cannot delete member: Outstanding dues must be settled first.');
      return;
    }
    const memberId = member.id || member.member_id;
    try {
      setDeleting(true);
      setError('');
      const res = await memberService.deleteMember(memberId);
      if (res.success) {
        if (onSuccess) {
          onSuccess(memberId);
        }
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete member:', err);
      setError(err.message || 'Failed to delete member.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const memberName = member?.name || member?.fullName || 'Member';
  const memberCode = member?.memberCode || member?.member_code || member?.id;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Member Account"
      maxWidth="560px"
      dialogStyle={{ maxHeight: 'min(calc(100dvh - 100px), calc(100vh - 100px), 70vh)' }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={processingPayment || deleting}
            style={{ padding: '10px 18px', fontSize: '0.875rem' }}
          >
            Cancel / Close
          </button>
          {balanceData && !balanceData.isClear && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSettleDues}
              disabled={processingPayment}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {processingPayment ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  <span>Settling All Dues...</span>
                </>
              ) : (
                <>
                  <Receipt size={16} />
                  <span>Collect & Settle Remaining Dues ({formatCurrency(balanceData.totalPayable)})</span>
                </>
              )}
            </button>
          )}
          {balanceData && balanceData.isClear && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDelete}
              disabled={deleting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  <span>Deleting Member Permanently...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Confirm & Delete Member Permanently</span>
                </>
              )}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            {memberName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{memberName}</h4>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Member Code: <strong style={{ color: 'var(--text-primary)' }}>{memberCode}</strong>
            </span>
          </div>
        </div>

        {/* Error / Success Messages */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: 'var(--danger)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: 'var(--success)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Loader2 className="spinner" size={32} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Calculating real-time financial balance...
            </p>
          </div>
        ) : balanceData ? (
          <>
            {/* Case 1: Member has outstanding balance */}
            {!balanceData.isClear ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    color: '#d97706',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Action Blocked: Outstanding Dues Exist</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.84rem' }}>
                      This member has unpaid financial obligations. In accordance with Bachat Gat rules, all loan principal, interest, and pending monthly savings must be settled before the account can be deleted.
                    </p>
                  </div>
                </div>

                {/* Financial Balance Breakdown */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <h5 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Outstanding Financial Breakdown
                  </h5>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Loan Principal Outstanding:</span>
                      <strong style={{ color: 'var(--danger)' }}>{formatCurrency(balanceData.totalOutstandingPrincipal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pending Loan Interest:</span>
                      <strong style={{ color: 'var(--warning)' }}>{formatCurrency(balanceData.totalOutstandingInterest)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pending Monthly Savings / Dues:</span>
                      <strong style={{ color: 'var(--warning)' }}>{formatCurrency(balanceData.pendingSavings)}</strong>
                    </div>

                    <div
                      style={{
                        borderTop: '1px dashed var(--border-color)',
                        paddingTop: '10px',
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '1rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>Total Amount Payable:</span>
                      <span style={{ color: 'var(--danger)' }}>{formatCurrency(balanceData.totalPayable)}</span>
                    </div>
                  </div>
                </div>

                {/* Active loans list if any */}
                {balanceData.activeLoans && balanceData.activeLoans.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Active Loans ({balanceData.activeLoans.length})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {balanceData.activeLoans.map((l, idx) => (
                        <div
                          key={l.id || idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            backgroundColor: 'var(--bg-primary)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.84rem',
                          }}
                        >
                          <div>
                            <strong>Loan #{l.loanNumber || l.loan_number || l.id}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              Interest Rate: {l.interestRate || l.interest_rate || 2}% / mo
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600, color: 'var(--danger)' }}>
                              {formatCurrency(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.outstandingAmount || 0))}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>principal</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Case 2: 100% CLEAR - Ready for Deletion */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <CheckCircle2 size={24} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h5 style={{ margin: '0 0 4px', color: 'var(--success)', fontSize: '0.95rem', fontWeight: 600 }}>
                      Financial Clearance: 100% CLEAR (₹0 Dues)
                    </h5>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      All loans and monthly savings for <strong>{memberName}</strong> are fully paid and settled. This account is eligible for deletion.
                    </p>
                  </div>
                </div>

                {/* Final Settlement & Payout Breakdown */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <PiggyBank size={18} style={{ color: 'var(--primary)' }} />
                    <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Final Settlement & Payout
                    </h5>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Lifetime Savings</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(balanceData.lifetimeSavings || 0)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>+ Interest Share</span>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          ({formatCurrency(balanceData.totalGroupInterest || 0)} ÷ {balanceData.totalGroupMembers || 1} total members)
                        </div>
                      </div>
                      <strong style={{ color: 'var(--success)' }}>+{formatCurrency(balanceData.memberInterestShare || 0)}</strong>
                    </div>

                    <div
                      style={{
                        borderTop: '1px dashed var(--border-color)',
                        paddingTop: '10px',
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '1rem',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>Total Amount Payable</span>
                      <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{formatCurrency(balanceData.totalSettlementPayable || 0)}</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px dashed rgba(239, 68, 68, 0.4)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: 'var(--danger)' }}>Permanent Action:</strong> Deleting this member will permanently remove their profile, login credentials, and linked transaction history from the Bachat Gat system. This action cannot be undone.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
};

export default DeleteMemberModal;
