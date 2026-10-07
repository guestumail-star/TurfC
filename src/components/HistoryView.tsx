import React from 'react';
import { Match } from '../types';
import { Calendar, Clock, Award, ChevronRight, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface HistoryViewProps {
  matches: Match[];
  onViewDetails: (id: string) => void;
  isAdmin?: boolean;
  onDeleteMatch?: (id: string) => void;
}

export default function HistoryView({ matches, onViewDetails, isAdmin, onDeleteMatch }: HistoryViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const completedMatches = matches.filter(m => m.status === 'complete');

  const getSeriesInfo = (m: Match) => {
    if (m.matchType !== 'tournament' || !m.seriesId) return '';
    const seriesMatches = matches.filter(x => x.seriesId === m.seriesId);
    const sorted = [...seriesMatches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const matchNo = sorted.findIndex(x => x.id === m.id) + 1;
    return ` (Match ${matchNo} of ${m.tournamentMatches || 3})`;
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Completed Match';
    }
  };

  return (
    <div id="history-view" className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">Match Archives</h1>
        <p className="text-xs text-neutral-400">Past scorecards, final results, and career tallies</p>
      </div>

      {/* History List */}
      {completedMatches.length > 0 ? (
        <div className="grid gap-3">
          {completedMatches.map(m => (
            <motion.div
              key={m.id}
              whileHover={{ y: -1 }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                onViewDetails(m.id);
              }}
              className="group cursor-pointer rounded-2xl border border-neutral-200/80 bg-white p-4 transition hover:border-emerald-200 hover:shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                    <Calendar size={12} />
                    {m.completedAt ? formatDate(m.completedAt) : 'N/A'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border ${
                    m.matchType === 'tournament'
                      ? 'bg-amber-50 text-amber-800 border-amber-200/50'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200/50'
                  }`}>
                    {m.matchType === 'tournament' ? `🏆 Tournament: ${m.tournamentName || 'Championship Series'}${getSeriesInfo(m)}` : '🏏 Single Match'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {m.totalOvers} Overs
                  </span>
                  {isAdmin && onDeleteMatch && (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      {confirmDeleteId === m.id ? (
                        <div className="flex items-center gap-1 bg-red-50 border border-red-100 rounded-lg p-0.5 animate-fadeIn">
                          <span className="text-[9px] font-black uppercase text-red-700 px-1">Delete?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteMatch(m.id);
                              setConfirmDeleteId(null);
                            }}
                            className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-red-700 transition"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold text-neutral-700 hover:bg-neutral-300 transition"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(m.id)}
                          className="rounded-full p-1 text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
                          title="Delete Match"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Matchup summary */}
              <div className="mt-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-neutral-900 text-base">{m.team1Name}</span>
                    <span className="text-xs font-semibold text-neutral-400">VS</span>
                    <span className="font-extrabold text-neutral-900 text-base">{m.team2Name}</span>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    <Award size={12} className="text-emerald-600" />
                    {m.result}
                  </div>
                </div>
              </div>

              {/* Innings summary lines */}
              <div className="mt-4 flex items-center justify-between border-t border-neutral-100/70 pt-3 text-xs text-neutral-500">
                <div className="flex gap-4">
                  <span>
                    {m.battingFirstName}:{' '}
                    <strong className="font-mono text-neutral-800 font-extrabold">
                      {m.innings[0].runs}/{m.innings[0].wickets}
                    </strong>
                    <span className="text-neutral-400 ml-1 font-mono">({m.innings[0].overs}.{m.innings[0].balls} ov)</span>
                  </span>
                  <span>
                    {m.fieldingFirstName}:{' '}
                    <strong className="font-mono text-neutral-800 font-extrabold">
                      {m.innings[1].runs}/{m.innings[1].wickets}
                    </strong>
                    <span className="text-neutral-400 ml-1 font-mono">({m.innings[1].overs}.{m.innings[1].balls} ov)</span>
                  </span>
                </div>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                  View Card <ChevronRight size={14} />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
          No past matches found. Go start a match to build up your archives!
        </div>
      )}
    </div>
  );
}
