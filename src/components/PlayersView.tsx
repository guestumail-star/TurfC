import React, { useState } from 'react';
import { Player, PlayerRole } from '../types';
import { Search, Plus, User, Edit2, Trash2, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface PlayersViewProps {
  players: Player[];
  teams: { name: string; playerIds: string[] }[];
  isAdmin?: boolean;
  onAddPlayer: (player: Omit<Player, 'id' | 'stats'>) => void;
  onEditPlayer: (id: string, player: Omit<Player, 'id' | 'stats'>) => void;
  onDeletePlayer: (id: string) => void;
  onSelectPlayer: (id: string) => void;
}

export default function PlayersView({
  players,
  teams,
  isAdmin = false,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
  onSelectPlayer,
}: PlayersViewProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('Batsman');
  const [jerseyNo, setJerseyNo] = useState('');
  const [age, setAge] = useState<number | ''>('');

  const getTeamOfPlayer = (playerId: string) => {
    const team = teams.find(t => t.playerIds.includes(playerId));
    return team ? team.name : 'No Team Assigned';
  };

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingPlayer(null);
    setName('');
    setRole('Batsman');
    setJerseyNo('');
    setAge('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Player) => {
    setEditingPlayer(p);
    setName(p.name);
    setRole(p.role);
    setJerseyNo(p.jerseyNo);
    setAge(p.age || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const playerData = {
      name: name.trim(),
      role,
      jerseyNo: jerseyNo.trim() || '#',
      age: age === '' ? undefined : Number(age),
    };

    if (editingPlayer) {
      onEditPlayer(editingPlayer.id, playerData);
    } else {
      onAddPlayer(playerData);
    }
    setIsModalOpen(false);
  };

  return (
    <div id="players-view" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">Players Directory</h1>
          <p className="text-xs text-neutral-400">Manage profiles, jersey assignments, and roles</p>
        </div>
        {isAdmin && (
          <button
            id="add-player-btn"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400 active:scale-95 shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Player
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400">
          <Search size={18} />
        </span>
        <input
          id="player-search-input"
          type="text"
          placeholder="Search players by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-neutral-200 bg-white py-3 pr-4 pl-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      {/* Players List Grid */}
      {filteredPlayers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredPlayers.map(p => {
            const teamName = getTeamOfPlayer(p.id);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white p-4 transition hover:border-emerald-200 hover:shadow-sm"
              >
                {/* Jersey Emblem */}
                <div
                  onClick={() => onSelectPlayer(p.id)}
                  className="flex h-12 w-12 cursor-pointer flex-shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 font-mono text-emerald-700 transition group-hover:bg-emerald-100/80"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/60 leading-none">Jersey</span>
                  <span className="text-lg font-black leading-none mt-0.5">{p.jerseyNo || '#'}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectPlayer(p.id)}>
                  <h3 className="truncate font-bold text-neutral-900 group-hover:text-emerald-600 transition">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{p.role}</span>
                    <span className="h-1 w-1 rounded-full bg-neutral-200"></span>
                    <span className="truncate">{teamName}</span>
                  </div>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 animate-none"
                      title="Edit profile"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onDeletePlayer(p.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 animate-none"
                      title="Delete player"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
          No players match your search criteria. Add some players to begin.
        </div>
      )}

      {/* Add / Edit Player Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-3xl border border-neutral-100 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-lg font-black text-neutral-900">
                {editingPlayer ? 'Edit Player Profile' : 'Add New Player'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg bg-neutral-50 p-1.5 text-neutral-400 hover:bg-neutral-100"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Virat Kohli"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Player Role
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as PlayerRole)}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-rounder">All-rounder</option>
                    <option value="Wicket-keeper">Wicket-keeper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Jersey No
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="e.g. 18"
                    value={jerseyNo}
                    onChange={e => setJerseyNo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Age (Optional)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 28"
                  value={age}
                  onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-neutral-50">
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
                  Save Profile
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
