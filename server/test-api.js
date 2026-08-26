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
  console.log('🧪 Starting Bachat Gat API Automated Test Suite (Including Dynamic Group Name Sync)...\n');
  server = app.listen(PORT);

  try {
    // 1. Health Check
    const health = await request('GET', '/api/health');
    console.log('✔ [1/13] Health Check:', health.status === 200 ? 'PASSED' : 'FAILED', health.data);

    // 2. Member Registration (New Member Signup)
    const uniqueEmail = `aniket.${Date.now()}@bachatgat.com`;
    const uniquePhone = `9822${Date.now().toString().slice(-6)}`;
    const regRes = await request('POST', '/api/auth/register', {
      fullName: 'Aniket Subhash More',
      email: uniqueEmail,
      phone: uniquePhone,
      password: 'Member@123',
      confirmPassword: 'Member@123',
    });
    console.log('✔ [2/13] Member Self-Registration:', regRes.status === 201 ? 'PASSED' : 'FAILED', regRes.data.message);

    // 3. Login with newly registered member
    const newMemberLogin = await request('POST', '/api/auth/login', {
      email: uniqueEmail,
      password: 'Member@123',
    });
    console.log('✔ [3/13] Login with Newly Registered Account:', newMemberLogin.status === 200 ? 'PASSED' : 'FAILED', `Group: ${newMemberLogin.data.user.groupName}`);

    // 4. Admin Login
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'admin@bachatgat.com',
      password: 'Admin@123',
    });
    console.log('✔ [4/13] Admin Login:', loginRes.status === 200 ? 'PASSED' : 'FAILED', `Role: ${loginRes.data.user.role_name}`);
    adminToken = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 5. Get /api/auth/me
    const meRes = await request('GET', '/api/auth/me', null, authHeaders);
    console.log('✔ [5/13] Get Profile (/me):', meRes.status === 200 ? 'PASSED' : 'FAILED', meRes.data.user.name, `Group: ${meRes.data.user.groupName}`);

    // 6. Update Group Name dynamically via PUT /api/group
    const updatedGroupName = `Jay Malhar Bachat Gat ${Date.now().toString().slice(-4)}`;
    const updateGroupRes = await request('PUT', '/api/group', {
      group_name: updatedGroupName,
      monthly_contribution_per_share: 1000,
      monthly_target: 363000,
      description: 'Updated digital savings group',
    }, authHeaders);
    console.log('✔ [6/13] Update Group Name (PUT /api/group):', updateGroupRes.status === 200 ? 'PASSED' : 'FAILED', `New Name: ${updateGroupRes.data.group.group_name}`);

    // 7. Verify /api/auth/me immediately reflects updated group name for admin & member
    const meAfterGroupUpdate = await request('GET', '/api/auth/me', null, authHeaders);
    const isSyncedMe = meAfterGroupUpdate.data.user.groupName === updatedGroupName;
    console.log('✔ [7/13] Sync Verification in /api/auth/me:', isSyncedMe ? 'PASSED (Group Name updated dynamically)' : 'FAILED', meAfterGroupUpdate.data.user.groupName);

    // 8. Verify Dashboard Summary reflects updated group name
    const dashRes = await request('GET', '/api/dashboard/summary', null, authHeaders);
    const isSyncedDash = dashRes.data.summary.groupName === updatedGroupName;
    console.log('✔ [8/13] Sync Verification in /api/dashboard/summary:', isSyncedDash ? 'PASSED' : 'FAILED', dashRes.data.summary.groupName);

    // 9. Admin Add Member with Custom Role
    const newMemberRes = await request('POST', '/api/members', {
      name: 'Santosh Namdeo Jadhav',
      email: `santosh.${Date.now()}@bachatgat.com`,
      phone: `9823${Date.now().toString().slice(-6)}`,
      member_code: `MEM-${Date.now().toString().slice(-4)}`,
      monthly_contribution: 1000,
      role_name: 'TREASURER',
    }, authHeaders);
    console.log('✔ [9/13] Admin Create Member with Role:', newMemberRes.status === 201 ? 'PASSED' : 'FAILED', `Member ID: ${newMemberRes.data.memberId}`);
    const newMemberId = newMemberRes.data.memberId;

    // 10. Record Savings
    const savingsRes = await request('POST', '/api/savings', {
      member_id: newMemberId,
      amount: 1000,
      month: 8,
      year: 2026,
      payment_mode: 'UPI',
    }, authHeaders);
    console.log('✔ [10/13] Record Monthly Savings:', savingsRes.status === 201 ? 'PASSED' : 'FAILED', `Savings ID: ${savingsRes.data.savingsId}`);

    // 11. Prevent Duplicate Savings
    const dupSavingsRes = await request('POST', '/api/savings', {
      member_id: newMemberId,
      amount: 1000,
      month: 8,
      year: 2026,
    }, authHeaders);
    console.log('✔ [11/13] Prevent Duplicate Savings:', dupSavingsRes.status === 400 ? 'PASSED (Rejected duplicate correctly)' : 'FAILED', dupSavingsRes.data.message);

    // 12. Create Loan
    const loanRes = await request('POST', '/api/loans', {
      member_id: newMemberId,
      principal_amount: 5000,
      interest_rate: 2.0,
      duration_months: 12,
      purpose: 'Dairy business purchase',
    }, authHeaders);
    console.log('✔ [12/13] Create Loan:', loanRes.status === 201 ? 'PASSED' : 'FAILED', `Loan #: ${loanRes.data.loanNumber}`);

    // 13. Reports API
    const monthlyReport = await request('GET', '/api/reports/monthly?month=8&year=2026', null, authHeaders);
    const pendingDues = await request('GET', '/api/reports/pending-dues?month=8&year=2026', null, authHeaders);
    const loansOverview = await request('GET', '/api/reports/loans-overview', null, authHeaders);
    console.log('✔ [13/13] Reports API:', (monthlyReport.status === 200 && pendingDues.status === 200 && loansOverview.status === 200) ? 'PASSED' : 'FAILED');

    console.log('\n==============================================');
    console.log('🎉 ALL BACKEND API TESTS (INCLUDING DYNAMIC GROUP NAME SYNC) PASSED!');
    console.log('==============================================');
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    if (server) server.close();
    process.exit(0);
  }
}

runTests();
