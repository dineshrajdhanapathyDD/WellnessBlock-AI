/**
 * Local AiInsight Adapter
 * 
 * Wraps the existing AiInsightBlockImpl to conform to IAiInsightBlockAdapter.
 * Uses the deterministic local AI logic (no external model needed).
 */

import { IAiInsightBlockAdapter } from '../../interfaces';
import { WellnessRecord } from '../../../schemas/wellness';
import { WeeklyStats, WellnessInsightResult } from '../../../schemas/insight';
import { AiInsightBlockImpl } from '../../../blocks/ai-insight-block';

export class LocalAiInsightAdapter implements IAiInsightBlockAdapter {
  private impl: AiInsightBlockImpl;

  constructor(impl: AiInsightBlockImpl) {
    this.impl = impl;
  }

  async getWellnessRecords(userId: string): Promise<WellnessRecord[]> {
    return this.impl.getWellnessRecords(userId);
  }

  calculateWeeklyStats(records: WellnessRecord[]): WeeklyStats {
    return this.impl.calculateWeeklyStats(records);
  }

  async generateWellnessSummary(stats: WeeklyStats, question: string): Promise<string> {
    return this.impl.generateWellnessSummary(stats, question);
  }

  async requestWellnessInsight(userId: string, question: string): Promise<WellnessInsightResult> {
    return this.impl.requestWellnessInsight(userId, question);
  }
}
