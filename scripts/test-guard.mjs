import http from 'http';

export const PROD_PROJECT_ID = 'bachat-gat-app-9e38e';
export const PROD_GROUP_ID = 'chhatrapati_group_001';
export const SAFE_TEST_GROUP_ID = 'test_group_temp';
export const DEFAULT_EMULATOR_HOST = '127.0.0.1:8080';

/**
 * Hard safety guard to permanently prevent test and verification scripts from connecting
 * to or writing into the live production Firestore database.
 *
 * Enforces:
 * 1. Project ID cannot be production project without active emulator.
 * 2. Group ID can NEVER be production group (chhatrapati_group_001) in tests.
 * 3. FIRESTORE_EMULATOR_HOST must be set.
 * 4. Fails safely before any setDoc/addDoc/updateDoc write operation.
 */
export async function assertTestEnvironmentSafety({
  projectId = PROD_PROJECT_ID,
  groupId = SAFE_TEST_GROUP_ID,
  checkEmulatorAlive = true,
} = {}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ? process.env.FIRESTORE_EMULATOR_HOST.trim() : null;

  // 1. Detect project ID: if it is production project without emulator host, immediately block
  if (!emulatorHost && projectId === PROD_PROJECT_ID) {
    throw new Error('BLOCKED: Test script cannot run against production Firestore.');
  }

  // 2. Reject if emulator host is not set
  if (!emulatorHost) {
    throw new Error('BLOCKED: Test script cannot run against production Firestore.');
  }

  // 3. Reject production group ID in any test
  if (groupId === PROD_GROUP_ID) {
    throw new Error('BLOCKED: Test script cannot run against production group "' + PROD_GROUP_ID + '". Use dedicated test group "' + SAFE_TEST_GROUP_ID + '".');
  }

  // 4. Reject if emulator is not running/reachable
  if (checkEmulatorAlive && emulatorHost) {
    const isAlive = await checkEmulatorReachable(emulatorHost);
    if (!isAlive) {
      throw new Error('BLOCKED: Firebase Local Emulator Suite is not reachable at ' + emulatorHost + '. Tests will NOT fall back to cloud database.');
    }
  }

  return true;
}

export function checkEmulatorReachable(emulatorHost) {
  return new Promise((resolve) => {
    try {
      const [host, port] = emulatorHost.split(':');
      const req = http.request(
        {
          host: host || '127.0.0.1',
          port: parseInt(port, 10) || 8080,
          path: '/',
          method: 'GET',
          timeout: 1500,
        },
        () => resolve(true)
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}
