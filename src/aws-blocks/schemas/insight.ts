import { z } from 'zod';

export const RequestWellnessInsightInputSchema = z.object({
  question: z.string().min(1),
});
export type RequestWellnessInsightInput = z.infer<typeof RequestWellnessInsightInputSchema>;

export const WeeklyStatsSchema = z.object({
  averageSteps: z.number(),
  averageHydration: z.number(),
  averageSleep: z.number(),
  moodTrend: z.string(),
  activityTrend: z.string(),
  recordCount: z.number().int(),
});
export type WeeklyStats = z.infer<typeof WeeklyStatsSchema>;

export const WellnessInsightResultSchema = z.object({
  insight: z.string(),
  basedOnRecords: z.number().int(),
  weeklyStats: WeeklyStatsSchema.optional(),
  disclaimer: z.literal('These observations are based on your recorded wellness data and are not medical advice.'),
});
export type WellnessInsightResult = z.infer<typeof WellnessInsightResultSchema>;
