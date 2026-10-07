import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, doc, setDoc, deleteDoc, collection, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { Player, Team, Match } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase using the official project configuration
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the correct databaseId and force HTTP long-polling
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

/**
 * Recursively removes any undefined values from an object or array to make it Firestore-compatible.
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeData(val);
      }
    }
    return cleaned;
  }
  return data;
}

/**
 * Sanitizes player data for Firestore (removing undefined values like age).
 */
export function toFirestorePlayer(player: Player): any {
  return sanitizeData(player);
}

/**
 * Transforms match data for Firestore to avoid nested arrays and undefined values.
 */
export function toFirestoreMatch(match: Match): any {
  const m = sanitizeData(match);
  if (m && m.innings) {
    m.innings = JSON.stringify(m.innings);
  }
  return m;
}

/**
 * Parses match data retrieved from Firestore back into normal Match format.
 */
export function fromFirestoreMatch(data: any): Match {
  const m = { ...data };
  if (m.innings && typeof m.innings === 'string') {
    try {
      m.innings = JSON.parse(m.innings);
    } catch (e) {
      console.error("Error parsing innings from Firestore:", e);
    }
  }
  return m as Match;
}

/**
 * Seeds the Firestore database with initial data if it is empty.
 */
export async function seedDatabaseIfEmpty() {
  // Clean initialization - no fake data seeded
  return;
}

/**
 * Real-time subscribers for collections
 */
export function subscribePlayers(onUpdate: (players: Player[]) => void) {
  return onSnapshot(collection(db, 'players'), (snapshot) => {
    const list: Player[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as Player);
    });
    onUpdate(list);
  }, (error) => {
    console.error("Error subscribing to players:", error);
  });
}

export function subscribeTeams(onUpdate: (teams: Team[]) => void) {
  return onSnapshot(collection(db, 'teams'), (snapshot) => {
    const list: Team[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as Team);
    });
    onUpdate(list);
  }, (error) => {
    console.error("Error subscribing to teams:", error);
  });
}

export function subscribeMatches(onUpdate: (matches: Match[]) => void) {
  return onSnapshot(collection(db, 'matches'), (snapshot) => {
    const list: Match[] = [];
    snapshot.forEach((doc) => {
      list.push(fromFirestoreMatch(doc.data()));
    });
    // Sort matches by createdAt descending
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(list);
  }, (error) => {
    console.error("Error subscribing to matches:", error);
  });
}

/**
 * Write operations for individual records
 */
export async function savePlayer(player: Player) {
  await setDoc(doc(db, 'players', player.id), toFirestorePlayer(player));
}

export async function removePlayer(playerId: string) {
  await deleteDoc(doc(db, 'players', playerId));
}

export async function saveTeam(team: Team) {
  await setDoc(doc(db, 'teams', team.id), sanitizeData(team));
}

export async function removeTeam(teamId: string) {
  await deleteDoc(doc(db, 'teams', teamId));
}

export async function saveMatch(match: Match) {
  await setDoc(doc(db, 'matches', match.id), toFirestoreMatch(match));
}

export async function removeMatch(matchId: string) {
  await deleteDoc(doc(db, 'matches', matchId));
}
