import { Match, Player, Team } from '../types';

export interface MongoStatus {
  connected: boolean;
  uri: string;
  isConfigured: boolean;
  dbName: string;
  error: string | null;
  pingMs: number | null;
  collections: {
    players: number;
    teams: number;
    matches: number;
  };
}

/**
 * Fetch current MongoDB connection and collection status from backend
 */
export async function fetchMongoStatus(): Promise<MongoStatus> {
  try {
    const res = await fetch('/api/mongodb/status');
    if (!res.ok) {
      throw new Error(`Status check failed: ${res.statusText}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      uri: '',
      isConfigured: false,
      dbName: 'cricket_db',
      error: err?.message || 'Unable to connect to backend server',
      pingMs: null,
      collections: { players: 0, teams: 0, matches: 0 },
    };
  }
}

/**
 * Test a MongoDB connection string without persisting
 */
export async function testMongoConnection(
  uri: string,
  dbName: string = 'cricket_db'
): Promise<{ ok: boolean; message: string; pingMs?: number; existingCollections?: string[] }> {
  try {
    const res = await fetch('/api/mongodb/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, dbName }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.message || 'Connection test failed' };
    }
    return data;
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Network request failed' };
  }
}

/**
 * Connect the server to a MongoDB cluster/database
 */
export async function connectMongo(
  uri: string,
  dbName: string = 'cricket_db'
): Promise<{ ok: boolean; message: string; pingMs?: number }> {
  try {
    const res = await fetch('/api/mongodb/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, dbName }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.message || 'Failed to connect to MongoDB' };
    }
    return data;
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Network request failed' };
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongo(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/mongodb/disconnect', { method: 'POST' });
    return await res.json();
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Disconnect request failed' };
  }
}

// --- Players CRUD ---
export async function apiGetPlayers(): Promise<Player[]> {
  const res = await fetch('/api/players');
  if (!res.ok) throw new Error('Failed to fetch players');
  return res.json();
}

export async function apiSavePlayer(player: Player): Promise<void> {
  const res = await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(player),
  });
  if (!res.ok) throw new Error('Failed to save player to MongoDB');
}

export async function apiDeletePlayer(id: string): Promise<void> {
  const res = await fetch(`/api/players/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete player from MongoDB');
}

// --- Teams CRUD ---
export async function apiGetTeams(): Promise<Team[]> {
  const res = await fetch('/api/teams');
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
}

export async function apiSaveTeam(team: Team): Promise<void> {
  const res = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(team),
  });
  if (!res.ok) throw new Error('Failed to save team to MongoDB');
}

export async function apiDeleteTeam(id: string): Promise<void> {
  const res = await fetch(`/api/teams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete team from MongoDB');
}

// --- Matches CRUD ---
export async function apiGetMatches(): Promise<Match[]> {
  const res = await fetch('/api/matches');
  if (!res.ok) throw new Error('Failed to fetch matches');
  return res.json();
}

export async function apiSaveMatch(match: Match): Promise<void> {
  const res = await fetch('/api/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(match),
  });
  if (!res.ok) throw new Error('Failed to save match to MongoDB');
}

export async function apiDeleteMatch(id: string): Promise<void> {
  const res = await fetch(`/api/matches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete match from MongoDB');
}
