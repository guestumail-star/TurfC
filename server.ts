import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Persistent server store path
const STORE_PATH = path.resolve(__dirname, '.server-store.json');

// Memory stores
let memoryPlayers: any[] = [];
let memoryTeams: any[] = [];
let memoryMatches: any[] = [];

// Load persisted server data if available and strip out legacy fake data
const FAKE_PLAYER_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
const FAKE_TEAM_IDS = ['t1', 't2'];
const FAKE_MATCH_IDS = ['m1'];

function loadLocalStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const data = JSON.parse(raw);

      if (Array.isArray(data.players)) {
        memoryPlayers = data.players.filter((p: any) => !FAKE_PLAYER_IDS.includes(p.id));
      }
      if (Array.isArray(data.teams)) {
        memoryTeams = data.teams.filter((t: any) => !FAKE_TEAM_IDS.includes(t.id));
      }
      if (Array.isArray(data.matches)) {
        memoryMatches = data.matches.filter((m: any) => !FAKE_MATCH_IDS.includes(m.id));
      }
      saveLocalStore();
      console.log('[Server] Loaded persisted data from server disk store');
    }
  } catch (err) {
    console.warn('[Server] Error reading server store:', err);
  }
}

// Persist server data to disk
function saveLocalStore() {
  try {
    const payload = {
      players: memoryPlayers,
      teams: memoryTeams,
      matches: memoryMatches,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Error writing to server store:', err);
  }
}

loadLocalStore();

// MongoDB State
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let currentMongoUri: string = process.env.MONGODB_URI || '';
let currentDbName: string = process.env.MONGODB_DB_NAME || 'cricket_db';
let connectionError: string | null = null;

// Purge any fake legacy records permanently from memory & MongoDB
async function purgeFakeData(db?: Db | null) {
  memoryPlayers = memoryPlayers.filter(p => !FAKE_PLAYER_IDS.includes(p.id));
  memoryTeams = memoryTeams.filter(t => !FAKE_TEAM_IDS.includes(t.id));
  memoryMatches = memoryMatches.filter(m => !FAKE_MATCH_IDS.includes(m.id));
  saveLocalStore();

  const targetDb = db || mongoDb;
  if (targetDb) {
    try {
      await targetDb.collection('players').deleteMany({ id: { $in: FAKE_PLAYER_IDS } });
      await targetDb.collection('teams').deleteMany({ id: { $in: FAKE_TEAM_IDS } });
      await targetDb.collection('matches').deleteMany({ id: { $in: FAKE_MATCH_IDS } });
      console.log('[Server] Purged all default fake data from MongoDB collections');
    } catch (err) {
      console.warn('[Server] Error purging fake data from MongoDB:', err);
    }
  }
}

purgeFakeData();

// Helper to sanitize URI for public display (mask password)
function maskUri(uri: string): string {
  if (!uri) return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, '$1******$3');
}

// Function to connect to MongoDB
async function connectToMongo(uri: string, dbName: string = 'cricket_db'): Promise<{ ok: boolean; message: string; pingMs?: number }> {
  if (!uri) {
    return { ok: false, message: 'MongoDB connection string (URI) is required.' };
  }

  const startTime = Date.now();
  try {
    // If an existing client is open, close it cleanly
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (closeErr) {
        console.warn('Warning closing previous mongo client:', closeErr);
      }
      mongoClient = null;
      mongoDb = null;
    }

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });

    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    const pingMs = Date.now() - startTime;

    mongoClient = client;
    mongoDb = db;
    currentMongoUri = uri;
    currentDbName = dbName;
    connectionError = null;

    console.log(`[MongoDB] Connected successfully to database "${dbName}" in ${pingMs}ms`);

    // Purge any legacy fake data if present
    await purgeFakeData(db);

    return { ok: true, message: `Connected to MongoDB database "${dbName}" successfully!`, pingMs };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[MongoDB] Connection error:', errorMsg);
    connectionError = errorMsg;
    return { ok: false, message: errorMsg };
  }
}

// Auto-connect if MONGODB_URI is provided in environment variables
if (currentMongoUri) {
  console.log('[MongoDB] MONGODB_URI found in environment, connecting...');
  connectToMongo(currentMongoUri, currentDbName).catch(err => {
    console.warn('[MongoDB] Initial auto-connection failed:', err.message);
  });
}

// --- API Endpoints ---

// Database Status
app.get('/api/mongodb/status', async (_req, res) => {
  const isConnected = !!(mongoClient && mongoDb);
  let counts = {
    players: memoryPlayers.length,
    teams: memoryTeams.length,
    matches: memoryMatches.length,
  };

  let pingMs: number | null = null;

  if (isConnected && mongoDb) {
    try {
      const start = Date.now();
      await mongoDb.command({ ping: 1 });
      pingMs = Date.now() - start;

      const [pCount, tCount, mCount] = await Promise.all([
        mongoDb.collection('players').countDocuments(),
        mongoDb.collection('teams').countDocuments(),
        mongoDb.collection('matches').countDocuments(),
      ]);

      counts = {
        players: pCount,
        teams: tCount,
        matches: mCount,
      };
    } catch (pingErr: any) {
      connectionError = pingErr?.message || 'Connection ping failed';
    }
  }

  res.json({
    connected: isConnected,
    uri: maskUri(currentMongoUri),
    isConfigured: !!currentMongoUri,
    dbName: currentDbName,
    error: connectionError,
    pingMs,
    collections: counts,
  });
});

