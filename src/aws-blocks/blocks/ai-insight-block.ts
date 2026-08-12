/**
 * AiInsightBlock - AI-generated wellness insights grounded in persisted data.
 * AWS Mapping: Amazon Bedrock
 * 
 * Uses controlled typed tools:
 * - getWellnessRecords() - retrieves authenticated user's records
 * - calculateWeeklyStats() - computes averages and trends
 * - generateWellnessSummary() - produces the insight text
 * 
 * Does NOT give AI direct database access.
 * Does NOT allow arbitrary shell, filesystem, network or database operations.
 */

import { Block, BlockDefinition } from '../core/block';
import { blockRegistry } from '../core/registry';
import { WellnessRecord } from '../schemas/wellness';
import { WeeklyStats, WellnessInsightResult } from '../schemas/insight';
import { dataBlock } from './data-block';

export class AiInsightBlockImpl extends Block {
  readonly definition: BlockDefinition = {
    id: 'ai-insight-block',
    name: 'AiInsightBlock',
    description: 'AI-generated wellness insights grounded in persisted data. Maps to Amazon Bedrock in AWS.',
    awsServiceMapping: [
      {
        serviceName: 'Amazon Bedrock',
        serviceDescription: 'Fully managed foundation models for AI/ML inference',
      },
    ],
    cloudFormationMapping: {
      resources: {
        BedrockInvocationRole: {
          type: 'AWS::IAM::Role',
          properties: {
            RoleName: 'WellnessBlockBedrockRole',
            AssumeRolePolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: { Service: 'lambda.amazonaws.com' },
                  Action: 'sts:AssumeRole',
                },
              ],
            },
            Policies: [
              {
                PolicyName: 'BedrockInvokePolicy',
                PolicyDocument: {
                  Version: '2012-10-17',
                  Statement: [
                    {
                      Effect: 'Allow',
                      Action: [
                        'bedrock:InvokeModel',
                        'bedrock:InvokeModelWithResponseStream',
                      ],
                      Resource: '*',
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  };

  // ----- TYPED TOOLS (the only ways AI can access data) -----

  /**
   * Tool: getWellnessRecords
   * Retrieves the authenticated user's wellness records.
   * The AI cannot access anyone else's records.
   */
  getWellnessRecords(userId: string): WellnessRecord[] {
    return dataBlock.query<WellnessRecord>('wellness_records', (record) => record.userId === userId);
  }

  /**
   * Tool: calculateWeeklyStats
   * Computes weekly averages and trends from the user's records.
   */
  calculateWeeklyStats(records: WellnessRecord[]): WeeklyStats {
    if (records.length === 0) {
      return {
        averageSteps: 0,
        averageHydration: 0,
        averageSleep: 0,
        moodTrend: 'no data',
        activityTrend: 'no data',
        recordCount: 0,
      };
    }

    // Sort by date descending and take last 7 records
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const weekRecords = sorted.slice(0, 7);

    const avgSteps = weekRecords.reduce((sum, r) => sum + r.steps, 0) / weekRecords.length;
    const avgHydration = weekRecords.reduce((sum, r) => sum + r.hydrationLiters, 0) / weekRecords.length;
    const avgSleep = weekRecords.reduce((sum, r) => sum + r.sleepHours, 0) / weekRecords.length;

    // Mood trend
    const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
    const moodScores = weekRecords.map(r => moodValues[r.mood] || 3);
    const moodAvg = moodScores.reduce((s, v) => s + v, 0) / moodScores.length;
    let moodTrend: string;
    if (moodAvg >= 4.5) moodTrend = 'excellent';
    else if (moodAvg >= 3.5) moodTrend = 'positive';
    else if (moodAvg >= 2.5) moodTrend = 'neutral';
    else if (moodAvg >= 1.5) moodTrend = 'declining';
    else moodTrend = 'concerning';

    // Activity trend (based on steps)
    let activityTrend: string;
    if (avgSteps >= 10000) activityTrend = 'very active';
    else if (avgSteps >= 7000) activityTrend = 'active';
    else if (avgSteps >= 4000) activityTrend = 'moderate';
    else if (avgSteps >= 2000) activityTrend = 'light';
    else activityTrend = 'sedentary';

    return {
      averageSteps: Math.round(avgSteps),
      averageHydration: Math.round(avgHydration * 10) / 10,
      averageSleep: Math.round(avgSleep * 10) / 10,
      moodTrend,
      activityTrend,
      recordCount: weekRecords.length,
    };
  }

  /**
   * Tool: generateWellnessSummary
   * Produces a concise wellness observation based on calculated stats.
   * This is the deterministic local AI adapter that generates insights
   * from actual persisted wellness data.
   */
  generateWellnessSummary(stats: WeeklyStats, question: string): string {
    if (stats.recordCount === 0) {
      return 'No wellness data recorded yet. Start tracking your daily wellness to get personalized insights!';
    }

    const parts: string[] = [];

    // Opening
    parts.push(`Based on your last ${stats.recordCount} days of wellness data:`);

    // Steps/Activity
    if (stats.activityTrend === 'very active') {
      parts.push(`Your activity level is excellent with an average of ${stats.averageSteps.toLocaleString()} steps per day.`);
    } else if (stats.activityTrend === 'active') {
      parts.push(`You're maintaining good activity with ${stats.averageSteps.toLocaleString()} average daily steps.`);
    } else if (stats.activityTrend === 'moderate') {
      parts.push(`Your activity is moderate at ${stats.averageSteps.toLocaleString()} average daily steps. Consider adding a short walk to boost this.`);
    } else {
      parts.push(`Your activity level is ${stats.activityTrend} at ${stats.averageSteps.toLocaleString()} average daily steps. Try to incorporate more movement into your routine.`);
    }

    // Hydration
    if (stats.averageHydration >= 2.5) {
      parts.push(`Great hydration at ${stats.averageHydration}L per day!`);
    } else if (stats.averageHydration >= 2.0) {
      parts.push(`Your hydration is adequate at ${stats.averageHydration}L per day.`);
    } else {
      parts.push(`Your hydration is at ${stats.averageHydration}L per day. Aim for at least 2L daily.`);
    }

    // Sleep
    if (stats.averageSleep >= 7.5) {
      parts.push(`Excellent sleep pattern averaging ${stats.averageSleep} hours per night.`);
    } else if (stats.averageSleep >= 6.5) {
      parts.push(`Your sleep averaging ${stats.averageSleep} hours is within a reasonable range.`);
    } else {
      parts.push(`Your sleep averaging ${stats.averageSleep} hours is below recommended levels. Consider improving your sleep routine.`);
    }

    // Mood
    parts.push(`Overall mood trend: ${stats.moodTrend}.`);

    return parts.join(' ');
  }

  /**
   * requestWellnessInsight - Main entry point.
   * Uses the typed tools to generate an insight for the authenticated user.
   */
  requestWellnessInsight(userId: string, question: string): WellnessInsightResult {
    // Tool 1: Get user's wellness records
    const records = this.getWellnessRecords(userId);

    // Tool 2: Calculate weekly stats
    const stats = this.calculateWeeklyStats(records);

    // Tool 3: Generate wellness summary
    const insight = this.generateWellnessSummary(stats, question);

    return {
      insight,
      basedOnRecords: records.length,
      weeklyStats: stats,
      disclaimer: 'These observations are based on your recorded wellness data and are not medical advice.',
    };
  }
}

export const aiInsightBlock = new AiInsightBlockImpl();
blockRegistry.register(aiInsightBlock);
