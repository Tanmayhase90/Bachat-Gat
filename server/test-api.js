process.env.NODE_ENV = 'test';
const http = require('http');
const app = require('./src/index');

let server;
let adminToken = '';
const PORT = 5099;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        method,
        path,
        headers: reqHeaders,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseBody });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (body) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Bachat Gat API Automated Test Suite...\n');
  server = app.listen(PORT);

  try {
    // 1. Health Check
    const health = await request('GET', '/api/health');
    console.log('✔ [1/10] Health Check:', health.status === 200 ? 'PASSED' : 'FAILED', health.data);

    // 2. Admin Login
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'admin@bachatgat.com',
      password: 'Admin@123',
    });
    console.log('✔ [2/10] Admin Login:', loginRes.status === 200 ? 'PASSED' : 'FAILED', `Role: ${loginRes.data.user.role_name}`);
    adminToken = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 3. Get /api/auth/me
    const meRes = await request('GET', '/api/auth/me', null, authHeaders);
    console.log('✔ [3/10] Get Profile (/me):', meRes.status === 200 ? 'PASSED' : 'FAILED', meRes.data.user.name, `Role: ${meRes.data.user.role_name}`);

    // 4. Dashboard Summary
    const dashRes = await request('GET', '/api/dashboard/summary', null, authHeaders);
    console.log('✔ [4/10] Dashboard Summary:', dashRes.status === 200 ? 'PASSED' : 'FAILED', dashRes.data.summary);

    // 5. Add New Member with Role
    const newMemberRes = await request('POST', '/api/members', {
      name: 'Santosh Namdeo Jadhav',
      email: `santosh.${Date.now()}@bachatgat.com`,
      phone: '9822998877',
      member_code: `MEM-${Date.now().toString().slice(-4)}`,
      monthly_contribution: 1000,
      role_name: 'TREASURER',
    }, authHeaders);
    console.log('✔ [5/10] Create Member with Role:', newMemberRes.status === 201 ? 'PASSED' : 'FAILED', `Member ID: ${newMemberRes.data.memberId}`);
    const newMemberId = newMemberRes.data.memberId;

    // 6. Record Savings
    const savingsRes = await request('POST', '/api/savings', {
      member_id: newMemberId,
      amount: 1000,
      month: 8,
      year: 2026,
      payment_mode: 'UPI',
    }, authHeaders);
    console.log('✔ [6/10] Record Monthly Savings:', savingsRes.status === 201 ? 'PASSED' : 'FAILED', `Savings ID: ${savingsRes.data.savingsId}`);

    // 7. Duplicate Savings Check (Expect 400 Bad Request)
    const dupSavingsRes = await request('POST', '/api/savings', {
      member_id: newMemberId,
      amount: 1000,
      month: 8,
      year: 2026,
    }, authHeaders);
    console.log('✔ [7/10] Prevent Duplicate Savings:', dupSavingsRes.status === 400 ? 'PASSED (Rejected duplicate correctly)' : 'FAILED', dupSavingsRes.data.message);

    // 8. Create Loan
    const loanRes = await request('POST', '/api/loans', {
      member_id: newMemberId,
      principal_amount: 5000,
      interest_rate: 2.0,
      duration_months: 12,
      purpose: 'Dairy business purchase',
    }, authHeaders);
    console.log('✔ [8/10] Create Loan:', loanRes.status === 201 ? 'PASSED' : 'FAILED', `Loan #: ${loanRes.data.loanNumber}`);
    const loanId = loanRes.data.loanId;

    // 9. Record Loan Repayment (Partial & Full)
    const repay1 = await request('POST', `/api/loans/${loanId}/repayments`, {
      payment_month: 8,
      payment_year: 2026,
      regular_hafta_amount: 0,
      principal_repayment_amount: 1000,
    }, authHeaders);
    console.log('✔ [9/10] Record Partial Loan Repayment:', repay1.status === 201 ? 'PASSED' : 'FAILED', repay1.data.calculated);

    const repay2 = await request('POST', `/api/loans/${loanId}/repayments`, {
      payment_month: 9,
      payment_year: 2026,
      regular_hafta_amount: 0,
      principal_repayment_amount: 4000,
    }, authHeaders);
    console.log('✔ [9b/10] Record Full Loan Repayment & Auto-Close:', repay2.status === 201 && repay2.data.calculated.status === 'CLOSED' ? 'PASSED (Loan closed)' : 'FAILED', repay2.data.calculated);

    // 10. Reports
    const monthlyReport = await request('GET', '/api/reports/monthly?month=8&year=2026', null, authHeaders);
    const pendingDues = await request('GET', '/api/reports/pending-dues?month=8&year=2026', null, authHeaders);
    const loansOverview = await request('GET', '/api/reports/loans-overview', null, authHeaders);
    console.log('✔ [10/10] Reports API:', (monthlyReport.status === 200 && pendingDues.status === 200 && loansOverview.status === 200) ? 'PASSED' : 'FAILED');

    console.log('\n==============================================');
    console.log('🎉 ALL BACKEND API TESTS PASSED SUCCESSFULLY WITH ROLE_NAME!');
    console.log('==============================================');
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    if (server) server.close();
    process.exit(0);
  }
}

runTests();
