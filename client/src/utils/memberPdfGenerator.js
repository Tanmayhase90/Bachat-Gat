import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  getLoanMonthYear,
} from './formatters';

/**
 * Generate a complete, professionally formatted HTML report container for a member.
 * This container is rendered off-screen and rasterized with html2canvas into a multi-page A4 PDF.
 */
function createMemberReportHtml(member, groupInfo, language = 'en') {
  const isMr = language === 'mr';

  // 1. Personal Details
  const memberCode = member.member_code || member.memberCode || member.id || '-';
  const memberName = member.name || member.fullName || '-';
  const isActive = member.is_active !== undefined ? Boolean(member.is_active) : (String(member.status || '').toUpperCase() === 'ACTIVE');
  const statusLabel = isActive ? (isMr ? 'सक्रिय (ACTIVE)' : 'ACTIVE') : (isMr ? 'अक्रिय (INACTIVE)' : 'INACTIVE');
  const rawRole = (member.role_name || member.role || 'MEMBER').toUpperCase();
  const roleLabel = isMr
    ? (rawRole === 'ADMIN' ? 'अध्यक्ष / ॲडमिन' : rawRole === 'TREASURER' ? 'खजिनदार' : rawRole === 'SECRETARY' ? 'सचिव' : 'सभासद')
    : (rawRole.charAt(0) + rawRole.slice(1).toLowerCase());
  const rawJoinDate = member.joined_date || member.joinDate || member.joinedAt;
  const joiningDate = formatDate(rawJoinDate);
  const phone = member.phone || member.phoneNumber || member.mobileNumber || '-';
  const sharesCount = Number(member.shares || member.shareCount || 1);
  const address = member.address || member.village || member.city || '-';
  const occupation = member.occupation || '-';

  // 2. Savings Details
  const rawTotalSavings = Number(member.totalSavings || member.total_savings || 0);
  const totalSavings = formatCurrency(rawTotalSavings);
  const rawMonthlyShare = Number(member.monthlyContribution || member.monthly_contribution || 1000);
  const monthlyShare = formatCurrency(rawMonthlyShare);
  const rawSavingsHistory = Array.isArray(member.savingsHistory) ? member.savingsHistory : (Array.isArray(member.savings_history) ? member.savings_history : []);
  
  // Sort savings chronologically: oldest first for clear record progression
  const savingsHistory = [...rawSavingsHistory].sort((a, b) => {
    const yA = Number(a.year) || 0;
    const yB = Number(b.year) || 0;
    if (yA !== yB) return yA - yB;
    const mA = Number(a.month) || 0;
    const mB = Number(b.month) || 0;
    return mA - mB;
  });
  const savingsRecordsCount = savingsHistory.length;

  const baseSavingRecord = savingsHistory.find(
    (s) => s.isBase || s.month === 0 || String(s.notes || s.remarks || '').toLowerCase().includes('opening') || String(s.paymentMode || s.payment_mode || '').toLowerCase().includes('opening')
  );
  const baseSavingAmount = baseSavingRecord ? Number(baseSavingRecord.paidAmount || baseSavingRecord.amount || 0) : 0;

  // 3. Loans & Repayments Details
  const allLoans = Array.isArray(member.loans) ? member.loans : (Array.isArray(member.loans_history) ? member.loans_history : []);
  const activeLoans = allLoans.filter((l) => (l.status || '').toUpperCase() === 'ACTIVE' && Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.outstandingAmount || 0)) > 0);
  
  const rawOutstanding = Number(member.totalOutstanding || member.total_outstanding || activeLoans.reduce((sum, l) => sum + Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.outstandingAmount || 0)), 0));
  const currentOutstandingLoan = formatCurrency(rawOutstanding);
  const totalLoansTaken = allLoans.length;
  const totalLoansDisbursedAmount = allLoans.reduce((sum, l) => sum + Number(l.originalPrincipal || l.principalAmount || 0), 0);
  const totalLoansDisbursed = formatCurrency(totalLoansDisbursedAmount);

  const allRepayments = Array.isArray(member.repayments) ? member.repayments : [];
  // Sort repayments chronologically
  const repaymentsList = [...allRepayments].sort((a, b) => {
    const dA = new Date(a.paymentDate || a.payment_date || 0).getTime();
    const dB = new Date(b.paymentDate || b.payment_date || 0).getTime();
    return dA - dB;
  });

  const totalPrincipalRepaidAmount = Math.max(
    allLoans.reduce((sum, l) => sum + Number(l.totalPrincipalPaid || l.total_principal_paid || 0), 0),
    repaymentsList.reduce((sum, r) => sum + Number(r.principalAmount || r.principalPaid || r.principalRepaid || 0), 0)
  );
  const totalPrincipalRepaid = formatCurrency(totalPrincipalRepaidAmount);

  const totalInterestPaidAmount = Math.max(
    allLoans.reduce((sum, l) => sum + Number(l.totalInterestPaid || l.total_interest_paid || 0), 0),
    repaymentsList.reduce((sum, r) => sum + Number(r.interestAmount || r.interestPaid || r.interest_amount || 0), 0)
  );
  const totalLoanInterestPaid = formatCurrency(totalInterestPaidAmount);

  // 4. Account Net Position
  const netPositionAmount = rawTotalSavings - rawOutstanding;
  const netPositionFormatted = netPositionAmount < 0
    ? `-₹${Math.abs(Math.round(netPositionAmount)).toLocaleString('en-IN')}`
    : `+${formatCurrency(netPositionAmount)}`;

  const groupTitle = groupInfo?.group_name || groupInfo?.name || (isMr ? 'छत्रपती बचत गट, घारगाव स्टँड' : 'Chhatrapati Bachat Gat, Ghargaon Stand');
  const now = new Date();
  const generationDateStr = `${formatDate(now)}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const container = document.createElement('div');
  container.id = 'member-pdf-render-root';
  container.style.cssText = `
    width: 794px;
    background-color: #FFFFFF;
    color: #0F172A;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    padding: 24px 30px;
    box-sizing: border-box;
    font-size: 11px;
    line-height: 1.4;
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: -999;
  `;

  container.innerHTML = `
    <!-- 1. Header Banner -->
    <div style="border-bottom: 2.5px solid #BE185D; padding-bottom: 14px; margin-bottom: 16px; text-align: center;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
        <div style="width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, #831843 0%, #BE185D 50%, #DB2777 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px;">
          ₹
        </div>
        <h1 style="font-size: 20px; font-weight: 800; color: #BE185D; margin: 0; letter-spacing: -0.01em;">
          ${groupTitle}
        </h1>
      </div>
      <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
        Ghargaon Stand • Registration & Accounting Management System
      </div>
      <div style="display: inline-block; background: #FDF2F8; color: #BE185D; padding: 3px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #FBCFE8;">
        ${isMr ? 'सभासद संपूर्ण आर्थिक तपशील व खाती वही' : 'MEMBER COMPLETE FINANCIAL STATEMENT'}
      </div>
      <div style="font-size: 9.5px; color: #94A3B8; margin-top: 5px;">
        ${isMr ? 'दिनांक:' : 'Report Generated On:'} <strong>${generationDateStr}</strong>
      </div>
    </div>

    <!-- 2. Section 1: Member Personal & Account Details -->
    <div style="margin-bottom: 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
      <div style="background: #F8FAFC; padding: 7px 12px; border-bottom: 1.5px solid #E2E8F0; font-weight: 800; font-size: 11.5px; color: #BE185D; text-transform: uppercase; letter-spacing: 0.03em; display: flex; justify-content: space-between; align-items: center;">
        <span>1. ${isMr ? 'सभासद वैयक्तिक व खाते तपशील' : 'Member Details'}</span>
        <span style="background: ${isActive ? '#ECFDF5' : '#FEE2E2'}; color: ${isActive ? '#047857' : '#B91C1C'}; border: 1px solid ${isActive ? '#A7F3D0' : '#FECACA'}; padding: 2px 8px; border-radius: 999px; font-size: 9.5px; font-weight: 700;">
          ${statusLabel}
        </span>
      </div>
      <div style="padding: 10px 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #FFFFFF; font-size: 10.5px;">
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'सभासदाचे नाव' : 'Member Name'}</div>
          <div style="font-weight: 800; font-size: 12px; color: #0F172A; margin-top: 1px;">${memberName}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'सभासद क्रमांक' : 'Member ID'}</div>
          <div style="font-weight: 800; font-size: 12px; color: #BE185D; margin-top: 1px;">${memberCode}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'पद / भूमिका' : 'Role'}</div>
          <div style="font-weight: 700; color: #0F172A; margin-top: 1px;">${roleLabel}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'दाखल दिनांक' : 'Joining Date'}</div>
          <div style="font-weight: 700; color: #0F172A; margin-top: 1px;">${joiningDate}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'मोबाईल नंबर' : 'Phone / Mobile'}</div>
          <div style="font-weight: 700; color: #0F172A; margin-top: 1px;">${phone}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'शेअर्स संख्या' : 'Shares Count'}</div>
          <div style="font-weight: 700; color: #0F172A; margin-top: 1px;">${sharesCount}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'पत्ता / गाव' : 'Address / Village'}</div>
          <div style="font-weight: 600; color: #0F172A; margin-top: 1px;">${address}</div>
        </div>
        <div>
          <div style="color: #64748B; font-size: 9.5px; font-weight: 600; text-transform: uppercase;">${isMr ? 'मासिक हफ्ता' : 'Monthly Share'}</div>
          <div style="font-weight: 800; color: #BE185D; margin-top: 1px;">${monthlyShare}</div>
        </div>
      </div>
    </div>

    <!-- 3. Section 2: Savings Summary Overview -->
    <div style="margin-bottom: 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
      <div style="background: #F8FAFC; padding: 7px 12px; border-bottom: 1.5px solid #E2E8F0; font-weight: 800; font-size: 11.5px; color: #BE185D; text-transform: uppercase; letter-spacing: 0.03em;">
        2. ${isMr ? 'बचत सारांश' : 'Savings Summary'}
      </div>
      <div style="padding: 10px 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #FFFFFF;">
        <div style="padding: 8px 10px; border-radius: 6px; background: #ECFDF5; border: 1px solid #A7F3D0;">
          <div style="font-size: 9px; font-weight: 700; color: #047857; text-transform: uppercase;">${isMr ? 'आजपर्यंतची एकूण बचत' : 'Total Savings Accumulated'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #047857; margin-top: 2px;">${totalSavings}</div>
          <div style="font-size: 9px; color: #065F46;">${isMr ? 'एकूण जमा रक्कम' : 'Total accumulated up to today'}</div>
        </div>
        <div style="padding: 8px 10px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">${isMr ? 'मासिक हफ्ता' : 'Monthly Share Amount'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #BE185D; margin-top: 2px;">${monthlyShare}</div>
          <div style="font-size: 9px; color: #64748B;">${sharesCount > 1 ? `(${sharesCount} ${isMr ? 'शेअर्स' : 'shares'})` : (isMr ? 'प्रति महिना हफ्ता' : 'Per month share')}</div>
        </div>
        <div style="padding: 8px 10px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">${isMr ? 'एकूण बचत हप्ते' : 'Total Savings Records'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 2px;">${savingsRecordsCount}</div>
          <div style="font-size: 9px; color: #64748B;">${isMr ? 'नोंदवलेले हप्ते' : 'Recorded monthly entries'}</div>
        </div>
        <div style="padding: 8px 10px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">${isMr ? 'प्रारंभिक / मूळ बचत' : 'Base / Opening Amount'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 2px;">${formatCurrency(baseSavingAmount)}</div>
          <div style="font-size: 9px; color: #64748B;">${baseSavingRecord ? (isMr ? 'एकवेळ प्रारंभिक ठेव' : 'Initial opening deposit') : (isMr ? 'लागू नाही' : 'Not applicable')}</div>
        </div>
      </div>
    </div>

    <!-- 4. Section 3: Complete Savings History Table -->
    <div style="margin-bottom: 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
      <div style="background: #F8FAFC; padding: 7px 12px; border-bottom: 1.5px solid #E2E8F0; font-weight: 800; font-size: 11.5px; color: #BE185D; text-transform: uppercase; letter-spacing: 0.03em; display: flex; justify-content: space-between; align-items: center;">
        <span>3. ${isMr ? 'संपूर्ण मासिक बचत इतिहास' : 'Complete Savings History'}</span>
        <span style="font-size: 9.5px; color: #64748B; text-transform: none;">
          ${savingsHistory.length} ${isMr ? 'नोंदी' : 'records recorded'}
        </span>
      </div>
      ${
        savingsHistory.length === 0
          ? `<div style="padding: 14px; text-align: center; color: #64748B; font-size: 10.5px;">${isMr ? 'या सभासदाची कोणतीही बचत नोंद उपलब्ध नाही.' : 'No savings contributions recorded for this member.'}</div>`
          : `
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;">
              <thead>
                <tr style="background: #F1F5F9; border-bottom: 1.5px solid #CBD5E1; color: #475569;">
                  <th style="padding: 5px 8px; width: 28px; text-align: center;">#</th>
                  <th style="padding: 5px 8px;">${isMr ? 'महिना व वर्ष' : 'Month / Year'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'हफ्ता / बचत रक्कम' : 'Saving Amount'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'भरणा दिनांक' : 'Payment Date'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'पेमेंट मोड' : 'Payment Mode'}</th>
                  <th style="padding: 5px 8px;">${isMr ? 'शेरा / संदर्भ' : 'Notes / Remarks'}</th>
                  <th style="padding: 5px 8px; text-align: center; width: 60px;">${isMr ? 'स्थिती' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${savingsHistory
                  .map((s, idx) => {
                    const isBase = s.isBase || s.month === 0;
                    const periodLabel = isBase
                      ? (isMr ? `मूळ बचत (${s.year || 2026})` : `Base Savings (${s.year || 2026})`)
                      : formatMonthYear(s.month, s.year, language);
                    const paidAmt = Number(s.paidAmount !== undefined ? s.paidAmount : (s.amount || 0));
                    const payDate = formatDate(s.paymentDate || s.payment_date);
                    const pMode = s.paymentMode || s.payment_mode || (isBase ? 'Opening Balance' : 'Cash');
                    const remarks = s.remarks || s.notes || '-';
                    const isPaid = s.isPaid || paidAmt > 0;

                    return `
                      <tr style="border-bottom: 1px solid #E2E8F0; background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
                        <td style="padding: 5px 8px; text-align: center; color: #64748B;">${idx + 1}</td>
                        <td style="padding: 5px 8px; font-weight: 700; color: #BE185D;">${periodLabel}</td>
                        <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: #047857;">${formatCurrency(paidAmt)}</td>
                        <td style="padding: 5px 8px; text-align: center; color: #334155;">${payDate}</td>
                        <td style="padding: 5px 8px; text-align: center;">
                          <span style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; padding: 1px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 600;">
                            ${pMode}
                          </span>
                        </td>
                        <td style="padding: 5px 8px; color: #64748B; font-size: 9.5px;">${remarks}</td>
                        <td style="padding: 5px 8px; text-align: center;">
                          <span style="background: ${isPaid ? '#ECFDF5' : '#FEF3C7'}; color: ${isPaid ? '#047857' : '#B45309'}; border: 1px solid ${isPaid ? '#A7F3D0' : '#FDE68A'}; padding: 1px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700;">
                            ${isPaid ? (isMr ? 'जमा' : 'PAID') : (isMr ? 'बाकी' : 'PENDING')}
                          </span>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
              <tfoot>
                <tr style="background: #F1F5F9; border-top: 1.5px solid #CBD5E1; font-weight: 800;">
                  <td colspan="2" style="padding: 6px 8px; text-align: right; font-size: 10.5px;">
                    ${isMr ? 'एकूण जमा बचत (GRAND TOTAL):' : 'TOTAL ACCUMULATED SAVINGS:'}
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #047857; font-weight: 900;">
                    ${totalSavings}
                  </td>
                  <td colspan="4" style="padding: 6px 8px; text-align: left; color: #64748B; font-size: 9.5px;">
                    (${savingsHistory.length} ${isMr ? 'हप्ते पूर्ण' : 'contributions settled'})
                  </td>
                </tr>
              </tfoot>
            </table>
          `
      }
    </div>

    <!-- 5. Section 4: Loan Portfolio Summary -->
    <div style="margin-bottom: 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
      <div style="background: #F8FAFC; padding: 7px 12px; border-bottom: 1.5px solid #E2E8F0; font-weight: 800; font-size: 11.5px; color: #BE185D; text-transform: uppercase; letter-spacing: 0.03em;">
        4. ${isMr ? 'कर्ज सारांश' : 'Loan Summary'}
      </div>
      <div style="padding: 10px 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #FFFFFF;">
        <div style="padding: 8px 10px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">${isMr ? 'एकूण घेतलेली कर्जे' : 'Total Loans Disbursed'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 2px;">${totalLoansTaken}</div>
          <div style="font-size: 9px; color: #64748B;">${totalLoansDisbursed} (${isMr ? 'एकूण रक्कम' : 'total amount'})</div>
        </div>
        <div style="padding: 8px 10px; border-radius: 6px; background: ${rawOutstanding > 0 ? '#FEE2E2' : '#F8FAFC'}; border: 1px solid ${rawOutstanding > 0 ? '#FECACA' : '#E2E8F0'};">
          <div style="font-size: 9px; font-weight: 700; color: ${rawOutstanding > 0 ? '#B91C1C' : '#64748B'}; text-transform: uppercase;">${isMr ? 'सक्रिय कर्ज बाकी' : 'Active Outstanding Loan'}</div>
          <div style="font-size: 15px; font-weight: 800; color: ${rawOutstanding > 0 ? '#B91C1C' : '#0F172A'}; margin-top: 2px;">${currentOutstandingLoan}</div>
          <div style="font-size: 9px; color: ${rawOutstanding > 0 ? '#991B1B' : '#64748B'};">${activeLoans.length} ${isMr ? 'सक्रिय कर्ज' : 'active loan(s)'}</div>
        </div>
        <div style="padding: 8px 10px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">${isMr ? 'परतफेड केलेली मुद्दल' : 'Total Principal Repaid'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #047857; margin-top: 2px;">${totalPrincipalRepaid}</div>
          <div style="font-size: 9px; color: #065F46;">${isMr ? 'मुद्दल परत जमा' : 'Principal recovered'}</div>
        </div>
        <div style="padding: 8px 10px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">${isMr ? 'एकूण भरलेले व्याज' : 'Total Interest Paid'}</div>
          <div style="font-size: 15px; font-weight: 800; color: #BE185D; margin-top: 2px;">${totalLoanInterestPaid}</div>
          <div style="font-size: 9px; color: #64748B;">${repaymentsList.length} ${isMr ? 'परतफेड व्यवहार' : 'repayment entries'}</div>
        </div>
      </div>
    </div>

    <!-- 6. Section 5: Active Loans Table -->
    <div style="margin-bottom: 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
      <div style="background: #F8FAFC; padding: 7px 12px; border-bottom: 1.5px solid #E2E8F0; font-weight: 800; font-size: 11.5px; color: #BE185D; text-transform: uppercase; letter-spacing: 0.03em; display: flex; justify-content: space-between; align-items: center;">
        <span>5. ${isMr ? 'सक्रिय कर्जे — आजच्या तारखेनुसार' : 'Active Loans — As of Today'}</span>
        <span style="font-size: 9.5px; color: #64748B;">
          ${activeLoans.length} ${isMr ? 'सक्रिय कर्ज' : 'active loan(s)'}
        </span>
      </div>
      ${
        activeLoans.length === 0
          ? `<div style="padding: 12px 16px; background: #F0FDF4; color: #166534; font-size: 10.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              ✓ ${isMr ? 'या सभासदावर आजच्या तारखेला कोणतेही सक्रिय कर्ज बाकी नाही!' : 'No active outstanding loans as of today! All loans are cleared.'}
            </div>`
          : `
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;">
              <thead>
                <tr style="background: #F1F5F9; border-bottom: 1.5px solid #CBD5E1; color: #475569;">
                  <th style="padding: 5px 8px;">${isMr ? 'कर्ज क्र.' : 'Loan ID'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'मंजूर दिनांक' : 'Issue Date'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'महिना/वर्ष' : 'Month/Year'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'मूळ मंजूर मुद्दल' : 'Original Loan'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'परत केलेली मुद्दल' : 'Principal Repaid'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'भरलेले व्याज' : 'Interest Paid'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'शिल्लक मुद्दल बाकी' : 'Outstanding Principal'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'व्याज दर' : 'Interest Rate'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'कालावधी' : 'Duration'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'स्थिती' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${activeLoans
                  .map((l) => {
                    const lNum = l.loan_number || l.loanNumber || l.id;
                    const issueDate = formatDate(l.issueDate || l.loanDate || l.loan_date);
                    const my = getLoanMonthYear(l.issueDate || l.loanDate || l.loan_date);
                    const monthYearText = my.month ? formatMonthYear(my.month, my.year, language) : '-';
                    const origPrin = Number(l.originalPrincipal || l.principalAmount || 0);
                    const prinPaid = Number(l.totalPrincipalPaid || l.total_principal_paid || 0);
                    const intPaid = Number(l.totalInterestPaid || l.total_interest_paid || 0);
                    const outPrin = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.outstandingAmount || (origPrin - prinPaid)));
                    const rate = l.interestRate || l.interest_rate || 2;
                    const duration = l.durationMonths || l.duration_months || 12;

                    return `
                      <tr style="border-bottom: 1px solid #E2E8F0; background: #FFFFFF;">
                        <td style="padding: 5px 8px; font-weight: 800; color: #0F172A;">${lNum}</td>
                        <td style="padding: 5px 8px; text-align: center; color: #334155;">${issueDate}</td>
                        <td style="padding: 5px 8px; text-align: center; color: #64748B;">${monthYearText}</td>
                        <td style="padding: 5px 8px; text-align: right; font-weight: 700;">${formatCurrency(origPrin)}</td>
                        <td style="padding: 5px 8px; text-align: right; color: #047857; font-weight: 700;">${formatCurrency(prinPaid)}</td>
                        <td style="padding: 5px 8px; text-align: right; color: #BE185D; font-weight: 700;">${formatCurrency(intPaid)}</td>
                        <td style="padding: 5px 8px; text-align: right; font-weight: 900; color: #B91C1C;">${formatCurrency(outPrin)}</td>
                        <td style="padding: 5px 8px; text-align: center; font-weight: 700; color: #1D4ED8;">${rate}% / ${isMr ? 'महिना' : 'mo'}</td>
                        <td style="padding: 5px 8px; text-align: center; color: #64748B;">${duration} ${isMr ? 'महिने' : 'mo'}</td>
                        <td style="padding: 5px 8px; text-align: center;">
                          <span style="background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; padding: 1px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 800;">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          `
      }
    </div>

    <!-- 7. Section 6: Repayment History Table -->
    <div style="margin-bottom: 16px; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
      <div style="background: #F8FAFC; padding: 7px 12px; border-bottom: 1.5px solid #E2E8F0; font-weight: 800; font-size: 11.5px; color: #BE185D; text-transform: uppercase; letter-spacing: 0.03em; display: flex; justify-content: space-between; align-items: center;">
        <span>6. ${isMr ? 'कर्ज परतफेड इतिहास' : 'Repayment History'}</span>
        <span style="font-size: 9.5px; color: #64748B;">
          ${repaymentsList.length} ${isMr ? 'परतफेड नोंदी' : 'repayment transactions'}
        </span>
      </div>
      ${
        repaymentsList.length === 0
          ? `<div style="padding: 14px; text-align: center; color: #64748B; font-size: 10.5px;">${isMr ? 'कोणतीही कर्ज परतफेड नोंद उपलब्ध नाही.' : 'No repayment transactions recorded for this member.'}</div>`
          : `
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;">
              <thead>
                <tr style="background: #F1F5F9; border-bottom: 1.5px solid #CBD5E1; color: #475569;">
                  <th style="padding: 5px 8px; width: 28px; text-align: center;">#</th>
                  <th style="padding: 5px 8px;">${isMr ? 'कर्ज क्र.' : 'Loan ID'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'महिना / वर्ष' : 'Month / Year'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'भरणा दिनांक' : 'Payment Date'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'परत मुद्दल' : 'Principal Repaid'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'भरलेले व्याज' : 'Interest Paid'}</th>
                  <th style="padding: 5px 8px; text-align: right;">${isMr ? 'एकूण भरणा' : 'Total Payment'}</th>
                  <th style="padding: 5px 8px; text-align: center;">${isMr ? 'पेमेंट मोड' : 'Payment Mode'}</th>
                  <th style="padding: 5px 8px;">${isMr ? 'शेरा' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody>
                ${repaymentsList
                  .map((r, idx) => {
                    const lNum = r.loanNumber || r.loan_number || r.loanId || r.loan_id || 'LN-1';
                    const period = r.month && r.year ? formatMonthYear(r.month, r.year, language) : '-';
                    const pDate = formatDate(r.paymentDate || r.payment_date || r.paidAt || r.createdAt);
                    const pPrin = Number(r.principalAmount || r.principalPaid || r.principalRepaid || 0);
                    const pInt = Number(r.interestAmount || r.interestPaid || r.interest_amount || 0);
                    const pTotal = Number(r.totalPayment || r.amount || (pPrin + pInt));
                    const pMode = r.paymentMode || r.payment_mode || 'UPI';
                    const notes = r.notes || r.remarks || '-';

                    return `
                      <tr style="border-bottom: 1px solid #E2E8F0; background: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
                        <td style="padding: 5px 8px; text-align: center; color: #64748B;">${idx + 1}</td>
                        <td style="padding: 5px 8px; font-weight: 700; color: #0F172A;">${lNum}</td>
                        <td style="padding: 5px 8px; text-align: center; color: #64748B;">${period}</td>
                        <td style="padding: 5px 8px; text-align: center; color: #334155;">${pDate}</td>
                        <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #047857;">${formatCurrency(pPrin)}</td>
                        <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #BE185D;">${formatCurrency(pInt)}</td>
                        <td style="padding: 5px 8px; text-align: right; font-weight: 900; color: #0F172A;">${formatCurrency(pTotal)}</td>
                        <td style="padding: 5px 8px; text-align: center;">
                          <span style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; padding: 1px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 600;">
                            ${pMode}
                          </span>
                        </td>
                        <td style="padding: 5px 8px; color: #64748B; font-size: 9.5px;">${notes}</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
              <tfoot>
                <tr style="background: #F1F5F9; border-top: 1.5px solid #CBD5E1; font-weight: 800;">
                  <td colspan="4" style="padding: 6px 8px; text-align: right; font-size: 10.5px;">
                    ${isMr ? 'एकूण परतफेड (TOTALS):' : 'TOTAL REPAYMENTS:'}
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #047857;">
                    ${totalPrincipalRepaid}
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #BE185D;">
                    ${totalLoanInterestPaid}
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #0F172A; font-weight: 900;">
                    ${formatCurrency(totalPrincipalRepaidAmount + totalInterestPaidAmount)}
                  </td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          `
      }
    </div>

    <!-- 8. Section 7: Final Financial Position & Summary Box -->
    <div style="margin-bottom: 16px; border: 2px solid #BE185D; border-radius: 8px; overflow: hidden; background: #FFF5F8;">
      <div style="background: #BE185D; color: #FFFFFF; padding: 7px 12px; font-weight: 800; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em;">
        7. ${isMr ? 'अंतिम आर्थिक ताळेबंद व खाती स्थिती' : 'Final Financial Summary & Account Position'}
      </div>
      <div style="padding: 12px 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
        <div style="padding: 8px 10px; background: #FFFFFF; border-radius: 6px; border: 1px solid #FBCFE8;">
          <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">${isMr ? 'आजपर्यंतची एकूण बचत' : 'Total Savings as of Today'}</div>
          <div style="font-size: 16px; font-weight: 900; color: #047857; margin-top: 2px;">${totalSavings}</div>
        </div>
        <div style="padding: 8px 10px; background: #FFFFFF; border-radius: 6px; border: 1px solid #FBCFE8;">
          <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">${isMr ? 'एकूण घेतलेले कर्ज' : 'Total Loans Disbursed'}</div>
          <div style="font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 2px;">${totalLoansDisbursed}</div>
        </div>
        <div style="padding: 8px 10px; background: #FFFFFF; border-radius: 6px; border: 1px solid #FBCFE8;">
          <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">${isMr ? 'परत केलेली मुद्दल' : 'Total Principal Repaid'}</div>
          <div style="font-size: 16px; font-weight: 900; color: #047857; margin-top: 2px;">${totalPrincipalRepaid}</div>
        </div>
        <div style="padding: 8px 10px; background: #FFFFFF; border-radius: 6px; border: 1px solid #FBCFE8;">
          <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">${isMr ? 'एकूण भरलेले व्याज' : 'Total Interest Paid'}</div>
          <div style="font-size: 16px; font-weight: 900; color: #BE185D; margin-top: 2px;">${totalLoanInterestPaid}</div>
        </div>
        <div style="padding: 8px 10px; background: #FFFFFF; border-radius: 6px; border: 1px solid ${rawOutstanding > 0 ? '#FECACA' : '#FBCFE8'};">
          <div style="font-size: 9.5px; color: ${rawOutstanding > 0 ? '#B91C1C' : '#64748B'}; font-weight: 700; text-transform: uppercase;">${isMr ? 'सक्रिय कर्ज बाकी (थकबाकी)' : 'Active Loan Balance'}</div>
          <div style="font-size: 16px; font-weight: 900; color: ${rawOutstanding > 0 ? '#B91C1C' : '#0F172A'}; margin-top: 2px;">${currentOutstandingLoan}</div>
        </div>
        <div style="padding: 8px 10px; background: #FFFFFF; border-radius: 6px; border: 1.5px solid ${netPositionAmount >= 0 ? '#A7F3D0' : '#FECACA'};">
          <div style="font-size: 9.5px; color: ${netPositionAmount >= 0 ? '#047857' : '#B91C1C'}; font-weight: 800; text-transform: uppercase;">${isMr ? 'निव्वळ खाती शिल्लक' : 'Net Position (Savings - Loans)'}</div>
          <div style="font-size: 16px; font-weight: 900; color: ${netPositionAmount >= 0 ? '#047857' : '#B91C1C'}; margin-top: 2px;">${netPositionFormatted}</div>
        </div>
      </div>
    </div>

    <!-- 9. Section 8: Signatures & Verification Stamp -->
    <div style="margin-top: 22px; padding-top: 16px; border-top: 1.5px solid #CBD5E1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
      <div>
        <div style="height: 38px; border-bottom: 1.5px dashed #94A3B8; margin-bottom: 6px;"></div>
        <div style="font-size: 10px; font-weight: 800; color: #334155;">${isMr ? 'सभासदाची स्वाक्षरी' : 'Member Signature'}</div>
        <div style="font-size: 9px; color: #64748B;">(${memberName})</div>
      </div>
      <div>
        <div style="height: 38px; border-bottom: 1.5px dashed #94A3B8; margin-bottom: 6px;"></div>
        <div style="font-size: 10px; font-weight: 800; color: #334155;">${isMr ? 'सचिवाची स्वाक्षरी' : 'Secretary Signature'}</div>
        <div style="font-size: 9px; color: #64748B;">(${isMr ? 'बचत गट सचिव' : 'Bachat Gat Secretary'})</div>
      </div>
      <div>
        <div style="height: 38px; border-bottom: 1.5px dashed #94A3B8; margin-bottom: 6px;"></div>
        <div style="font-size: 10px; font-weight: 800; color: #334155;">${isMr ? 'खजिनदार / अध्यक्ष शिक्का' : 'Treasurer / Admin Stamp'}</div>
        <div style="font-size: 9px; color: #64748B;">(${isMr ? 'अधिकृत स्वाक्षरी व शिक्का' : 'Authorized Signature & Seal'})</div>
      </div>
    </div>

    <!-- 10. Official Disclaimer Footer -->
    <div style="margin-top: 14px; text-align: center; font-size: 8.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 6px;">
      ${isMr ? 'हा अहवाल बचत गट डिजिटल प्रणालीद्वारे अधिकृतपणे तयार करण्यात आला आहे. सर्व नोंदी अचूक व प्रमाणित आहेत.' : 'This report is an official financial statement generated from the Bachat Gat Digital Management System.'}
    </div>
  `;

  return container;
}

/**
 * Generate a high-resolution PDF document object for a given member.
 * Supports complete Devanagari / Marathi font rendering via canvas rasterization.
 */
export async function generateMemberReportPdf(member, groupInfo, language = 'en') {
  if (!member) throw new Error('Member data is required to generate PDF');

  const container = createMemberReportHtml(member, groupInfo, language);
  document.body.appendChild(container);

  try {
    // Wait for fonts to be ready
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(container, {
      scale: 2, // 2x retina scale for ultra-crisp text rendering
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      windowWidth: 794,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfPageHeight = 297;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfPageHeight;

    // Add subsequent pages if content overflows standard A4 height
    while (heightLeft > 0) {
      position -= pdfPageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfPageHeight;
    }

    return pdf;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Share or download the Member Financial Statement PDF and trigger WhatsApp.
 * Sends ONLY the generated PDF file without any separate plain-text messages.
 */
export async function shareMemberPdf(member, groupInfo, language = 'en') {
  if (!member) return;

  const memberCode = member.member_code || member.memberCode || member.id || 'Member';
  const memberName = member.name || member.fullName || 'Member';
  const cleanCode = String(memberCode).replace(/\s+/g, '_');
  const fileName = `BachatGat_Member_${cleanCode}.pdf`;

  const pdf = await generateMemberReportPdf(member, groupInfo, language);
  const pdfBlob = pdf.output('blob');
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

  const phone = member.phone || member.phoneNumber || member.mobileNumber || '';
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const whatsappUrl = cleanPhone ? `https://wa.me/91${cleanPhone}` : `https://wa.me/`;

  // 1. Try Native Web Share API (WhatsApp mobile / desktop file sharing - PDF file ONLY)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
      });
      return { success: true, mode: 'web_share' };
    } catch (err) {
      if (err.name === 'AbortError') {
        // User voluntarily dismissed share sheet
        return { success: true, mode: 'user_aborted' };
      }
      console.warn('Native share failed or unsupported, falling back to download:', err);
    }
  }

  // 2. Fallback: Automatically download PDF file and open WhatsApp chat without pre-filled text
  pdf.save(fileName);
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

  return { success: true, mode: 'fallback_download' };
}
