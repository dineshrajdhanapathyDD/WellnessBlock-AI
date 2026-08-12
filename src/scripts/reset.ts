/**
 * Reset Script - Seeds deterministic test data for the MVP demo.
 * 
 * Creates:
 * - Deterministic test users (handled by AuthBlock - in-memory)
 * - Deterministic Alice wellness records (7 days)
 * - Deterministic Bob wellness records (5 days)
 * 
 * Usage: npm run reset
 */

import { dataBlock } from '../aws-blocks/blocks/data-block';
import { WellnessRecord } from '../aws-blocks/schemas/wellness';
import { v4 as uuidv4 } from 'uuid';

// Deterministic UUIDs for reproducible test data
const ALICE_ID = '00000000-0000-0000-0000-000000000001';
const BOB_ID = '00000000-0000-0000-0000-000000000002';

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function createAliceRecords(): WellnessRecord[] {
  const baseDate = new Date();
  const records: WellnessRecord[] = [];

  // Deterministic seed data for Alice - 7 days
  const aliceData = [
    { daysAgo: 6, steps: 8500, hydration: 2.2, sleep: 7.5, mood: 'good' as const, notes: 'Morning jog felt great' },
    { daysAgo: 5, steps: 12000, hydration: 2.8, sleep: 8.0, mood: 'great' as const, notes: 'Went hiking with friends' },
    { daysAgo: 4, steps: 6000, hydration: 1.8, sleep: 6.5, mood: 'okay' as const, notes: 'Busy work day, less movement' },
    { daysAgo: 3, steps: 9200, hydration: 2.5, sleep: 7.0, mood: 'good' as const, notes: 'Evening yoga session' },
    { daysAgo: 2, steps: 10500, hydration: 2.3, sleep: 7.8, mood: 'great' as const, notes: 'Long walk in the park' },
    { daysAgo: 1, steps: 7800, hydration: 2.0, sleep: 7.2, mood: 'good' as const, notes: 'Gym workout' },
    { daysAgo: 0, steps: 4500, hydration: 1.5, sleep: 6.0, mood: 'okay' as const, notes: 'Rest day' },
  ];

  for (let i = 0; i < aliceData.length; i++) {
    const d = aliceData[i];
    const date = getDateDaysAgo(d.daysAgo);
    const createdAt = new Date(baseDate.getTime() - d.daysAgo * 86400000).toISOString();

    records.push({
      id: `a0000000-0000-0000-0000-00000000000${i + 1}`,
      userId: ALICE_ID,
      date,
      steps: d.steps,
      hydrationLiters: d.hydration,
      sleepHours: d.sleep,
      mood: d.mood,
      notes: d.notes,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
  }

  return records;
}

function createBobRecords(): WellnessRecord[] {
  const baseDate = new Date();
  const records: WellnessRecord[] = [];

  // Deterministic seed data for Bob - 5 days
  const bobData = [
    { daysAgo: 4, steps: 5000, hydration: 1.5, sleep: 6.0, mood: 'okay' as const, notes: 'Started new routine' },
    { daysAgo: 3, steps: 6500, hydration: 1.8, sleep: 6.5, mood: 'good' as const, notes: 'Getting better' },
    { daysAgo: 2, steps: 7000, hydration: 2.0, sleep: 7.0, mood: 'good' as const, notes: 'Cycling in the morning' },
    { daysAgo: 1, steps: 4000, hydration: 1.2, sleep: 5.5, mood: 'bad' as const, notes: 'Late night, tired' },
    { daysAgo: 0, steps: 8000, hydration: 2.2, sleep: 7.5, mood: 'great' as const, notes: 'Great recovery day' },
  ];

  for (let i = 0; i < bobData.length; i++) {
    const d = bobData[i];
    const date = getDateDaysAgo(d.daysAgo);
    const createdAt = new Date(baseDate.getTime() - d.daysAgo * 86400000).toISOString();

    records.push({
      id: `b0000000-0000-0000-0000-00000000000${i + 1}`,
      userId: BOB_ID,
      date,
      steps: d.steps,
      hydrationLiters: d.hydration,
      sleepHours: d.sleep,
      mood: d.mood,
      notes: d.notes,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
  }

  return records;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

console.log('WellnessBlock AI - Data Reset');
console.log('=============================\n');

// Clear all existing data
console.log('Clearing existing data...');
dataBlock.clearAll();

// Create wellness records
const aliceRecords = createAliceRecords();
const bobRecords = createBobRecords();

console.log(`Creating ${aliceRecords.length} wellness records for Alice...`);
for (const record of aliceRecords) {
  dataBlock.create('wellness_records', record);
}

console.log(`Creating ${bobRecords.length} wellness records for Bob...`);
for (const record of bobRecords) {
  dataBlock.create('wellness_records', record);
}

console.log('\nDone! Test data has been seeded.');
console.log('\nTest users:');
console.log('  alice@example.com / password123 (USER)');
console.log('  bob@example.com   / password123 (USER)');
console.log('  admin@example.com / admin123    (ADMIN)');
console.log(`\nAlice has ${aliceRecords.length} wellness records.`);
console.log(`Bob has ${bobRecords.length} wellness records.`);
console.log('\nRun "npm run dev" to start the server.');
