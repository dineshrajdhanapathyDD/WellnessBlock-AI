/**
 * WellnessBlock AI - Express Server
 * 
 * All APIs enforce authentication via AuthBlock.
 * The backend derives the current user from the authenticated session.
 * Never trusts userId supplied by the frontend.
 */

import express from 'express';
import session from 'express-session';
import path from 'path';
import { authBlock, dataBlock, apiBlock, aiInsightBlock, cloudFormationBlock } from '../aws-blocks/blocks';
import { SignInInputSchema } from '../aws-blocks/schemas/auth';
import {
  CreateWellnessRecordInputSchema,
  UpdateWellnessRecordInputSchema,
  ListWellnessRecordsInputSchema,
  WellnessRecord,
} from '../aws-blocks/schemas/wellness';
import { RequestWellnessInsightInputSchema } from '../aws-blocks/schemas/insight';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(session({
  secret: 'wellnessblock-local-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // local dev
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────────

app.post('/api/auth/signin', (req, res) => {
  try {
    const parsed = SignInInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }
    const result = authBlock.signIn(parsed.data);
    if (result.success && result.user) {
      // Store session token in express session
      const token = authBlock.createSessionToken(result.user.id);
      (req.session as any).authToken = token;
      return res.json({ ...result, token });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/signout', (req, res) => {
  const token = (req.session as any)?.authToken;
  if (token) {
    authBlock.signOut(token);
  }
  req.session.destroy(() => {});
  return res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  let token = (req.session as any)?.authToken;
  if (!token) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) token = auth.substring(7);
  }
  if (!token) {
    return res.json({ user: null });
  }
  const session = authBlock.getSession(token);
  if (!session) {
    return res.json({ user: null });
  }
  const user = authBlock.findUserById(session.userId);
  if (!user) {
    return res.json({ user: null });
  }
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// ─── AUTH MIDDLEWARE ────────────────────────────────────────────────────────────

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Support both session-based (local) and Bearer token (Lambda/Amplify)
  let token = (req.session as any)?.authToken;
  if (!token) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.substring(7);
    }
  }
  try {
    const authSession = authBlock.requireAuth(token);
    (req as any).userId = authSession.userId;
    (req as any).authSession = authSession;
    next();
  } catch (err: any) {
    const status = err.statusCode || 401;
    return res.status(status).json({ error: err.message });
  }
}

// ─── WELLNESS CRUD ROUTES ──────────────────────────────────────────────────────

// Create
app.post('/api/wellness', requireAuth, (req, res) => {
  try {
    const parsed = CreateWellnessRecordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const userId = (req as any).userId;
    const now = new Date().toISOString();

    const record: WellnessRecord = {
      id: uuidv4(),
      userId,
      date: parsed.data.date,
      steps: parsed.data.steps,
      hydrationLiters: parsed.data.hydrationLiters,
      sleepHours: parsed.data.sleepHours,
      mood: parsed.data.mood,
      notes: parsed.data.notes,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    dataBlock.create('wellness_records', record);
    return res.status(201).json({ record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// List (user's own records only)
app.get('/api/wellness', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const { startDate, endDate, limit } = req.query;

    let records = dataBlock.query<WellnessRecord>('wellness_records', (r) => r.userId === userId);

    // Apply date filters
    if (startDate) {
      records = records.filter(r => r.date >= (startDate as string));
    }
    if (endDate) {
      records = records.filter(r => r.date <= (endDate as string));
    }

    // Sort by date descending
    records.sort((a, b) => b.date.localeCompare(a.date));

    // Apply limit
    if (limit) {
      records = records.slice(0, parseInt(limit as string, 10));
    }

    return res.json({ records });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single record (ownership enforced)
app.get('/api/wellness/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const record = dataBlock.getById<WellnessRecord>('wellness_records', req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Ownership enforcement - happens server-side
    try {
      apiBlock.enforceOwnership(record.userId, userId);
    } catch (ownershipErr: any) {
      return res.status(403).json({ error: ownershipErr.message });
    }

    return res.json({ record });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Update (ownership enforced)
app.put('/api/wellness/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const parsed = UpdateWellnessRecordInputSchema.safeParse({ ...req.body, id: req.params.id });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const existing = dataBlock.getById<WellnessRecord>('wellness_records', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Ownership enforcement
    try {
      apiBlock.enforceOwnership(existing.userId, userId);
    } catch (ownershipErr: any) {
      return res.status(403).json({ error: ownershipErr.message });
    }

    const { id, ...updates } = parsed.data;
    const updatedRecord = dataBlock.update<WellnessRecord>('wellness_records', req.params.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    });

    return res.json({ record: updatedRecord });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── AI INSIGHT ROUTE ──────────────────────────────────────────────────────────

app.post('/api/insight', requireAuth, (req, res) => {
  try {
    const parsed = RequestWellnessInsightInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const userId = (req as any).userId;
    const result = aiInsightBlock.requestWellnessInsight(userId, parsed.data.question);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ARCHITECTURE & CLOUDFORMATION ROUTES ──────────────────────────────────────

app.get('/api/architecture', (req, res) => {
  const blocks = cloudFormationBlock.getArchitectureInfo();
  return res.json({ blocks });
});

app.get('/api/cloudformation', (req, res) => {
  const template = cloudFormationBlock.generateCloudFormation();
  return res.json({ template });
});

// ─── TEST HELPER: Get Alice's first record ID (for cross-user test) ────────────

app.get('/api/test/alice-record', requireAuth, (req, res) => {
  const aliceId = '00000000-0000-0000-0000-000000000001';
  const records = dataBlock.query<WellnessRecord>('wellness_records', (r) => r.userId === aliceId);
  if (records.length === 0) {
    return res.status(404).json({ error: 'No records for Alice' });
  }
  return res.json({ recordId: records[0].id });
});

// ─── CATCH ALL: Serve frontend ─────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

// ─── START SERVER ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  WellnessBlock AI MVP`);
  console.log(`  ====================`);
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log(`  `);
  console.log(`  Test users:`);
  console.log(`    alice@example.com / password123`);
  console.log(`    bob@example.com   / password123`);
  console.log(`    admin@example.com / admin123`);
  console.log(`  `);
  console.log(`  Run 'npm run reset' to seed deterministic test data.`);
  console.log('');
});
