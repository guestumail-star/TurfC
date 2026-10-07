export type PlayerRole = 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper';

export interface PlayerStats {
  matches: number;
  runs: number;
  balls: number;
  wickets: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  jerseyNo: string;
  age?: number;
  stats: PlayerStats;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export interface BatterStats {
  pid: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  retiredHurt?: boolean;
  wicketDetail?: {
    type: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired';
    bowlerId?: string;
    helperId?: string;
    runOutRuns?: number;
  };
}

export interface BowlerStats {
  pid: string;
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
}

export interface InningsExtras {
  wide: number;
  noBall: number;
  bye: number;
  legBye: number;
}

export interface InningsSnapshot {
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: InningsExtras;
  batting: BatterStats[];
  bowling: BowlerStats[];
  overHistory: string[][];
  currentOver: string[];
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  retiredHurt: string[];
}

export interface Innings extends InningsSnapshot {
  history: InningsSnapshot[];
}

export interface Match {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  totalOvers: number;
  status: 'live' | 'complete';
  battingFirstId: string;
  battingFirstName: string;
  fieldingFirstId: string;
  fieldingFirstName: string;
  currentInnings: 1 | 2;
  innings: [Innings, Innings];
  createdAt: string;
  completedAt: string | null;
  result: string;
  matchType?: 'single' | 'tournament';
  tournamentMatches?: number;
  tournamentName?: string;
  seriesId?: string;
  lastPlayerSolo?: boolean;
  seriesEnded?: boolean;
}
