import { z } from 'zod';

export const MoodSchema = z.enum(['great', 'good', 'okay', 'bad', 'terrible']);
export type Mood = z.infer<typeof MoodSchema>;

export const WellnessRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string(), // ISO date string YYYY-MM-DD
  steps: z.number().int().min(0),
  hydrationLiters: z.number().min(0),
  sleepHours: z.number().min(0).max(24),
  mood: MoodSchema,
  notes: z.string().optional(),
  createdAt: z.string(), // ISO datetime
  updatedAt: z.string(), // ISO datetime
  version: z.number().int().min(1),
});
export type WellnessRecord = z.infer<typeof WellnessRecordSchema>;

export const CreateWellnessRecordInputSchema = z.object({
  date: z.string(),
  steps: z.number().int().min(0),
  hydrationLiters: z.number().min(0),
  sleepHours: z.number().min(0).max(24),
  mood: MoodSchema,
  notes: z.string().optional(),
});
export type CreateWellnessRecordInput = z.infer<typeof CreateWellnessRecordInputSchema>;

export const UpdateWellnessRecordInputSchema = z.object({
  id: z.string().uuid(),
  date: z.string().optional(),
  steps: z.number().int().min(0).optional(),
  hydrationLiters: z.number().min(0).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  mood: MoodSchema.optional(),
  notes: z.string().optional(),
});
export type UpdateWellnessRecordInput = z.infer<typeof UpdateWellnessRecordInputSchema>;

export const ListWellnessRecordsInputSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type ListWellnessRecordsInput = z.infer<typeof ListWellnessRecordsInputSchema>;

export const GetWellnessRecordInputSchema = z.object({
  id: z.string().uuid(),
});
export type GetWellnessRecordInput = z.infer<typeof GetWellnessRecordInputSchema>;
