import React, { useState } from 'react';
import { Player, Match } from '../types';
import { getPlayerStats, CalculatedStats } from '../utils/cricket';
import { Award, ChevronRight, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface DatabaseViewProps {
  players: Player[];
  matches: Match[];
  onSelectPlayer: (id: string) => void;
}

type SortKey = 'runs' | 'wickets' | 'hs' | 'matches';

export default function DatabaseView({ players, matches, onSelectPlayer }: DatabaseViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('runs');

  const playerStatsList = players.map(p => {
    const stats = getPlayerStats(p.id, matches);
    return {
      player: p,
      stats,
    };
  });

  const sortedStatsList = [...playerStatsList].sort((a, b) => {
    if (sortKey === 'runs') return b.stats.runs - a.stats.runs;
    if (sortKey === 'wickets') return b.stats.wickets - a.stats.wickets;
    if (sortKey === 'hs') return b.stats.hs - a.stats.hs;
    if (sortKey === 'matches') return b.stats.matches - a.stats.matches;
    return 0;
  });

  return (
    <div id="database-view" className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">Performance Database</h1>
        <p className="text-xs text-neutral-400">All-time player career records across matches</p>
      </div>

      {/* Career Sorting Controls */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-neutral-100 p-1.5">
        <span className="px-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Sort By</span>
        {(
          [
            ['runs', 'Most Runs'],
            ['wickets', 'Top Wickets'],
            ['hs', 'Highest Score'],
            ['matches', 'Matches Played'],
          ] as const
        ).map(([key, label]) => {
          const isActive = sortKey === key;
          return (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_40px_50px_40px_45px_45px] border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-neutral-400">
          <div className="text-left">Player / Role</div>
          <div>Mat</div>
          <div>Runs</div>
          <div>HS</div>
          <div>Wkt</div>
          <div>S/R</div>
        </div>

        {/* Table Body */}
        {sortedStatsList.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {sortedStatsList.map(({ player, stats }, index) => {
              const roleAbbreviation = player.role.replace('-keeper', ' (WK)');
              const isTopThree = index < 3;

              return (
                <div
                  key={player.id}
                  onClick={() => onSelectPlayer(player.id)}
                  className="grid grid-cols-[1fr_40px_50px_40px_45px_45px] items-center cursor-pointer px-4 py-3 text-right text-sm transition hover:bg-neutral-50"
                >
                  {/* Name column */}
                  <div className="flex items-center gap-2.5 text-left min-w-0">
                    <div className="relative flex-shrink-0">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 font-mono text-xs font-extrabold text-neutral-700">
                        {player.jerseyNo || '#'}
                      </span>
                      {isTopThree && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-amber-950">
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-neutral-900 leading-tight truncate">
                        {player.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 leading-none mt-0.5">
                        {roleAbbreviation}
                      </div>
                    </div>
                  </div>

                  {/* Stat columns */}
                  <div className="font-mono text-xs text-neutral-500 font-semibold">{stats.matches}</div>
                  <div className="font-mono text-neutral-900 font-extrabold">{stats.runs}</div>
                  <div className="font-mono text-xs text-neutral-600 font-bold">{stats.hs}</div>
                  <div className="font-mono text-neutral-900 font-bold text-emerald-600">{stats.wickets}</div>
                  <div className="font-mono text-xs text-neutral-500 font-semibold">{stats.sr}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-neutral-400">
            No player stats logged yet. Go start a match to build performance logs!
          </div>
        )}
      </div>
    </div>
  );
}
