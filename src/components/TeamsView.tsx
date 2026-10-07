import React, { useState } from 'react';
import { Player, Team, Match } from '../types';
import { Plus, Edit2, Trash2, Shield, Users, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface TeamsViewProps {
  teams: Team[];
  players: Player[];
  matches: Match[];
  isAdmin?: boolean;
  onAddTeam: (team: Omit<Team, 'id'>) => void;
  onEditTeam: (id: string, team: Omit<Team, 'id'>) => void;
  onDeleteTeam: (id: string) => void;
}

export default function TeamsView({
  teams,
  players,
  matches,
  isAdmin = false,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
}: TeamsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  const openAddModal = () => {
    setEditingTeam(null);
    setName('');
    setSelectedPlayerIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Team) => {
    setEditingTeam(t);
    setName(t.name);
    setSelectedPlayerIds([...(t.playerIds || [])]);
    setIsModalOpen(true);
  };

  const handleTogglePlayer = (pid: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const teamData = {
      name: name.trim(),
      playerIds: selectedPlayerIds,
    };

    if (editingTeam) {
      onEditTeam(editingTeam.id, teamData);
    } else {
      onAddTeam(teamData);
    }
    setIsModalOpen(false);
  };

  const calculateTeamStats = (teamId: string) => {
    let matchesPlayed = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let runsScored = 0;
    let wicketsTaken = 0;

    matches.forEach(m => {
      if (m.status !== 'complete') return;
      if (m.team1Id !== teamId && m.team2Id !== teamId) return;

      matchesPlayed++;

      const s1 = m.innings[0].runs;
      const s2 = m.innings[1].runs;

      if (m.battingFirstId === teamId) {
        runsScored += s1;
        wicketsTaken += m.innings[1].wickets;
      } else if (m.fieldingFirstId === teamId) {
        runsScored += s2;
        wicketsTaken += m.innings[0].wickets;
      }

      if (s1 === s2) {
        ties++;
      } else {
        const firstInnWon = s1 > s2;
        const battingFirstWon = firstInnWon;
        const wonId = battingFirstWon ? m.battingFirstId : m.fieldingFirstId;
        if (wonId === teamId) {
          wins++;
        } else {
          losses++;
        }
      }
    });

    const winRate = matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(0) : '0';

    return {
      matchesPlayed,
      wins,
      losses,
      ties,
      runsScored,
      wicketsTaken,
      winRate,
    };
  };

  return (
    <div id="teams-view" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">Teams Manager</h1>
          <p className="text-xs text-neutral-400">Assemble rosters and customize squad lineups</p>
        </div>
        {isAdmin && (
          <button
            id="add-team-btn"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400 active:scale-95 shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Create Team
          </button>
        )}
      </div>

      {/* Teams Grid */}
      {teams.length > 0 ? (
        <div className="grid gap-4">
          {teams.map(t => {
            const roster = (t.playerIds || [])
              .map(pid => players.find(p => p.id === pid))
              .filter((p): p is Player => !!p);

            const stats = calculateTeamStats(t.id);

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xs"
              >
                {/* Team header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Shield size={22} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-neutral-900 leading-tight">
                        {t.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400">
                        <Users size={12} />
                        {roster.length} Players on Roster
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 animate-none"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteTeam(t.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 animate-none"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Dynamic Team Stats Grid */}
                <div className="mt-4 grid grid-cols-4 gap-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Played</span>
                    <span className="font-mono text-sm font-extrabold text-neutral-800">{stats.matchesPlayed}</span>
                  </div>
                  <div className="text-center border-l border-neutral-100">
                    <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Wins</span>
                    <span className="font-mono text-sm font-black text-emerald-600">{stats.wins}</span>
                  </div>
                  <div className="text-center border-l border-neutral-100">
                    <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider">Losses</span>
                    <span className="font-mono text-sm font-extrabold text-red-500">{stats.losses}</span>
                  </div>
                  <div className="text-center border-l border-neutral-100">
                    <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider">Win %</span>
                    <span className="font-mono text-sm font-black text-blue-600">{stats.winRate}%</span>
                  </div>
                </div>
                
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500 px-1">
                  <span>Total Runs Scored: <strong className="font-mono text-neutral-800 font-black">{stats.runsScored}</strong></span>
                  <span>Wickets Taken: <strong className="font-mono text-neutral-800 font-black">{stats.wicketsTaken}</strong></span>
                </div>

                {/* Roster list */}
                {roster.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                    {roster.map(p => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/60 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700"
                      >
                        <span className="font-mono font-black text-blue-600">
                          #{p.jerseyNo || '?'}
                        </span>
                        {p.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 border-t border-dashed border-neutral-100 pt-4 text-xs text-neutral-400 italic">
                    No players currently assigned to this team. Edit team to configure.
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
          No teams found. Click "Create Team" to set up your first lineup.
        </div>
      )}

      {/* Add / Edit Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-neutral-100 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-lg font-black text-neutral-900">
                {editingTeam ? 'Edit Team Roster' : 'Create New Team'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg bg-neutral-50 p-1.5 text-neutral-400 hover:bg-neutral-100"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col flex-1 overflow-hidden space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. India Kings"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Select Squad Players
                  </label>
                  <span className="text-xs font-black text-emerald-600">
                    {selectedPlayerIds.length} Selected
                  </span>
                </div>

                {/* Player List (Scrollable) */}
                <div className="mt-2 flex-1 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50/50 p-2 space-y-1.5 min-h-[180px] max-h-[260px]">
                  {players.length > 0 ? (
                    players.map(p => {
                      const isSelected = selectedPlayerIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePlayer(p.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition ${
                            isSelected
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                              : 'border-neutral-200/60 bg-white hover:bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-black ${
                                isSelected
                                  ? 'bg-emerald-500 text-neutral-950'
                                  : 'bg-neutral-100 text-neutral-500'
                              }`}
                            >
                              {p.jerseyNo || '?'}
                            </span>
                            <div>
                              <div className="text-xs font-bold">{p.name}</div>
                              <div className="text-[10px] opacity-60">{p.role}</div>
                            </div>
                          </div>
                          {isSelected && <Check size={14} className="text-emerald-700 font-extrabold" />}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-neutral-400">
                      No registered players available. Create players first!
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl bg-neutral-100 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400"
                >
                  Save Team
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
