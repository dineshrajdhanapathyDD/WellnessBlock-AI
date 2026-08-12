/**
 * AWS AiInsight Adapter - Amazon Bedrock
 * 
 * Production implementation using Amazon Bedrock for AI inference.
 * Block ID: ai-insight-block (preserved)
 * 
 * Architecture:
 *   1. getWellnessRecords() -> Queries DynamoDB via IDataBlockAdapter (authorized)
 *   2. calculateWeeklyStats() -> Pure computation (same as local)
 *   3. generateWellnessSummary() -> Amazon Bedrock InvokeModel
 * 
 * The AI does NOT have direct database access.
 * Data is retrieved through the typed tool interface, authorized by userId.
 * The Bedrock model is configurable via BEDROCK_MODEL_ID.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { IAiInsightBlockAdapter, IDataBlockAdapter } from '../../interfaces';
import { WellnessRecord } from '../../../schemas/wellness';
import { WeeklyStats, WellnessInsightResult } from '../../../schemas/insight';
import { runtimeConfig } from '../../config';
import { AiInsightBlockImpl } from '../../../blocks/ai-insight-block';

export class BedrockAiInsightAdapter implements IAiInsightBlockAdapter {
  private bedrockClient: BedrockRuntimeClient;
  private modelId: string;
  private dataAdapter: IDataBlockAdapter;

  // Reuse the stats calculation logic from the local implementation
  private localImpl: AiInsightBlockImpl;

  constructor(dataAdapter: IDataBlockAdapter) {
    this.bedrockClient = new BedrockRuntimeClient({
      region: runtimeConfig.aws.region,
    });
    this.modelId = runtimeConfig.aws.bedrock.modelId;
    this.dataAdapter = dataAdapter;
    this.localImpl = new AiInsightBlockImpl();
  }

  /**
   * Typed Tool: getWellnessRecords
   * Retrieves ONLY the authenticated user's records via DataBlock.
   * The AI cannot access anyone else's records.
   */
  async getWellnessRecords(userId: string): Promise<WellnessRecord[]> {
    return this.dataAdapter.queryByUserId<WellnessRecord>('wellness_records', userId);
  }

  /**
   * Typed Tool: calculateWeeklyStats
   * Pure computation - reuses existing logic.
   */
  calculateWeeklyStats(records: WellnessRecord[]): WeeklyStats {
    return this.localImpl.calculateWeeklyStats(records);
  }

  /**
   * Typed Tool: generateWellnessSummary
   * Uses Amazon Bedrock to generate a natural-language wellness observation.
   * The model receives ONLY the pre-computed stats, not raw database access.
   */
  async generateWellnessSummary(stats: WeeklyStats, question: string): Promise<string> {
    if (stats.recordCount === 0) {
      return 'No wellness data recorded yet. Start tracking your daily wellness to get personalized insights!';
    }

    const prompt = this.buildPrompt(stats, question);

    try {
      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a wellness assistant. Provide concise, encouraging observations about wellness data. Never diagnose diseases or recommend medication/treatment. Keep responses under 150 words.',
      });

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(body),
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Handle Claude response format
      if (responseBody.content && responseBody.content[0]?.text) {
        return responseBody.content[0].text;
      }

      // Fallback to local generation if response format is unexpected
      return this.localImpl.generateWellnessSummary(stats, question);
    } catch (err: any) {
      // If Bedrock fails (quota, throttle, etc.), fall back to local deterministic summary
      console.warn(`Bedrock inference failed (${err.message}), using local fallback`);
      return this.localImpl.generateWellnessSummary(stats, question);
    }
  }

  /**
   * Main entry point: generate a complete wellness insight.
   */
  async requestWellnessInsight(userId: string, question: string): Promise<WellnessInsightResult> {
    // Tool 1: Get user's wellness records (authorized via userId)
    const records = await this.getWellnessRecords(userId);

    // Tool 2: Calculate weekly stats (pure computation)
    const stats = this.calculateWeeklyStats(records);

    // Tool 3: Generate wellness summary (Bedrock AI)
    const insight = await this.generateWellnessSummary(stats, question);

    return {
      insight,
      basedOnRecords: records.length,
      weeklyStats: stats,
      disclaimer: 'These observations are based on your recorded wellness data and are not medical advice.',
    };
  }

  private buildPrompt(stats: WeeklyStats, question: string): string {
    return `A user asked: "${question}"

Here is their wellness data summary for the past ${stats.recordCount} days:
- Average daily steps: ${stats.averageSteps}
- Average daily hydration: ${stats.averageHydration}L
- Average nightly sleep: ${stats.averageSleep} hours
- Mood trend: ${stats.moodTrend}
- Activity trend: ${stats.activityTrend}

Provide a brief, personalized wellness observation based on this data. Be encouraging and specific. Do not diagnose or recommend treatment.`;
  }
}
