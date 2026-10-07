import React from 'react';
import { Match, Player, Team } from '../types';
import { Play, Plus, Users, Shield, Calendar, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  matches: Match[];
  players: Player[];
  teams: Team[];
  isAdmin?: boolean;
  onStartNewMatch: () => void;
  onResumeMatch: (matchId: string) => void;
  onViewMatchDetails: (matchId: string) => void;
  onNavigate: (view: 'players' | 'teams' | 'db' | 'history') => void;
}

export default function HomeView({
  matches,
  players,
  teams,
  isAdmin = false,
  onStartNewMatch,
  onResumeMatch,
  onViewMatchDetails,
  onNavigate,
}: HomeViewProps) {
  const getSeriesInfo = (m: Match) => {
    if (m.matchType !== 'tournament' || !m.seriesId) return '';
    const seriesMatches = matches.filter(x => x.seriesId === m.seriesId);
    const sorted = [...seriesMatches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const matchNo = sorted.findIndex(x => x.id === m.id) + 1;
    const namePrefix = m.tournamentName ? `${m.tournamentName} · ` : '';
    return ` (${namePrefix}Match ${matchNo} of ${m.tournamentMatches || 3})`;
  };

  const liveMatches = matches.filter(m => m.status === 'live');
  const completedMatches = matches.filter(m => m.status === 'complete').slice(0, 3);

  // Quick Stats
  const totalRunsScored = matches.reduce((acc, m) => {
    return acc + m.innings[0].runs + m.innings[1].runs;
  }, 0);

  return (
    <div id="home-view" className="space-y-6">
      {/* Hero Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-neutral-900 px-6 py-8 text-white shadow-xl"
      >
        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>
            Professional Scorer
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight leading-none sm:text-4xl">
            Lets Start the Bloody Game!
          </h1>
          {isAdmin ? (
            <div className="mt-6 flex flex-wrap gap-3 animate-none">
              <button
                id="new-match-hero-btn"
                onClick={onStartNewMatch}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-emerald-400 active:scale-95 animate-none"
              >
                <Plus size={16} strokeWidth={2.5} />
                New Match
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3 animate-none">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-black text-emerald-400 border border-emerald-500/20 shadow-xs backdrop-blur-md animate-none">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                🏆 Real-Time Spectator Mode
              </span>
            </div>
          )}
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-10 -bottom-10 opacity-10">
          <svg 
            width={240} 
            height={240} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1} 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            {/* Cricket Bat Handle */}
            <path d="M18.5 2.5L14.5 6.5" />
            <path d="M19.5 3.5L15.5 7.5" />
            <path d="M18.5 2.5L19.5 3.5" />
            {/* Cricket Bat Blade */}
            <path d="M14.5 6.5L6.5 14.5C5.5 15.5 4.5 17 5 18.5C5.5 20 7 20.5 8.5 19.5L16.5 11.5L14.5 6.5Z" />
            {/* Cricket Ball */}
            <circle cx="9" cy="9" r="3.5" />
            <path d="M7 8C8 9 8 10 7 11" />
          </svg>
        </div>
      </motion.div>

      {/* Quick Stats Bento Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div
          id="stat-players"
          onClick={() => onNavigate('players')}
          className="cursor-pointer rounded-2xl border border-neutral-200/80 bg-white p-3 text-center transition hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Users size={16} />
          </div>
          <div className="mt-2 text-xl font-extrabold text-neutral-900">{players.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Players</div>
        </div>

        <div
          id="stat-teams"
          onClick={() => onNavigate('teams')}
          className="cursor-pointer rounded-2xl border border-neutral-200/80 bg-white p-3 text-center transition hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Shield size={16} />
          </div>
          <div className="mt-2 text-xl font-extrabold text-neutral-900">{teams.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Teams</div>
        </div>

        <div
          id="stat-matches"
          onClick={() => onNavigate('history')}
          className="cursor-pointer rounded-2xl border border-neutral-200/80 bg-white p-3 text-center transition hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Calendar size={16} />
          </div>
          <div className="mt-2 text-xl font-extrabold text-neutral-900">{matches.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Matches</div>
        </div>
      </div>

      {/* Live Matches Section */}
      {liveMatches.length > 0 && (
        <div id="live-matches-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Active Live Matches</h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-red-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              TURFCRICS LIVE
            </span>
          </div>

          <div className="grid gap-4">
            {liveMatches.map(m => {
              const currentInnIndex = m.currentInnings - 1;
              const battingInnings = m.innings[currentInnIndex];
              const isSecondInnings = m.currentInnings === 2;

              const battingTeamName = isSecondInnings ? m.fieldingFirstName : m.battingFirstName;
              const bowlingTeamName = isSecondInnings ? m.battingFirstName : m.fieldingFirstName;

              const firstInnRuns = m.innings[0].runs;
              const targetRuns = firstInnRuns + 1;
              const runsNeeded = targetRuns - m.innings[1].runs;
              const totalBalls = m.totalOvers * 6;
              const bowledBalls = m.innings[1].overs * 6 + m.innings[1].balls;
              const ballsRemaining = totalBalls - bowledBalls;

              const strikerStats = battingInnings.batting.find(b => b.pid === battingInnings.striker);
              const nonStrikerStats = battingInnings.batting.find(b => b.pid === battingInnings.nonStriker);
              const activeBowlerStats = battingInnings.bowling.find(b => b.pid === battingInnings.bowler);

              const strikerName = battingInnings.striker ? (players.find(p => p.id === battingInnings.striker)?.name || 'Unknown') : null;
              const nonStrikerName = battingInnings.nonStriker ? (players.find(p => p.id === battingInnings.nonStriker)?.name || 'Unknown') : null;
              const bowlerName = battingInnings.bowler ? (players.find(p => p.id === battingInnings.bowler)?.name || 'Unknown') : null;

              // Run rate calculation
              const totalBallsFaced = battingInnings.overs * 6 + battingInnings.balls;
              const crr = totalBallsFaced > 0 ? ((battingInnings.runs / totalBallsFaced) * 6).toFixed(2) : '0.00';
              const rrr = isSecondInnings && ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : null;

              return (
                <motion.div
                  key={m.id}
                  whileHover={{ y: -2 }}
                  onClick={() => onResumeMatch(m.id)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-neutral-100 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md animate-none"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                        m.matchType === 'tournament'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200/50'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200/50'
                      }`}>
                        {m.matchType === 'tournament' ? `🏆 Tournament${getSeriesInfo(m)}` : '🏏 Single Match'}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400">
                        Overs: {m.totalOvers}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-black text-red-600 border border-red-200/50">
                      <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
                      Innings {m.currentInnings}
                    </span>
                  </div>

                  {/* Teams and Main Live Score */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-500">{bowlingTeamName}</span>
                        {isSecondInnings && (
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            ({m.innings[0].runs}/{m.innings[0].wickets})
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-neutral-900">{battingTeamName}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 animate-pulse">
                          Batting
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-2xl font-black text-neutral-900">
                        {battingInnings.runs}/{battingInnings.wickets}
                      </div>
                      <div className="font-mono text-xs font-bold text-neutral-500">
                        Overs: {battingInnings.overs}.{battingInnings.balls}
                      </div>
                    </div>
                  </div>

                  {/* Equation details */}
                  <div className="mt-3 bg-neutral-50 rounded-xl p-3 border border-neutral-100/50">
                    <p className="text-xs font-extrabold text-neutral-800">
                      {isSecondInnings ? (
                        runsNeeded <= 0 ? (
                          <span className="text-emerald-600">Scores are level!</span>
                        ) : ballsRemaining <= 0 ? (
                          <span className="text-red-600">Innings completed.</span>
                        ) : (
                          <span>
                            {battingTeamName} needs <strong className="text-emerald-600 font-black">{runsNeeded}</strong> runs in <strong className="text-neutral-900 font-black">{ballsRemaining}</strong> balls
                          </span>
                        )
                      ) : (
                        <span>{battingTeamName} is setting the target.</span>
                      )}
                    </p>

                    {/* CRR and RRR info */}
                    <div className="mt-1.5 flex gap-4 text-[10px] font-bold text-neutral-500">
                      <span>CRR: <strong className="font-mono text-neutral-700">{crr}</strong></span>
                      {rrr && (
                        <span>RRR: <strong className="font-mono text-emerald-600">{rrr}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Batter / Bowler stats if assigned */}
                  {(strikerName || nonStrikerName || bowlerName) && (
                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-3 text-xs">
                      {/* Active Batsmen */}
                      <div className="space-y-1 border-r border-neutral-100 pr-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Batter</div>
                        {strikerName && (
                          <div className="flex items-center justify-between text-neutral-800 font-semibold">
                            <span className="truncate max-w-[90px]">🏏 {strikerName}*</span>
                            <span className="font-mono font-bold text-neutral-900">
                              {strikerStats?.runs || 0}({strikerStats?.balls || 0})
                            </span>
                          </div>
                        )}
                        {nonStrikerName && (
                          <div className="flex items-center justify-between text-neutral-500">
                            <span className="truncate max-w-[90px]">🏏 {nonStrikerName}</span>
                            <span className="font-mono">
                              {nonStrikerStats?.runs || 0}({nonStrikerStats?.balls || 0})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Active Bowler */}
                      <div className="space-y-1 pl-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Bowler</div>
                        {bowlerName ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-neutral-800 truncate max-w-[120px]">
                              🥎 {bowlerName}
                            </div>
                            <div className="font-mono text-[10px] text-neutral-500">
                              {activeBowlerStats?.overs || 0}.{activeBowlerStats?.balls || 0}-{activeBowlerStats?.maidens || 0}-{activeBowlerStats?.runs || 0}-{activeBowlerStats?.wickets || 0}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-400">No bowler assigned</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Over history (balls) */}
                  {battingInnings.currentOver && battingInnings.currentOver.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 border-t border-neutral-50 pt-2.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">This Over:</span>
                      <div className="flex flex-wrap gap-1">
                        {battingInnings.currentOver.map((ball, idx) => {
                          const isWicket = ball.includes('W');
                          const isBoundary4 = ball === '4';
                          const isBoundary6 = ball === '6';
                          const isExtra = ball.includes('wd') || ball.includes('nb');
                          return (
                            <span
                              key={idx}
                              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[9px] font-black leading-none ${
                                isWicket
                                  ? 'bg-red-500 text-white shadow-xs shadow-red-200'
                                  : isBoundary4
                                  ? 'bg-emerald-500 text-white'
                                  : isBoundary6
                                  ? 'bg-blue-600 text-white'
                                  : isExtra
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200/50'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {ball}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Click to Score/Watch Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100/60 pt-3">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      TURFCRICS ENGINE
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 group-hover:underline">
                      {isAdmin ? 'Score Match' : 'Watch Live'} <ChevronRight size={14} className="stroke-[2.5px]" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Matches Section */}
      <div id="recent-results-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Recent Match Results</h2>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            All Results
          </button>
        </div>

        {completedMatches.length > 0 ? (
          <div className="grid gap-3">
            {completedMatches.map(m => (
              <motion.div
                key={m.id}
                whileHover={{ y: -1 }}
                onClick={() => onViewMatchDetails(m.id)}
                className="cursor-pointer rounded-2xl border border-neutral-100 bg-white p-4 transition hover:border-neutral-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-neutral-400">
                    {m.matchType === 'tournament' ? `Tournament${getSeriesInfo(m)}` : 'Completed'} · {m.totalOvers} Overs
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    Final Scorecard
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-neutral-800">{m.team1Name}</span>
                    <span className="mx-2 text-xs text-neutral-400">vs</span>
                    <span className="font-bold text-neutral-800">{m.team2Name}</span>
                  </div>
                </div>

                <div className="mt-2 text-sm font-black text-emerald-600">
                  {m.result}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-neutral-50 pt-2 text-xs text-neutral-500">
                  <div className="flex gap-4">
                    <span>
                      {m.battingFirstName}:{' '}
                      <strong className="font-mono text-neutral-700">
                        {m.innings[0].runs}/{m.innings[0].wickets}
                      </strong>
                    </span>
                    <span>
                      {m.fieldingFirstName}:{' '}
                      <strong className="font-mono text-neutral-700">
                        {m.innings[1].runs}/{m.innings[1].wickets}
                      </strong>
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-neutral-400" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400">
            No completed matches logged yet. Start a new match to get scoring!
          </div>
        )}
      </div>
    </div>
  );
}
