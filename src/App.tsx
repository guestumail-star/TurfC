import React, { useState, useEffect, useRef } from 'react';
import { Player, Team, Match, Innings, InningsSnapshot } from './types';
import {
  getPlayerStats,
  deliverBall,
  undoLastBall,
  swapBatsmen,
  retireHurt,
  selectStriker,
  selectNonStriker,
  selectBowler,
  replaceBatsman,
  endMatchManual,
  uid
} from './utils/cricket';
import {
  subscribePlayers,
  subscribeTeams,
  subscribeMatches,
  savePlayer,
  removePlayer,
  saveTeam,
  removeTeam,
  saveMatch,
  removeMatch
} from './lib/firebase';
import {
  apiGetPlayers,
  apiSavePlayer,
  apiDeletePlayer,
  apiGetTeams,
  apiSaveTeam,
  apiDeleteTeam,
  apiGetMatches,
  apiSaveMatch,
  apiDeleteMatch,
} from './lib/mongodb';
import { safeStorage } from './utils/storage';

// Views
import HomeView from './components/HomeView';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import DatabaseView from './components/DatabaseView';
import HistoryView from './components/HistoryView';
import ScorecardDetailView from './components/ScorecardDetailView';
import PlayerProfileView from './components/PlayerProfileView';
import LiveScoringView from './components/LiveScoringView';
import NewMatchModal from './components/NewMatchModal';

