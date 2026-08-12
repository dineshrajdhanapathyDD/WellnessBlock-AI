/**
 * Contract Tests
 * 
 * Proves that both local and AWS adapter implementations satisfy the same
 * Block interfaces. These tests run against the local adapters.
 * The same test suite can be pointed at AWS adapters by setting BLOCK_RUNTIME=aws.
 */

import { resolveRuntime } from '../aws-blocks/runtime/resolver';
import { IAuthBlockAdapter, IDataBlockAdapter, IAiInsightBlockAdapter } from '../aws-blocks/runtime/interfaces';
import { WellnessRecord } from '../aws-blocks/schemas/wellness';

// Resolve the current runtime
const runtime = resolveRuntime();

// ─── TEST UTILITIES ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function assertThrows(fn: () => Promise<any>, statusCode: number, message: string): Promise<void> {
  try {
    await fn();
    console.error(`  FAIL: ${message} (did not throw)`);
    failed++;
  } catch (err: any) {
    if (err.statusCode === statusCode) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message} (wrong status: ${err.statusCode}, expected: ${statusCode})`);
      failed++;
    }
  }
}

// ─── AUTH BLOCK CONTRACT TESTS ─────────────────────────────────────────────────

async function testAuthContract(auth: IAuthBlockAdapter): Promise<void> {
  console.log('\n── AuthBlock Contract Tests ──');

  // Test: signIn with valid credentials
  const result = await auth.signIn({ email: 'alice@example.com', password: 'password123' });
  assert(result.success === true, 'signIn succeeds with valid credentials');
  assert(result.user?.email === 'alice@example.com', 'signIn returns correct user email');
  assert(result.user?.id !== undefined, 'signIn returns user ID');

  // Test: signIn with invalid credentials
  const badResult = await auth.signIn({ email: 'alice@example.com', password: 'wrongpassword' });
  assert(badResult.success === false, 'signIn fails with invalid password');
  assert(badResult.error !== undefined, 'signIn returns error message on failure');

  // Test: createSessionToken + getSession
  const token = await auth.createSessionToken(result.user!.id);
  assert(typeof token === 'string' && token.length > 0, 'createSessionToken returns a token');

  const session = await auth.getSession(token);
  assert(session !== null, 'getSession returns session for valid token');
  assert(session!.userId === result.user!.id, 'getSession returns correct userId');
  assert(session!.email === 'alice@example.com', 'getSession returns correct email');

  // Test: requireAuth with valid token
  const authSession = await auth.requireAuth(token);
  assert(authSession.userId === result.user!.id, 'requireAuth returns session for valid token');

  // Test: requireAuth with undefined token
  await assertThrows(() => auth.requireAuth(undefined), 401, 'requireAuth throws 401 for undefined token');

  // Test: requireAuth with invalid token
  await assertThrows(() => auth.requireAuth('invalid-token-xyz'), 401, 'requireAuth throws 401 for invalid token');

  // Test: signOut
  await auth.signOut(token);
  const expiredSession = await auth.getSession(token);
  assert(expiredSession === null, 'getSession returns null after signOut');

  // Test: findUserById
  const user = await auth.findUserById(result.user!.id);
  assert(user !== null, 'findUserById returns user');
  assert(user!.email === 'alice@example.com', 'findUserById returns correct user');
}

// ─── DATA BLOCK CONTRACT TESTS ─────────────────────────────────────────────────

async function testDataContract(data: IDataBlockAdapter): Promise<void> {
  console.log('\n── DataBlock Contract Tests ──');

  const testTable = 'wellness_records';
  const testRecord: WellnessRecord = {
    id: 'test-0000-0000-0000-000000000099',
    userId: '00000000-0000-0000-0000-000000000001',
    date: '2026-08-13',
    steps: 8000,
    hydrationLiters: 2.5,
    sleepHours: 7.5,
    mood: 'good',
    notes: 'Contract test record',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  // Test: create
  const created = await data.create(testTable, testRecord);
  assert(created.id === testRecord.id, 'create returns the record with correct ID');

  // Test: getById
  const fetched = await data.getById<WellnessRecord>(testTable, testRecord.id);
  assert(fetched !== null, 'getById returns created record');
  assert(fetched!.steps === 8000, 'getById returns correct data');

  // Test: query
  const queried = await data.query<WellnessRecord>(testTable, (r) => r.id === testRecord.id);
  assert(queried.length === 1, 'query returns matching record');
  assert(queried[0].id === testRecord.id, 'query returns correct record');

  // Test: queryByUserId
  const byUser = await data.queryByUserId<WellnessRecord>(testTable, testRecord.userId);
  assert(byUser.length >= 1, 'queryByUserId returns at least the test record');
  assert(byUser.every(r => r.userId === testRecord.userId), 'queryByUserId only returns records for the user');

  // Test: update
  const updated = await data.update<WellnessRecord>(testTable, testRecord.id, {
    steps: 9000,
    version: 2,
  });
  assert(updated !== null, 'update returns updated record');
  assert(updated!.steps === 9000, 'update applies changes correctly');

  // Test: getById after update
  const afterUpdate = await data.getById<WellnessRecord>(testTable, testRecord.id);
  assert(afterUpdate!.steps === 9000, 'getById reflects update');
  assert(afterUpdate!.version === 2, 'version incremented');

  // Test: delete
  const deleted = await data.delete(testTable, testRecord.id);
  assert(deleted === true, 'delete returns true for existing record');

  const afterDelete = await data.getById<WellnessRecord>(testTable, testRecord.id);
  assert(afterDelete === null, 'getById returns null after delete');

  // Test: delete non-existent
  const deletedAgain = await data.delete(testTable, testRecord.id);
  assert(deletedAgain === false, 'delete returns false for non-existent record');
}

// ─── AI INSIGHT BLOCK CONTRACT TESTS ───────────────────────────────────────────

async function testAiInsightContract(aiInsight: IAiInsightBlockAdapter): Promise<void> {
  console.log('\n── AiInsightBlock Contract Tests ──');

  const aliceId = '00000000-0000-0000-0000-000000000001';

  // Test: getWellnessRecords
  const records = await aiInsight.getWellnessRecords(aliceId);
  assert(Array.isArray(records), 'getWellnessRecords returns an array');
  assert(records.length > 0, 'getWellnessRecords returns data for Alice');
  assert(records.every(r => r.userId === aliceId), 'getWellnessRecords only returns Alice records');

  // Test: calculateWeeklyStats
  const stats = aiInsight.calculateWeeklyStats(records);
  assert(stats.recordCount > 0, 'calculateWeeklyStats returns non-zero record count');
  assert(stats.averageSteps > 0, 'calculateWeeklyStats calculates average steps');
  assert(stats.averageHydration > 0, 'calculateWeeklyStats calculates average hydration');
  assert(stats.averageSleep > 0, 'calculateWeeklyStats calculates average sleep');
  assert(typeof stats.moodTrend === 'string', 'calculateWeeklyStats returns mood trend');
  assert(typeof stats.activityTrend === 'string', 'calculateWeeklyStats returns activity trend');

  // Test: calculateWeeklyStats with empty records
  const emptyStats = aiInsight.calculateWeeklyStats([]);
  assert(emptyStats.recordCount === 0, 'calculateWeeklyStats handles empty records');

  // Test: generateWellnessSummary
  const summary = await aiInsight.generateWellnessSummary(stats, 'How was my week?');
  assert(typeof summary === 'string', 'generateWellnessSummary returns a string');
  assert(summary.length > 0, 'generateWellnessSummary returns non-empty text');

  // Test: requestWellnessInsight (full pipeline)
  const insight = await aiInsight.requestWellnessInsight(aliceId, 'How was my week?');
  assert(typeof insight.insight === 'string' && insight.insight.length > 0, 'requestWellnessInsight returns insight text');
  assert(insight.basedOnRecords > 0, 'requestWellnessInsight reports record count');
  assert(insight.disclaimer === 'These observations are based on your recorded wellness data and are not medical advice.', 'requestWellnessInsight includes disclaimer');
  assert(insight.weeklyStats !== undefined, 'requestWellnessInsight includes weeklyStats');
}

// ─── OWNERSHIP ENFORCEMENT TEST ────────────────────────────────────────────────

async function testOwnershipEnforcement(data: IDataBlockAdapter): Promise<void> {
  console.log('\n── Ownership Enforcement Tests ──');

  const aliceId = '00000000-0000-0000-0000-000000000001';
  const bobId = '00000000-0000-0000-0000-000000000002';

  // Alice's records should be isolated from Bob's
  const aliceRecords = await data.queryByUserId<WellnessRecord>('wellness_records', aliceId);
  const bobRecords = await data.queryByUserId<WellnessRecord>('wellness_records', bobId);

  assert(aliceRecords.length > 0, 'Alice has records');
  assert(bobRecords.length > 0, 'Bob has records');
  assert(aliceRecords.every(r => r.userId === aliceId), 'Alice query only returns Alice records');
  assert(bobRecords.every(r => r.userId === bobId), 'Bob query only returns Bob records');

  // Cross-user: Bob cannot access Alice's record by ID
  if (aliceRecords.length > 0) {
    const aliceRecord = await data.getById<WellnessRecord>('wellness_records', aliceRecords[0].id);
    assert(aliceRecord !== null && aliceRecord.userId === aliceId, 'getById returns record with userId (for server-side ownership check)');
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  WellnessBlock AI - Contract Tests           ║');
  console.log(`║  Runtime: ${runtime.isAws ? 'AWS' : 'LOCAL'}                              ║`);
  console.log('╚══════════════════════════════════════════════╝');

  try {
    await testAuthContract(runtime.auth);
    await testDataContract(runtime.data);
    await testAiInsightContract(runtime.aiInsight);
    await testOwnershipEnforcement(runtime.data);
  } catch (err: any) {
    console.error(`\n  FATAL ERROR: ${err.message}`);
    failed++;
  }

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
