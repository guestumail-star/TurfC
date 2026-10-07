import React, { useState, useEffect } from 'react';
import { Team } from '../types';
import { Plus, Play, AlertTriangle, Shield, Settings, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface NewMatchModalProps {
  teams: Team[];
  onClose: () => void;
  onStartMatch: (config: {
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
  }) => void;
  prefill?: {
    team1Id: string;
    team2Id: string;
    matchType: 'single' | 'tournament';
    tournamentMatches?: number;
    tournamentName?: string;
    seriesId?: string;
  } | null;
}

export default function NewMatchModal({ teams, onClose, onStartMatch, prefill }: NewMatchModalProps) {
  const [team1Id, setTeam1Id] = useState(prefill?.team1Id || '');
  const [team2Id, setTeam2Id] = useState(prefill?.team2Id || '');
  const [totalOvers, setTotalOvers] = useState(20);
  const [tossWinnerId, setTossWinnerId] = useState(prefill?.team1Id || '');
  const [tossChoice, setTossChoice] = useState<'bat' | 'field'>('bat');
  const [matchType, setMatchType] = useState<'single' | 'tournament'>(prefill?.matchType || 'single');
  const [tournamentMatches, setTournamentMatches] = useState(prefill?.tournamentMatches || 3);
  const [tournamentName, setTournamentName] = useState(prefill?.tournamentName || '');
  const [isCustomMatches, setIsCustomMatches] = useState(
    prefill?.tournamentMatches ? ![3, 5, 7].includes(prefill.tournamentMatches) : false
  );
  const [lastPlayerSolo, setLastPlayerSolo] = useState(true);
  const [error, setError] = useState('');

  const handleTournamentMatchesSelect = (val: string) => {
    if (val === 'custom') {
      setIsCustomMatches(true);
    } else {
      setIsCustomMatches(false);
      setTournamentMatches(Number(val));
    }
  };

  // Automatically initialize defaults or prefill values
  useEffect(() => {
    if (prefill) {
      setTeam1Id(prefill.team1Id);
      setTeam2Id(prefill.team2Id);
      setTossWinnerId(prefill.team1Id);
      setMatchType(prefill.matchType);
      if (prefill.tournamentName) {
        setTournamentName(prefill.tournamentName);
      }
      if (prefill.tournamentMatches) {
        setTournamentMatches(prefill.tournamentMatches);
        setIsCustomMatches(![3, 5, 7].includes(prefill.tournamentMatches));
      }
    } else if (teams.length >= 2) {
      if (!team1Id) setTeam1Id(teams[0].id);
      if (!team2Id) setTeam2Id(teams[1].id);
      if (!tossWinnerId) setTossWinnerId(teams[0].id);
    }
  }, [teams, prefill]);

  // Handle Team 1 selection and adjust toss winner options
  const handleTeam1Change = (id: string) => {
    setTeam1Id(id);
    if (tossWinnerId !== id && tossWinnerId !== team2Id) {
      setTossWinnerId(id);
    }
    setError('');
  };

  // Handle Team 2 selection
  const handleTeam2Change = (id: string) => {
    setTeam2Id(id);
    setError('');
  };

  const getTeamName = (id: string) => {
    const team = teams.find(t => t.id === id);
    return team ? team.name : '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!team1Id || !team2Id) {
      setError('Please configure both teams first.');
      return;
    }

    if (team1Id === team2Id) {
      setError('A match requires two different teams.');
      return;
    }

    const t1 = teams.find(t => t.id === team1Id);
    const t2 = teams.find(t => t.id === team2Id);

    if (!t1 || !t1.playerIds || t1.playerIds.length === 0) {
      setError(`"${getTeamName(team1Id)}" has no registered squad players. Please edit the team roster.`);
      return;
    }

    if (!t2 || !t2.playerIds || t2.playerIds.length === 0) {
      setError(`"${getTeamName(team2Id)}" has no registered squad players. Please edit the team roster.`);
      return;
    }

    onStartMatch({
      team1Id,
      team2Id,
      totalOvers,
      tossWinnerId: tossWinnerId || team1Id,
      tossChoice,
      matchType,
      tournamentMatches: matchType === 'tournament' ? tournamentMatches : undefined,
      tournamentName: matchType === 'tournament' ? (tournamentName.trim() || 'Championship Series') : undefined,
      seriesId: prefill?.seriesId,
      lastPlayerSolo,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl border border-neutral-100 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Play size={16} />
            </div>
            <h2 className="text-lg font-black text-neutral-900">Initiate New Match</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-50 p-1.5 text-neutral-400 hover:bg-neutral-100"
          >
            <Plus size={16} className="rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {prefill?.seriesId && (
            <div className="rounded-xl bg-amber-50 border border-amber-200/50 p-3 text-xs text-amber-900 font-bold flex items-center gap-2 animate-none">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Continuing Tournament Series! Parameters are locked to preserve series standings.
            </div>
          )}

          {/* Teams Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Team A
              </label>
              <select
                value={team1Id}
                onChange={e => handleTeam1Change(e.target.value)}
                disabled={!!prefill?.seriesId}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Team B
              </label>
              <select
                value={team2Id}
                onChange={e => handleTeam2Change(e.target.value)}
                disabled={!!prefill?.seriesId}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Match Type and Overs side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Match Type
              </label>
              <select
                value={matchType}
                onChange={e => setMatchType(e.target.value as 'single' | 'tournament')}
                disabled={!!prefill?.seriesId}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white animate-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="single">🏏 Single Match</option>
                <option value="tournament">🏆 Tournament</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Total Overs
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={totalOvers}
                onChange={e => setTotalOvers(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white animate-none"
              />
            </div>
          </div>

          {/* Tournament Series Length selector */}
          {matchType === 'tournament' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 space-y-3 overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Tournament Settings</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={e => setTournamentName(e.target.value)}
                  disabled={!!prefill?.seriesId}
                  placeholder="e.g. Summer Turf Cup, Ashes Series"
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Series Length
                  </label>
                  <select
                    value={isCustomMatches ? 'custom' : tournamentMatches}
                    onChange={e => handleTournamentMatchesSelect(e.target.value)}
                    disabled={!!prefill?.seriesId}
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="3">3 Match Series</option>
                    <option value="5">5 Match Series</option>
                    <option value="7">7 Match Series</option>
                    <option value="custom">Custom Matches...</option>
                  </select>
                </div>

                {isCustomMatches && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Matches Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={tournamentMatches}
                      onChange={e => setTournamentMatches(Math.max(1, Number(e.target.value)))}
                      className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Custom Match Rules */}
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Match Custom Rules</h4>
            <label className="flex items-center gap-3 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={lastPlayerSolo}
                onChange={e => setLastPlayerSolo(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
              />
              <div>
                <div className="text-xs font-bold text-neutral-800">Last Batter Solo (Last Man Standing)</div>
                <div className="text-[10px] text-neutral-500 font-medium leading-tight">Allow the final remaining batter to play solo without a non-striker.</div>
              </div>
            </label>
          </div>

          {/* Toss Details */}
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Toss Configuration</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">Toss Won By</label>
                <select
                  value={tossWinnerId}
                  onChange={e => setTossWinnerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-500"
                >
                  {team1Id && <option value={team1Id}>{getTeamName(team1Id)}</option>}
                  {team2Id && team2Id !== team1Id && (
                    <option value={team2Id}>{getTeamName(team2Id)}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase">Decision</label>
                <select
                  value={tossChoice}
                  onChange={e => setTossChoice(e.target.value as 'bat' | 'field')}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="bat">Bat First</option>
                  <option value="field">Field First</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
              <AlertTriangle size={16} className="flex-shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-neutral-950 transition hover:bg-emerald-400 shadow-sm"
            >
              🏏 Start Scoring
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
