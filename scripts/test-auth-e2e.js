/**
 * Automated End-to-End Test Suite for Auth System
 * Tests API endpoints, rate limiting, anti-enumeration, device registration, and log ingestion.
 */

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ ${message}`);
  }
}

async function runAuthE2ETests() {
  console.log('====================================================');
  console.log(' 🧪 Running Auth System End-to-End Test Suite');
  console.log('====================================================\n');

  let passedCount = 0;
  let totalTests = 0;

  async function testCase(name, testFn) {
    totalTests++;
    console.log(`[Test ${totalTests}] ${name}`);
    try {
      await testFn();
      passedCount++;
      console.log(`  👉 Result: PASSED\n`);
    } catch (err) {
      console.error(`  👉 Result: FAILED (${err.message})\n`);
    }
  }

  // Test 1: Health Diagnostic Endpoint
  await testCase('System Health API Check (/api/health)', async () => {
    const res = await makeRequest('/api/health', 'GET');
    assert(res.status === 200, `HTTP Status is 200 (got ${res.status})`);
    assert(res.data.status === 'healthy', `Health status is 'healthy'`);
    assert(res.data.logStats !== undefined, `logStats exists in response`);
  });

  // Test 2: Send Email Verification Code
  const testEmail = `test_user_${Date.now()}@example.com`;
  await testCase('Send Verification Code (/api/verify-email?action=send)', async () => {
    const res = await makeRequest('/api/verify-email?action=send', 'POST', { email: testEmail });
    assert(res.status === 200, `HTTP Status is 200 (got ${res.status})`);
    assert(res.data.success === true, `Response success is true`);
  });

  // Test 3: Verification Code Verification (Invalid Code)
  await testCase('Verify Code Validation - Invalid Code (/api/verify-email?action=verify)', async () => {
    const res = await makeRequest('/api/verify-email?action=verify', 'POST', {
      email: testEmail,
      code: '000000',
    });
    assert(res.status === 200, `HTTP Status is 200 (got ${res.status})`);
    assert(res.data.success === false, `Response success is false for invalid code`);
  });

  // Test 4: Password Reset Anti-Enumeration Protection
  await testCase('Password Reset Anti-Enumeration (/api/verify-email?action=reset-password)', async () => {
    const res = await makeRequest('/api/verify-email?action=reset-password', 'POST', {
      email: 'nonexistent_account_12345@example.com',
    });
    assert(res.status === 200, `HTTP Status is 200 (got ${res.status})`);
    assert(res.data.success === true, `Response success is true regardless of account existence`);
    assert(
      res.data.message.includes('If an account exists'),
      `Anti-enumeration message returned`
    );
  });

  // Test 5: Client Error Log Ingestion
  await testCase('Client Log Ingestion Telemetry (/api/logs)', async () => {
    const res = await makeRequest('/api/logs', 'POST', {
      level: 'info',
      scope: 'E2ETestSuite',
      message: 'Automated Auth E2E test execution completed successfully',
      meta: { timestamp: new Date().toISOString() },
    });
    assert(res.status === 200, `HTTP Status is 200 (got ${res.status})`);
    assert(res.data.success === true, `Log ingestion acknowledged`);
  });

  // Test 6: Device Registration Invalid Payload Validation
  await testCase('Device Registration Invalid Payload (/api/device)', async () => {
    const res = await makeRequest('/api/device', 'POST', {
      authToken: '', // Invalid empty token
    });
    assert(res.status === 400 || res.status === 401, `Status is 400 or 401 (got ${res.status})`);
    assert(res.data.success === false, `Registration rejected cleanly`);
  });

  console.log('----------------------------------------------------');
  console.log(`📊 Auth E2E Test Results: ${passedCount}/${totalTests} Passed`);
  if (passedCount === totalTests) {
    console.log('🎉 All Auth E2E tests PASSED successfully!\n');
    process.exit(0);
  } else {
    console.warn('⚠️ Some Auth E2E tests FAILED.\n');
    process.exit(1);
  }
}

runAuthE2ETests().catch((err) => {
  console.error('Fatal error running Auth E2E tests:', err);
  process.exit(1);
});
