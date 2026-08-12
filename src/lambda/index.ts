/**
 * AWS Lambda Handler
 * 
 * Wraps the Express application for API Gateway proxy integration
 * using serverless-http. This is the production entry point.
 */

import serverless from 'serverless-http';
import express from 'express';
import { authBlock, dataBlock, apiBlock, aiInsightBlock, cloudFormationBlock } from '../aws-blocks/blocks';
import { SignInInputSchema } from '../aws-blocks/schemas/auth';
import {
  CreateWellnessRecordInputSchema,
  UpdateWellnessRecordInputSchema,
  WellnessRecord,
} from '../aws-blocks/schemas/wellness';
import { RequestWellnessInsightInputSchema } from '../aws-blocks/schemas/insight';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// ─── CORS ──────────────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ─── AUTH helpers (token-based for Lambda) ─────────────────────────────────────

function getToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.substring(7);
  return undefined;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getToken(req);
  try {
    const session = authBlock.requireAuth(token);
    (req as any).userId = session.userId;
    (req as any).authSession = session;
    next();
  } catch (err: any) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }
}

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────────

app.post('/api/auth/signin', (req, res) => {
  try {
    const parsed = SignInInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid input' });
    const result = authBlock.signIn(parsed.data);
    if (result.success && result.user) {
      const token = authBlock.createSessionToken(result.user.id);
      return res.json({ ...result, token });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/signout', (req, res) => {
  const token = getToken(req);
  if (token) authBlock.signOut(token);
  return res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ user: null });
  const session = authBlock.getSession(token);
  if (!session) return res.json({ user: null });
  const user = authBlock.findUserById(session.userId);
  if (!user) return res.json({ user: null });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ─── WELLNESS CRUD ─────────────────────────────────────────────────────────────

app.post('/api/wellness', requireAuth, (req, res) => {
  try {
    const parsed = CreateWellnessRecordInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    const userId = (req as any).userId;
    const now = new Date().toISOString();
    const record: WellnessRecord = {
      id: uuidv4(), userId, date: parsed.data.date,
      steps: parsed.data.steps, hydrationLiters: parsed.data.hydrationLiters,
      sleepHours: parsed.data.sleepHours, mood: parsed.data.mood,
      notes: parsed.data.notes, createdAt: now, updatedAt: now, version: 1,
    };
    dataBlock.create('wellness_records', record);
    return res.status(201).json({ record });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

app.get('/api/wellness', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    let records = dataBlock.query<WellnessRecord>('wellness_records', (r) => r.userId === userId);
    const { startDate, endDate, limit } = req.query;
    if (startDate) records = records.filter(r => r.date >= (startDate as string));
    if (endDate) records = records.filter(r => r.date <= (endDate as string));
    records.sort((a, b) => b.date.localeCompare(a.date));
    if (limit) records = records.slice(0, parseInt(limit as string, 10));
    return res.json({ records });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

app.get('/api/wellness/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const record = dataBlock.getById<WellnessRecord>('wellness_records', req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    try { apiBlock.enforceOwnership(record.userId, userId); }
    catch (e: any) { return res.status(403).json({ error: e.message }); }
    return res.json({ record });
  } catch (err: any) { return res.status(err.statusCode || 500).json({ error: err.message }); }
});

app.put('/api/wellness/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const parsed = UpdateWellnessRecordInputSchema.safeParse({ ...req.body, id: req.params.id });
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const existing = dataBlock.getById<WellnessRecord>('wellness_records', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    try { apiBlock.enforceOwnership(existing.userId, userId); }
    catch (e: any) { return res.status(403).json({ error: e.message }); }
    const { id, ...updates } = parsed.data;
    const updatedRecord = dataBlock.update<WellnessRecord>('wellness_records', req.params.id, {
      ...updates, updatedAt: new Date().toISOString(), version: existing.version + 1,
    });
    return res.json({ record: updatedRecord });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── AI INSIGHT ────────────────────────────────────────────────────────────────

app.post('/api/insight', requireAuth, (req, res) => {
  try {
    const parsed = RequestWellnessInsightInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const userId = (req as any).userId;
    const result = aiInsightBlock.requestWellnessInsight(userId, parsed.data.question);
    return res.json(result);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── HEALTH ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', runtime: 'lambda', timestamp: new Date().toISOString() });
});

// ─── EXPORT HANDLER ────────────────────────────────────────────────────────────

export const handler = serverless(app);
