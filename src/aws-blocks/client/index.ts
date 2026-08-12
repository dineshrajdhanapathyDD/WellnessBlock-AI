/**
 * Client API - Typed methods used by the frontend.
 * This is the ONLY way the frontend communicates with the backend.
 * 
 * Internally uses fetch to the local Express server, but this is
 * encapsulated - the frontend never calls fetch() directly.
 */

import {
  SignInInput,
  SignInResult,
  User,
} from '../schemas/auth';
import {
  WellnessRecord,
  CreateWellnessRecordInput,
  UpdateWellnessRecordInput,
  ListWellnessRecordsInput,
  GetWellnessRecordInput,
} from '../schemas/wellness';
import {
  RequestWellnessInsightInput,
  WellnessInsightResult,
} from '../schemas/insight';
import { CloudFormationTemplate, BlockArchitectureInfo } from '../blocks/cloudformation-block';

const BASE_URL = 'http://localhost:3000/api';

async function jsonResponse<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function throwOnError(res: Response): Promise<void> {
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

class WellnessApi {
  // Auth
  async signIn(input: SignInInput): Promise<SignInResult> {
    const res = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    return jsonResponse<SignInResult>(res);
  }

  async signOut(): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/auth/signout`, {
      method: 'POST',
      credentials: 'include',
    });
    return jsonResponse<{ success: boolean }>(res);
  }

  async getCurrentUser(): Promise<{ user: User | null }> {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      credentials: 'include',
    });
    return jsonResponse<{ user: User | null }>(res);
  }

  // Wellness Records
  async createWellnessRecord(input: CreateWellnessRecordInput): Promise<{ record: WellnessRecord }> {
    const res = await fetch(`${BASE_URL}/wellness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    await throwOnError(res.clone());
    return jsonResponse<{ record: WellnessRecord }>(res);
  }

  async listWellnessRecords(input?: ListWellnessRecordsInput): Promise<{ records: WellnessRecord[] }> {
    const params = new URLSearchParams();
    if (input?.startDate) params.set('startDate', input.startDate);
    if (input?.endDate) params.set('endDate', input.endDate);
    if (input?.limit) params.set('limit', String(input.limit));

    const res = await fetch(`${BASE_URL}/wellness?${params.toString()}`, {
      credentials: 'include',
    });
    await throwOnError(res.clone());
    return jsonResponse<{ records: WellnessRecord[] }>(res);
  }

  async getWellnessRecord(input: GetWellnessRecordInput): Promise<{ record: WellnessRecord }> {
    const res = await fetch(`${BASE_URL}/wellness/${input.id}`, {
      credentials: 'include',
    });
    await throwOnError(res.clone());
    return jsonResponse<{ record: WellnessRecord }>(res);
  }

  async updateWellnessRecord(input: UpdateWellnessRecordInput): Promise<{ record: WellnessRecord }> {
    const res = await fetch(`${BASE_URL}/wellness/${input.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    await throwOnError(res.clone());
    return jsonResponse<{ record: WellnessRecord }>(res);
  }

  // AI Insight
  async requestWellnessInsight(input: RequestWellnessInsightInput): Promise<WellnessInsightResult> {
    const res = await fetch(`${BASE_URL}/insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    await throwOnError(res.clone());
    return jsonResponse<WellnessInsightResult>(res);
  }

  // Architecture & CloudFormation
  async getArchitecture(): Promise<{ blocks: BlockArchitectureInfo[] }> {
    const res = await fetch(`${BASE_URL}/architecture`, {
      credentials: 'include',
    });
    return jsonResponse<{ blocks: BlockArchitectureInfo[] }>(res);
  }

  async generateCloudFormation(): Promise<{ template: CloudFormationTemplate }> {
    const res = await fetch(`${BASE_URL}/cloudformation`, {
      credentials: 'include',
    });
    return jsonResponse<{ template: CloudFormationTemplate }>(res);
  }

  // Test endpoints
  async testUnauthorizedAccess(recordId: string): Promise<{ status: number; error: string }> {
    const res = await fetch(`${BASE_URL}/wellness/${recordId}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      return { status: res.status, error: body.error || '' };
    }
    return { status: 200, error: '' };
  }
}

export const wellnessApi = new WellnessApi();