// Icons
import { Home, Users, Shield, Database, History, RefreshCw, CheckCircle2, Lock, Unlock, LogOut, Trophy, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewType = 'home' | 'players' | 'teams' | 'db' | 'history' | 'live' | 'dash' | 'detail';

export default function App() {
  const [view, setView] = useState<ViewType>('home');
  
  // State initialization directly from safeStorage (clean of any default fake data)
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = safeStorage.getItem('cricket_players');
    if (saved) {
      try {
        const parsed: Player[] = JSON.parse(saved);
        const filtered = Array.isArray(parsed)
          ? parsed.filter(p => !['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'].includes(p.id))
          : [];
        safeStorage.setItem('cricket_players', JSON.stringify(filtered));
        return filtered;
      } catch (e) { console.error(e); }
    }
    safeStorage.setItem('cricket_players', JSON.stringify([]));
    return [];
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = safeStorage.getItem('cricket_teams');
    if (saved) {
      try {
        const parsed: Team[] = JSON.parse(saved);
        const filtered = Array.isArray(parsed)
          ? parsed.filter(t => !['t1', 't2'].includes(t.id))
          : [];
        safeStorage.setItem('cricket_teams', JSON.stringify(filtered));
        return filtered;
      } catch (e) { console.error(e); }
    }
    safeStorage.setItem('cricket_teams', JSON.stringify([]));
    return [];
  });

  const [matches, setMatches] = useState<Match[]>(() => {
    const saved = safeStorage.getItem('cricket_matches');
    if (saved) {
      try {
        const parsed: Match[] = JSON.parse(saved);
        const filtered = Array.isArray(parsed)
          ? parsed.filter(m => m.id !== 'm1')
          : [];
        safeStorage.setItem('cricket_matches', JSON.stringify(filtered));
        return filtered;
      } catch (e) { console.error(e); }
    }
    safeStorage.setItem('cricket_matches', JSON.stringify([]));
    return [];
  });

  // Admin access control states
  const [isAdmin, setIsAdmin] = useState<boolean>(() => safeStorage.getItem('cricket-admin') === 'true');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Selection states
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [activeScorecardId, setActiveScorecardId] = useState<string | null>(null);
  const [hasManuallyExited, setHasManuallyExited] = useState<boolean>(false);

  // Modals / Toast
  const [isNewMatchOpen, setIsNewMatchOpen] = useState(false);
  const [newMatchPrefill, setNewMatchPrefill] = useState<{
    team1Id: string;
    team2Id: string;
    matchType: 'single' | 'tournament';
    tournamentMatches?: number;
    tournamentName?: string;
    seriesId?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'info' } | null>(null);

  // Automatic background server synchronization
  const syncWithServer = async () => {
    try {
      const fakePlayerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
      const fakeTeamIds = ['t1', 't2'];
      const fakeMatchIds = ['m1'];

      const [sPlayers, sTeams, sMatches] = await Promise.all([
        apiGetPlayers().catch(() => []),
        apiGetTeams().catch(() => []),
        apiGetMatches().catch(() => []),
      ]);

      const cleanPlayers = (sPlayers || []).filter(p => !fakePlayerIds.includes(p.id));
      const cleanTeams = (sTeams || []).filter(t => !fakeTeamIds.includes(t.id));
      const cleanMatches = (sMatches || []).filter(m => !fakeMatchIds.includes(m.id));

      syncPlayers(cleanPlayers);
      syncTeams(cleanTeams);
      syncMatches(cleanMatches);
    } catch (err) {
      console.warn("Server synchronization:", err);
    }
  };

  useEffect(() => {
    syncWithServer();
  }, []);

  // Dual-persistence helpers for MongoDB + Firestore + local cache
  const persistMatch = async (m: Match) => {
    try { await saveMatch(m); } catch (e) { console.warn("Firestore saveMatch error:", e); }
    try { await apiSaveMatch(m); } catch (e) { console.warn("MongoDB apiSaveMatch error:", e); }
  };

  const deleteMatchRecord = async (matchId: string) => {
    try { await removeMatch(matchId); } catch (e) { console.warn("Firestore removeMatch error:", e); }
    try { await apiDeleteMatch(matchId); } catch (e) { console.warn("MongoDB apiDeleteMatch error:", e); }
  };

  const persistPlayer = async (p: Player) => {
    try { await savePlayer(p); } catch (e) { console.warn("Firestore savePlayer error:", e); }
    try { await apiSavePlayer(p); } catch (e) { console.warn("MongoDB apiSavePlayer error:", e); }
  };

  const deletePlayerRecord = async (pid: string) => {
    try { await removePlayer(pid); } catch (e) { console.warn("Firestore removePlayer error:", e); }
    try { await apiDeletePlayer(pid); } catch (e) { console.warn("MongoDB deletePlayer error:", e); }
  };

  const persistTeam = async (t: Team) => {
    try { await saveTeam(t); } catch (e) { console.warn("Firestore saveTeam error:", e); }
    try { await apiSaveTeam(t); } catch (e) { console.warn("MongoDB apiSaveTeam error:", e); }
  };

  const deleteTeamRecord = async (tid: string) => {
    try { await removeTeam(tid); } catch (e) { console.warn("Firestore removeTeam error:", e); }
    try { await apiDeleteTeam(tid); } catch (e) { console.warn("MongoDB deleteTeam error:", e); }
  };

  const hasSetLiveMatchOnInit = useRef(false);

  // Initialize and load persistent offline data / auto-redirect to live match
  useEffect(() => {
    if (!hasManuallyExited && !hasSetLiveMatchOnInit.current) {
      const liveMatch = matches.find(m => m.status === 'live');
      if (liveMatch) {
        hasSetLiveMatchOnInit.current = true;
        setActiveMatchId(liveMatch.id);
        setView('live');
      }
    }
  }, [matches, hasManuallyExited]);

  // Show persistent Toast notifications
  const triggerToast = (message: string, type: 'success' | 'warn' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sync to safeStorage & Firestore Cloud in Real-time
  const syncPlayers = (updatedPlayers: Player[]) => {
    setPlayers(updatedPlayers);
    safeStorage.setItem('cricket_players', JSON.stringify(updatedPlayers));
  };

  const syncTeams = (updatedTeams: Team[]) => {
    setTeams(updatedTeams);
    safeStorage.setItem('cricket_teams', JSON.stringify(updatedTeams));
  };

  const syncMatches = (updatedMatches: Match[]) => {
    setMatches(updatedMatches);
    safeStorage.setItem('cricket_matches', JSON.stringify(updatedMatches));
  };

  // Real-time Cloud Database sync effect
  useEffect(() => {
    let active = true;
    const fakePlayerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
    const fakeTeamIds = ['t1', 't2'];
    const fakeMatchIds = ['m1'];

    // Start real-time Firestore subscriptions with clean filtering
    const unsubPlayers = subscribePlayers((updatedPlayers) => {
      if (!active) return;
      const clean = updatedPlayers.filter(p => !fakePlayerIds.includes(p.id));
      setPlayers((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(clean)) return prev;
        safeStorage.setItem('cricket_players', JSON.stringify(clean));
        return clean;
      });
    });

    const unsubTeams = subscribeTeams((updatedTeams) => {
      if (!active) return;
      const clean = updatedTeams.filter(t => !fakeTeamIds.includes(t.id));
      setTeams((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(clean)) return prev;
        safeStorage.setItem('cricket_teams', JSON.stringify(clean));
        return clean;
      });
    });

    const unsubMatches = subscribeMatches((updatedMatches) => {
      if (!active) return;
      const clean = updatedMatches.filter(m => !fakeMatchIds.includes(m.id));
      setMatches((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(clean)) return prev;
        safeStorage.setItem('cricket_matches', JSON.stringify(clean));
        return clean;
      });
    });

    // Remove legacy fake items from Firestore in background
    for (const pid of fakePlayerIds) removePlayer(pid).catch(() => {});
    for (const tid of fakeTeamIds) removeTeam(tid).catch(() => {});
    for (const mid of fakeMatchIds) removeMatch(mid).catch(() => {});

    return () => {
      active = false;
      unsubPlayers();
      unsubTeams();
      unsubMatches();
    };
  }, []);

  // Synchronize URL query parameters with view and activeMatchId / activeScorecardId
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    initialLoadRef.current = false;

    const params = new URLSearchParams(window.location.search);
    const urlMatchId = params.get('matchId');
    const urlScorecardId = params.get('scorecardId');
    const urlView = params.get('view') as ViewType | null;

    if (urlMatchId) {
      setHasManuallyExited(false);
      setActiveMatchId(urlMatchId);
      setView('live');
    } else if (urlScorecardId) {
      setActiveScorecardId(urlScorecardId);
      setView('detail');
    } else if (urlView) {
      setView(urlView);
    }
  }, []);

  // Whenever view or active IDs change, update the URL search parameters so users can easily share
  useEffect(() => {
    const params = new URLSearchParams();
    if (view === 'live' && activeMatchId) {
      params.set('matchId', activeMatchId);
    } else if (view === 'detail' && activeScorecardId) {
      params.set('scorecardId', activeScorecardId);
    } else if (view !== 'home') {
      params.set('view', view);
    }
    
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    
    // Replace state to avoid piling up history entries during passive browsing, but keep it shareable
    window.history.replaceState(null, '', newUrl);
  }, [view, activeMatchId, activeScorecardId]);

  // Auto-redirect to live match for spectators if they land on base URL and a match is live
  useEffect(() => {
    // Only redirect if we are on the 'home' view and haven't selected anything else, and haven't manually exited
    if (view === 'home' && !activeMatchId && !activeScorecardId && !hasManuallyExited) {
      const liveMatch = matches.find(m => m.status === 'live');
      if (liveMatch) {
        setActiveMatchId(liveMatch.id);
        setView('live');
        triggerToast(`Spectator Mode: Loaded live match ${liveMatch.team1Name} vs ${liveMatch.team2Name}`, 'info');
      }
    }
  }, [matches, view, activeMatchId, activeScorecardId, hasManuallyExited]);


  // --- Players Management ---
  const handleAddPlayer = async (pData: Omit<Player, 'id' | 'stats'>) => {
    const newPlayer: Player = {
      ...pData,
      id: uid(),
      stats: { matches: 0, runs: 0, balls: 0, wickets: 0, fifties: 0, hundreds: 0, fours: 0, sixes: 0 }
    };
    const updated = [...players, newPlayer];
    syncPlayers(updated);
    await persistPlayer(newPlayer);
    triggerToast(`Added player "${pData.name}"`);
  };

  const handleEditPlayer = async (id: string, pData: Omit<Player, 'id' | 'stats'>) => {
    const original = players.find(p => p.id === id);
    if (!original) return;
    const updatedPlayer = { ...original, ...pData };
    const updated = players.map(p => (p.id === id ? updatedPlayer : p));
    syncPlayers(updated);
    await persistPlayer(updatedPlayer);
    triggerToast(`Updated profile for "${pData.name}"`);
  };

  const handleDeletePlayer = async (id: string) => {
    const target = players.find(p => p.id === id);
    const updated = players.filter(p => p.id !== id);
    syncPlayers(updated);
    await deletePlayerRecord(id);
    triggerToast(`Removed player "${target?.name || ''}"`, 'warn');
  };

  // --- Teams Management ---
  const handleAddTeam = async (tData: Omit<Team, 'id'>) => {
    const newTeam: Team = {
      ...tData,
      id: uid(),
    };
    const updated = [...teams, newTeam];
    syncTeams(updated);
    await persistTeam(newTeam);
    triggerToast(`Created team "${tData.name}"`);
  };

  const handleEditTeam = async (id: string, tData: Omit<Team, 'id'>) => {
    const original = teams.find(t => t.id === id);
    if (!original) return;
    const updatedTeam = { ...original, ...tData };
    const updated = teams.map(t => (t.id === id ? updatedTeam : t));
    syncTeams(updated);
    await persistTeam(updatedTeam);
    triggerToast(`Updated roster for "${tData.name}"`);
  };

  const handleDeleteTeam = async (id: string) => {
    const target = teams.find(t => t.id === id);
    const updated = teams.filter(t => t.id !== id);
    syncTeams(updated);
    await deleteTeamRecord(id);
    triggerToast(`Disbanded team "${target?.name || ''}"`, 'warn');
  };

  const handleDeleteMatch = async (id: string) => {
    const target = matches.find(m => m.id === id);
    const updated = matches.filter(m => m.id !== id);
    syncMatches(updated);
    await deleteMatchRecord(id);
    if (activeScorecardId === id) {
      setActiveScorecardId(null);
      setView('history');
    }
    triggerToast(`Deleted match: ${target?.team1Name} vs ${target?.team2Name}`, 'warn');
  };

  // --- Match Setup & Live Scoring State Managers ---
  const handleStartMatch = async (config: {
    team1Id: string;
    team2Id: string;
    totalOvers: number;
    tossWinnerId: string;
    tossChoice: 'bat' | 'field';
    matchType: 'single' | 'tournament';
    tournamentMatches?: number;
    tournamentName?: string;
    seriesId?: string;
    lastPlayerSolo: boolean;
  }) => {
    const t1 = teams.find(t => t.id === config.team1Id)!;
    const t2 = teams.find(t => t.id === config.team2Id)!;

    const batFirst =
      config.tossChoice === 'bat'
        ? (config.tossWinnerId === config.team1Id ? t1 : t2)
        : (config.tossWinnerId === config.team1Id ? t2 : t1);

    const fieldFirst = batFirst.id === t1.id ? t2 : t1;

    const createEmptyInnings = (): Innings => ({
      runs: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
      batting: [],
      bowling: [],
      overHistory: [],
      currentOver: [],
      striker: null,
      nonStriker: null,
      bowler: null,
      retiredHurt: [],
      history: []
    });

    const newMatch: Match = {
      id: uid(),
      team1Id: t1.id,
      team2Id: t2.id,
      team1Name: t1.name,
      team2Name: t2.name,
      totalOvers: config.totalOvers,
      status: 'live',
      battingFirstId: batFirst.id,
      battingFirstName: batFirst.name,
      fieldingFirstId: fieldFirst.id,
      fieldingFirstName: fieldFirst.name,
      currentInnings: 1,
      innings: [createEmptyInnings(), createEmptyInnings()],
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: '',
      matchType: config.matchType,
      tournamentMatches: config.tournamentMatches,
      tournamentName: config.tournamentName,
      seriesId: config.seriesId || (config.matchType === 'tournament' ? `series_${Date.now()}` : undefined),
      lastPlayerSolo: config.lastPlayerSolo
    };

    const updatedMatches = [newMatch, ...matches];
    syncMatches(updatedMatches);
    
    // Update local UI state immediately to close the modal and open live scoring instantly
    setHasManuallyExited(false);
    setActiveMatchId(newMatch.id);
    setIsNewMatchOpen(false);
    setNewMatchPrefill(null);
    setView('live');
    triggerToast('Match initiated! Configure striker & non-striker to begin.');

    // Save to database asynchronously
    await persistMatch(newMatch);
  };

  const handleDeliverBall = async (
    outcome: string,
    wicketDetail?: {
      type: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired';
      bowlerId?: string;
      helperId?: string;
      outPlayerId?: string;
      runOutRuns?: number;
    }
  ) => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = deliverBall(currentMatch, outcome, teams, wicketDetail);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);

    // Event specific toasts
    if (outcome === 'W') {
      const typeStr = wicketDetail ? wicketDetail.type : 'Wicket';
      triggerToast(`${typeStr} fallen!`, 'warn');
    }
    else if (outcome === '4') triggerToast('Brilliant Boundary (4 runs!)');
    else if (outcome === '6') triggerToast('Colossal Six! (6 runs!)');
  };

  const handleUndoLastBall = async () => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = undoLastBall(currentMatch);
    if (updated) {
      const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
      syncMatches(updatedList);
      await persistMatch(updated);
      triggerToast('Last ball undone', 'info');
    } else {
      triggerToast('Nothing to undo', 'warn');
    }
  };

  const handleSwapBatsmen = async () => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = swapBatsmen(currentMatch);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
    triggerToast('Strike swapped');
  };

  const handleRetireHurt = async (pid: string) => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = retireHurt(currentMatch, pid, teams);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
    triggerToast('Batter retired hurt', 'warn');
  };

  const handleSelectStriker = async (pid: string) => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = selectStriker(currentMatch, pid);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
  };

  const handleSelectNonStriker = async (pid: string) => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = selectNonStriker(currentMatch, pid);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
  };

  const handleSelectBowler = async (pid: string) => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = selectBowler(currentMatch, pid);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
    triggerToast('Bowler changed successfully!', 'success');
  };

  const handleReplaceBatsman = async (type: 'striker' | 'nonStriker', pid: string) => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = replaceBatsman(currentMatch, type, pid);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
    triggerToast('Batsman changed successfully!', 'success');
  };

  const handleEndMatch = async () => {
    if (!activeMatchId) return;
    const currentMatch = matches.find(m => m.id === activeMatchId);
    if (!currentMatch) return;

    const updated = endMatchManual(currentMatch);
    const updatedList = matches.map(m => (m.id === activeMatchId ? updated : m));
    syncMatches(updatedList);
    await persistMatch(updated);
    triggerToast('Match ended manually!', 'info');
  };

  // End a tournament/series manually
  const handleEndSeries = async (seriesId: string) => {
    const updatedList = matches.map(m => {
      if (m.seriesId === seriesId) {
        return { ...m, seriesEnded: true };
      }
      return m;
    });
    syncMatches(updatedList);

    const matchesToUpdate = updatedList.filter(m => m.seriesId === seriesId);
    for (const m of matchesToUpdate) {
      await persistMatch(m);
    }
    triggerToast('Series ended successfully!', 'success');
  };

  // Dynamically calculate and pass real-time stats to Players list
  const playersWithCalculatedStats = players.map(p => {
    const calc = getPlayerStats(p.id, matches);
    return {
      ...p,
      stats: {
        matches: calc.matches,
        runs: calc.runs,
        balls: calc.balls,
        wickets: calc.wickets,
        fifties: calc.fifties,
        hundreds: calc.hundreds,
        fours: calc.fours,
        sixes: calc.sixes,
      },
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-950 flex flex-col pb-24 selection:bg-emerald-500/20 selection:text-emerald-950">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-4 left-1/2 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-bold shadow-xl border ${
              toast.type === 'warn'
                ? 'bg-red-50 border-red-200 text-red-800'
                : toast.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <CheckCircle2 size={16} className={toast.type === 'warn' ? 'text-red-500' : toast.type === 'info' ? 'text-blue-500' : 'text-emerald-500'} />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Role/Access Header Bar */}
      <header className="sticky top-0 z-40 bg-white/85 border-b border-neutral-100 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-neutral-800">Turf Cricket Live</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700 border border-amber-500/20 shadow-xs">
                  <Unlock size={10} className="stroke-[3px]" />
                  Admin Scorer
                </span>
                <button
                  onClick={() => {
                    setIsAdmin(false);
                    safeStorage.removeItem('cricket-admin');
                    triggerToast('Logged out of Admin Scorer mode', 'info');
                  }}
                  title="Logout Admin"
                  className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100 transition active:scale-95 flex items-center justify-center"
                >
                  <LogOut size={12} className="stroke-[2.5px]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAdminIdInput('');
                  setAdminPasswordInput('');
                  setLoginError('');
                  setShowLoginModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 px-3 py-1 text-[10px] font-black text-neutral-700 transition active:scale-95 shadow-xs"
              >
                <Lock size={10} className="stroke-[3px]" />
                Scorer Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xs rounded-3xl border border-neutral-100 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Lock size={16} />
                </div>
                <h2 className="text-sm font-black text-neutral-900">Scorer Authentication</h2>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="rounded-lg bg-neutral-50 p-1.5 text-neutral-400 hover:bg-neutral-100"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (adminIdInput === 'TurfC' && adminPasswordInput === 'TurfC') {
                  setIsAdmin(true);
                  safeStorage.setItem('cricket-admin', 'true');
                  setShowLoginModal(false);
                  triggerToast('Authenticated successfully as Admin Scorer!', 'success');
                } else {
                  setLoginError('Incorrect ID or Password!');
                }
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">Admin ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Admin ID"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter Password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {loginError && (
                <div className="rounded-xl bg-red-50 p-3 text-[11px] font-semibold text-red-700">
                  {loginError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-black text-neutral-950 transition hover:bg-amber-400 shadow-sm"
                >
                  Verify
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Main Container Wrapper */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (activePlayerId || '') + (activeMatchId || '') + (activeScorecardId || '')}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {view === 'home' && (
              <HomeView
                matches={matches}
                players={players}
                teams={teams}
                isAdmin={isAdmin}
                onStartNewMatch={() => {
                  if (teams.length < 2) {
                    triggerToast('Please create at least 2 teams with players first.', 'warn');
                    setView('teams');
                  } else {
                    setIsNewMatchOpen(true);
                  }
                }}
                onResumeMatch={id => {
                  setHasManuallyExited(false);
                  setActiveMatchId(id);
                  setView('live');
                }}
                onViewMatchDetails={id => {
                  setActiveScorecardId(id);
                  setView('detail');
                }}
                onNavigate={v => setView(v)}
              />
            )}

            {view === 'players' && (
              <PlayersView
                players={playersWithCalculatedStats}
                teams={teams}
                isAdmin={isAdmin}
                onAddPlayer={handleAddPlayer}
                onEditPlayer={handleEditPlayer}
                onDeletePlayer={handleDeletePlayer}
                onSelectPlayer={id => {
                  setActivePlayerId(id);
                  setView('dash');
                }}
              />
            )}

            {view === 'teams' && (
              <TeamsView
                teams={teams}
                players={players}
                matches={matches}
                isAdmin={isAdmin}
                onAddTeam={handleAddTeam}
                onEditTeam={handleEditTeam}
                onDeleteTeam={handleDeleteTeam}
              />
            )}

            {view === 'db' && (
              <DatabaseView
                players={players}
                matches={matches}
                onSelectPlayer={id => {
                  setActivePlayerId(id);
                  setView('dash');
                }}
              />
            )}

            {view === 'history' && (
              <HistoryView
                matches={matches}
                isAdmin={isAdmin}
                onDeleteMatch={handleDeleteMatch}
                onViewDetails={id => {
                  setActiveScorecardId(id);
                  setView('detail');
                }}
              />
            )}

            {view === 'live' && activeMatchId && (() => {
              const activeMatch = matches.find(m => m.id === activeMatchId);
              if (!activeMatch) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
                    <p className="text-sm font-semibold text-neutral-500 mt-4">Connecting to live match feed...</p>
                  </div>
                );
              }
              return (
                <LiveScoringView
                  match={activeMatch}
                  players={players}
                  teams={teams}
                  isAdmin={isAdmin}
                  allMatches={matches}
                  onContinueSeries={(seriesId, team1Id, team2Id, totalSeriesMatches, tournamentName) => {
                    setNewMatchPrefill({
                      team1Id,
                      team2Id,
                      matchType: 'tournament',
                      tournamentMatches: totalSeriesMatches,
                      tournamentName,
                      seriesId
                    });
                    setIsNewMatchOpen(true);
                  }}
                  onEndSeries={handleEndSeries}
                  onDeliverBall={handleDeliverBall}
                  onUndoLastBall={handleUndoLastBall}
                  onSwapBatsmen={handleSwapBatsmen}
                  onRetireHurt={handleRetireHurt}
                  onSelectStriker={handleSelectStriker}
                  onSelectNonStriker={handleSelectNonStriker}
                  onSelectBowler={handleSelectBowler}
                  onReplaceBatsman={handleReplaceBatsman}
                  onEndMatch={handleEndMatch}
                  onExit={() => {
                    setHasManuallyExited(true);
                    const completedId = activeMatchId;
                    setActiveMatchId(null);
                    if (completedId && activeMatch?.status === 'complete') {
                      setActiveScorecardId(completedId);
                      setView('detail');
                    } else {
                      setView('home');
                    }
                  }}
                />
              );
            })()}

            {view === 'dash' && activePlayerId && (
              <PlayerProfileView
                playerId={activePlayerId}
                players={players}
                matches={matches}
                onBack={() => {
                  setActivePlayerId(null);
                  setView('players');
                }}
              />
            )}

            {view === 'detail' && activeScorecardId && (() => {
              const selectedMatch = matches.find(m => m.id === activeScorecardId);
              if (!selectedMatch) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
                    <p className="text-sm font-semibold text-neutral-500 mt-4">Retrieving scorecard details...</p>
                  </div>
                );
              }
              return (
                <ScorecardDetailView
                  match={selectedMatch}
                  players={players}
                  isAdmin={isAdmin}
                  onDeleteMatch={handleDeleteMatch}
                  allMatches={matches}
                  onContinueSeries={(seriesId, team1Id, team2Id, totalSeriesMatches, tournamentName) => {
                    setNewMatchPrefill({
                      team1Id,
                      team2Id,
                      matchType: 'tournament',
                      tournamentMatches: totalSeriesMatches,
                      tournamentName,
                      seriesId
                    });
                    setIsNewMatchOpen(true);
                  }}
                  onEndSeries={handleEndSeries}
                  onBack={() => {
                    setActiveScorecardId(null);
                    setView('history');
                  }}
                />
              );
            })()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Navigation Drawer (Hidden in Scoring or deep detail view states for maximum focus) */}
      {!['live', 'dash', 'detail'].includes(view) && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-neutral-200/80 backdrop-blur-md px-4 py-2">
          <div className="max-w-md mx-auto flex items-center justify-between">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'players', label: 'Players', icon: Users },
              { id: 'teams', label: 'Teams', icon: Shield },
              { id: 'db', label: 'Stats', icon: Database },
              { id: 'history', label: 'History', icon: History },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = view === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id as ViewType)}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition ${
                    isActive ? 'text-emerald-600 font-extrabold' : 'text-neutral-400 hover:text-neutral-900 font-medium'
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] tracking-wide leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* New Match setup modal */}
      {isNewMatchOpen && (
        <NewMatchModal
          teams={teams}
          prefill={newMatchPrefill}
          onClose={() => {
            setIsNewMatchOpen(false);
            setNewMatchPrefill(null);
          }}
          onStartMatch={handleStartMatch}
        />
      )}
    </div>
  );
}
