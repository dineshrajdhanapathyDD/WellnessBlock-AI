/**
 * Abstract Block Interfaces
 * 
 * These interfaces define the contract that both local and AWS implementations must satisfy.
 * The server and business logic program against these interfaces, not concrete implementations.
 */

import { AuthSession, SignInInput, SignInResult, User, UserRole } from '../schemas/auth';
import { WellnessRecord } from '../schemas/wellness';
import { WeeklyStats, WellnessInsightResult } from '../schemas/insight';

// ─── IAuthBlockAdapter ─────────────────────────────────────────────────────────

export interface IAuthBlockAdapter {
  /** Sign in with email/password. Returns session result. */
  signIn(input: SignInInput): Promise<SignInResult>;

  /** Invalidate the given session token. */
  signOut(sessionToken: string): Promise<void>;

  /** Retrieve the current session from a token. Returns null if invalid. */
  getSession(sessionToken: string): Promise<AuthSession | null>;

  /** Create a new session token for a user ID. */
  createSessionToken(userId: string): Promise<string>;

  /** Validate session token and return session. Throws 401 if invalid. */
  requireAuth(sessionToken: string | undefined): Promise<AuthSession>;

  /** Find user by ID. Returns null if not found. */
  findUserById(id: string): Promise<User | null>;
}

// ─── IDataBlockAdapter ─────────────────────────────────────────────────────────

export interface IDataBlockAdapter {
  /** Create a record in the specified table. */
  create<T extends { id: string }>(tableName: string, record: T): Promise<T>;

  /** Get a single record by primary key (id). */
  getById<T extends { id: string }>(tableName: string, id: string): Promise<T | null>;

  /** Query records by a filter. For DynamoDB, supports userId+date access pattern. */
  query<T>(tableName: string, filter: (record: T) => boolean): Promise<T[]>;

  /** Query by userId (primary access pattern for DynamoDB GSI). */
  queryByUserId<T>(tableName: string, userId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<T[]>;

  /** Update a record by ID with partial fields. Returns updated record or null. */
  update<T extends { id: string }>(tableName: string, id: string, updates: Partial<T>): Promise<T | null>;

  /** Delete a record by ID. Returns true if deleted. */
  delete(tableName: string, id: string): Promise<boolean>;

  /** Get all records from a table. */
  getAll<T>(tableName: string): Promise<T[]>;

  /** Clear all data in a table. */
  clearTable(tableName: string): Promise<void>;

  /** Clear all data (used by reset script). */
  clearAll(): Promise<void>;
}

// ─── IAiInsightBlockAdapter ────────────────────────────────────────────────────

export interface IAiInsightBlockAdapter {
  /** Retrieve wellness records for the authenticated user (typed tool). */
  getWellnessRecords(userId: string): Promise<WellnessRecord[]>;

  /** Calculate weekly stats from records (typed tool). */
  calculateWeeklyStats(records: WellnessRecord[]): WeeklyStats;

  /** Generate a wellness summary from stats and question (typed tool / AI inference). */
  generateWellnessSummary(stats: WeeklyStats, question: string): Promise<string>;

  /** Main entry point: generate a complete wellness insight. */
  requestWellnessInsight(userId: string, question: string): Promise<WellnessInsightResult>;
}