// Test Connection (without applying)
app.post('/api/mongodb/test', async (req, res) => {
  const { uri, dbName = 'cricket_db' } = req.body || {};
  if (!uri) {
    return res.status(400).json({ ok: false, message: 'URI is required' });
  }

  const start = Date.now();
  let testClient: MongoClient | null = null;
  try {
    testClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 8000,
    });
    await testClient.connect();
    const testDb = testClient.db(dbName);
    await testDb.command({ ping: 1 });
    const pingMs = Date.now() - start;
    const collections = await testDb.listCollections().toArray();

    await testClient.close();
    return res.json({
      ok: true,
      message: `Connection successful! Ping: ${pingMs}ms`,
      pingMs,
      dbName,
      existingCollections: collections.map(c => c.name),
    });
  } catch (err: any) {
    if (testClient) {
      try { await testClient.close(); } catch (_) {}
    }
    return res.status(400).json({
      ok: false,
      message: err?.message || 'Failed to connect to MongoDB cluster.',
    });
  }
});

// Connect to MongoDB
app.post('/api/mongodb/connect', async (req, res) => {
  const { uri, dbName = 'cricket_db' } = req.body || {};
  if (!uri) {
    return res.status(400).json({ ok: false, message: 'MongoDB URI is required.' });
  }

  const result = await connectToMongo(uri, dbName);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

// Disconnect from MongoDB
app.post('/api/mongodb/disconnect', async (_req, res) => {
  if (mongoClient) {
    try {
      await mongoClient.close();
    } catch (e) {
      console.warn('Error during disconnect:', e);
    }
    mongoClient = null;
    mongoDb = null;
  }
  currentMongoUri = '';
  connectionError = null;
  res.json({ ok: true, message: 'Disconnected from MongoDB' });
});

// --- Players CRUD ---
app.get('/api/players', async (_req, res) => {
  try {
    if (mongoDb) {
      const docs = await mongoDb.collection('players').find().toArray();
      const players = docs.map(({ _id, ...rest }) => rest);
      return res.json(players);
    }
    res.json(memoryPlayers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const player = req.body;
    if (!player || !player.id) {
      return res.status(400).json({ error: 'Player data with id is required' });
    }

    if (mongoDb) {
      const { _id, ...cleanPlayer } = player;
      await mongoDb.collection('players').updateOne(
        { id: player.id },
        { $set: cleanPlayer },
        { upsert: true }
      );
    }

    const idx = memoryPlayers.findIndex(p => p.id === player.id);
    if (idx >= 0) {
      memoryPlayers[idx] = player;
    } else {
      memoryPlayers.push(player);
    }
    saveLocalStore();

    res.json({ ok: true, player });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoDb) {
      await mongoDb.collection('players').deleteOne({ id });
    }
    memoryPlayers = memoryPlayers.filter(p => p.id !== id);
    saveLocalStore();
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Teams CRUD ---
app.get('/api/teams', async (_req, res) => {
  try {
    if (mongoDb) {
      const docs = await mongoDb.collection('teams').find().toArray();
      const teams = docs.map(({ _id, ...rest }) => rest);
      return res.json(teams);
    }
    res.json(memoryTeams);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const team = req.body;
    if (!team || !team.id) {
      return res.status(400).json({ error: 'Team data with id is required' });
    }

    if (mongoDb) {
      const { _id, ...cleanTeam } = team;
      await mongoDb.collection('teams').updateOne(
        { id: team.id },
        { $set: cleanTeam },
        { upsert: true }
      );
    }

    const idx = memoryTeams.findIndex(t => t.id === team.id);
    if (idx >= 0) {
      memoryTeams[idx] = team;
    } else {
      memoryTeams.push(team);
    }
    saveLocalStore();

    res.json({ ok: true, team });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoDb) {
      await mongoDb.collection('teams').deleteOne({ id });
    }
    memoryTeams = memoryTeams.filter(t => t.id !== id);
    saveLocalStore();
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Matches CRUD ---
app.get('/api/matches', async (_req, res) => {
  try {
    if (mongoDb) {
      const docs = await mongoDb.collection('matches').find().sort({ createdAt: -1 }).toArray();
      const matches = docs.map(({ _id, ...rest }) => rest);
      return res.json(matches);
    }
    // Sort memory matches by createdAt descending
    const sorted = [...memoryMatches].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/matches', async (req, res) => {
  try {
    const match = req.body;
    if (!match || !match.id) {
      return res.status(400).json({ error: 'Match data with id is required' });
    }

    if (mongoDb) {
      const { _id, ...cleanMatch } = match;
      await mongoDb.collection('matches').updateOne(
        { id: match.id },
        { $set: cleanMatch },
        { upsert: true }
      );
    }

    const idx = memoryMatches.findIndex(m => m.id === match.id);
    if (idx >= 0) {
      memoryMatches[idx] = match;
    } else {
      memoryMatches.unshift(match);
    }
    saveLocalStore();

    res.json({ ok: true, match });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/matches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoDb) {
      await mongoDb.collection('matches').deleteOne({ id });
    }
    memoryMatches = memoryMatches.filter(m => m.id !== id);
    saveLocalStore();
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Vite Middleware (Dev) & Static Serving (Prod) ---
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Turf Scorecards running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Failed to start server:', err);
});
