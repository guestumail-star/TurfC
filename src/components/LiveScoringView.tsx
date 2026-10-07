import React, { useState } from 'react';
import { Match, Player, Team } from '../types';
import { sr, economy, ovStr, rr } from '../utils/cricket';
import { Undo, RefreshCw, AlertTriangle, User, Award, ArrowLeftRight, Heart, HelpCircle, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface LiveScoringViewProps {
  match: Match;
  players: Player[];
  teams: Team[];
  isAdmin?: boolean;
  allMatches?: Match[];
  onContinueSeries?: (seriesId: string, team1Id: string, team2Id: string, totalSeriesMatches: number, tournamentName?: string) => void;
  onEndSeries?: (seriesId: string) => void;
  onDeliverBall: (
    outcome: string,
    wicketDetail?: {
      type: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired';
      bowlerId?: string;
      helperId?: string;
      outPlayerId?: string;
      runOutRuns?: number;
    }
  ) => void;
  onUndoLastBall: () => void;
  onSwapBatsmen: () => void;
  onRetireHurt: (pid: string) => void;
  onSelectStriker: (pid: string) => void;
  onSelectNonStriker: (pid: string) => void;
  onSelectBowler: (pid: string) => void;
  onReplaceBatsman?: (type: 'striker' | 'nonStriker', pid: string) => void;
  onEndMatch?: () => void;
  onExit: () => void;
}

export default function LiveScoringView({
  match,
  players,
  teams,
  isAdmin = false,
  allMatches = [],
  onContinueSeries,
  onEndSeries,
  onDeliverBall,
  onUndoLastBall,
  onSwapBatsmen,
  onRetireHurt,
  onSelectStriker,
  onSelectNonStriker,
  onSelectBowler,
  onReplaceBatsman,
  onEndMatch,
  onExit,
}: LiveScoringViewProps) {
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);
  const [changingBatsmanType, setChangingBatsmanType] = useState<'striker' | 'nonStriker' | null>(null);
  const [changingBowler, setChangingBowler] = useState<boolean>(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketType, setWicketType] = useState<'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired'>('Bowled');
  const [wicketFielderId, setWicketFielderId] = useState<string>('');
  const [wicketOutPlayerId, setWicketOutPlayerId] = useState<string>('');
  const [runOutRuns, setRunOutRuns] = useState<number>(0);

  const innIdx = match.currentInnings - 1;
  const inn = match.innings[innIdx];
  const { striker, nonStriker, bowler } = inn;

  const isComplete = match.status === 'complete';

  const getPlayerName = (pid: string) => {
    const p = players.find(x => x.id === pid);
    return p ? p.name : 'Unknown Player';
  };

  const getPlayerJersey = (pid: string) => {
    const p = players.find(x => x.id === pid);
    return p ? p.jerseyNo : '#';
  };

  const getPlayerRole = (pid: string) => {
    const p = players.find(x => x.id === pid);
    return p ? p.role : '';
  };

  const getLiveWicketDesc = (b: typeof inn.batting[0]) => {
    if (b.retiredHurt) return 'Retired Hurt';
    if (!b.out) return '';
    if (!b.wicketDetail) return 'Out';
    const { type, bowlerId, helperId } = b.wicketDetail;
    const bowlerName = bowlerId ? getPlayerName(bowlerId) : '';
    const helperName = helperId ? getPlayerName(helperId) : '';

    switch (type) {
      case 'Bowled':
        return `b ${bowlerName}`;
      case 'Caught':
        if (helperId && helperId === bowlerId) {
          return `c & b ${bowlerName}`;
        }
        return helperName ? `c ${helperName} b ${bowlerName}` : `c & b ${bowlerName}`;
      case 'LBW':
        return `lbw b ${bowlerName}`;
      case 'Stumped':
        return helperName ? `st ${helperName} b ${bowlerName}` : `st b ${bowlerName}`;
      case 'Run Out':
        return helperName ? `run out (${helperName})` : `run out`;
      case 'Hit Wicket':
        return `hit wicket b ${bowlerName}`;
      case 'Retired':
        return 'retired';
      default:
        return 'out';
    }
  };

  // Identify squad players
  const batTeamId = match.currentInnings === 1 ? match.battingFirstId : match.fieldingFirstId;
  const bowlTeamId = match.currentInnings === 1 ? match.fieldingFirstId : match.battingFirstId;

  const batTeam = teams.find(t => t.id === batTeamId);
  const bowlTeam = teams.find(t => t.id === bowlTeamId);

  const availBatPlayerIds = batTeam ? batTeam.playerIds : [];
  const availBowlPlayerIds = bowlTeam ? bowlTeam.playerIds : [];

  const outPlayerIds = inn.batting.filter(b => b.out).map(b => b.pid);
  const retiredHurtIds = inn.retiredHurt || [];
  const unavailableBatIds = [...outPlayerIds, ...retiredHurtIds];

  const activeBattersAtCrease = [striker, nonStriker].filter((id): id is string => !!id);

  const needsStriker = !striker;
  const needsNonStriker = !nonStriker;
  const needsBowler = !bowler;
  const lastPlayerSolo = match.lastPlayerSolo ?? true;
  const isLastManStanding = lastPlayerSolo && needsNonStriker && striker && availBatPlayerIds.filter(pid => !unavailableBatIds.includes(pid) && pid !== striker).length === 0;

  const canScore = !!striker && !!bowler;

  const handleWicketSubmit = () => {
    onDeliverBall('W', {
      type: wicketType,
      bowlerId: bowler || undefined,
      helperId: wicketFielderId || undefined,
      outPlayerId: wicketOutPlayerId || striker || undefined,
      runOutRuns: wicketType === 'Run Out' ? runOutRuns : undefined,
    });
    setShowWicketModal(false);
    setWicketType('Bowled');
    setWicketFielderId('');
    setWicketOutPlayerId('');
    setRunOutRuns(0);
  };

  const target = match.currentInnings === 2 ? match.innings[0].runs + 1 : null;
  const neededRuns = target ? target - inn.runs : null;
  const ballsRemaining = match.totalOvers * 6 - (inn.overs * 6 + inn.balls);

  const strikerData = inn.batting.find(b => b.pid === striker);
  const nonStrikerData = inn.batting.find(b => b.pid === nonStriker);
  const bowlerData = inn.bowling.find(b => b.pid === bowler);

  // Ball style badges mapping
  const getBallBadgeStyles = (val: string) => {
    if (val === 'W' || val.includes('+W') || val.includes('W+')) {
      return 'bg-red-500 text-white font-black';
    }
    switch (val) {
      case '0':
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
      case '1':
      case '2':
      case '3':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case '4':
        return 'bg-emerald-500 text-neutral-950 font-black';
      case '6':
        return 'bg-purple-600 text-white font-black';
      case 'W':
        return 'bg-red-500 text-white font-black';
      case 'Wd':
      case 'Nb':
        return 'bg-amber-100 text-amber-800 border border-amber-200 font-bold';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div id="live-scoring-view" className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1 text-sm font-bold text-neutral-500 hover:text-neutral-900"
        >
          {isAdmin ? '← Save & Exit' : '← Back to Home'}
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && !isComplete && onEndMatch && (
            <button
              onClick={() => setShowEndMatchConfirm(true)}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-red-700 transition"
            >
              End Match
            </button>
          )}
          {isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
              ✓ Finished
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 border border-red-100 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
              Scoring Live
            </span>
          )}
        </div>
      </div>

      {showEndMatchConfirm && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm space-y-3 animate-none">
          <div className="flex items-start gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <div className="font-bold text-red-950">End current match manually?</div>
              <div className="text-xs text-red-800 mt-1">
                This will immediately finalize the match status to complete and record the winner based on the current live score. This action cannot be undone.
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 text-xs font-bold pt-1">
            <button
              onClick={() => setShowEndMatchConfirm(false)}
              className="px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowEndMatchConfirm(false);
                if (onEndMatch) {
                  onEndMatch();
                }
              }}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs"
            >
              Yes, End Match
            </button>
          </div>
        </div>
      )}

      {/* Match title header */}
      <div className="text-center">
        <h2 className="text-lg font-black text-neutral-950">
          {match.team1Name} <span className="text-neutral-400 font-semibold mx-1">VS</span> {match.team2Name}
        </h2>
      </div>

      {/* Quick Score Summary Display */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map(n => {
          const innData = match.innings[n - 1];
          const name = n === 1 ? match.battingFirstName : match.fieldingFirstName;
          const isActive = match.currentInnings === n && !isComplete;

          return (
            <div
              key={n}
              className={`rounded-2xl border p-4 text-center transition-all ${
                isActive
                  ? 'border-emerald-300 bg-emerald-50/50 shadow-xs'
                  : 'border-neutral-200/80 bg-white'
              }`}
            >
              <div className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-emerald-700' : 'text-neutral-400'}`}>
                {name}
              </div>
              <div className="text-2xl font-black text-neutral-900 mt-1">
                {innData.runs}
                <span className="text-red-500 text-lg">/{innData.wickets}</span>
              </div>
              <div className="text-xs text-neutral-500 font-medium font-mono mt-0.5">
                {ovStr(innData.overs, innData.balls)} / {match.totalOvers} ov
              </div>
              <div className="text-[10px] text-neutral-400 font-semibold uppercase mt-1">
                Run Rate: {rr(innData.runs, innData.overs, innData.balls)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Second Innings Target Indicator */}
      {target && !isComplete && neededRuns !== null && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-center space-y-1">
          <div className="text-sm font-bold text-amber-900">
            {match.fieldingFirstName} needs <span className="font-black text-amber-700 font-mono text-lg">{neededRuns}</span> runs off <span className="font-black font-mono text-lg text-amber-700">{ballsRemaining}</span> balls
          </div>
          <div className="flex justify-center gap-4 text-[11px] font-bold text-amber-800">
            <span>Target: <strong className="font-mono">{target}</strong></span>
            <span>Req. Run Rate: <strong className="font-mono">{ballsRemaining > 0 ? ((neededRuns / ballsRemaining) * 6).toFixed(2) : '—'}</strong></span>
          </div>
        </div>
      )}

      {/* Current Over ball tracker */}
      {inn.currentOver.length > 0 && !isComplete && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Current Over</div>
          <div className="flex flex-wrap gap-2">
            {inn.currentOver.map((b, i) => (
              <span
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold font-mono ${getBallBadgeStyles(b)}`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Batters creased information panel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">At the Crease</h3>
          {isAdmin ? (
            <div className="flex gap-2">
              {striker && nonStriker && (
                <button
                  onClick={onSwapBatsmen}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  <ArrowLeftRight size={12} />
                  Swap Strike
                </button>
              )}
              {(striker || nonStriker) && (
                <button
                  onClick={() => setShowRetireConfirm(!showRetireConfirm)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  <Heart size={12} />
                  Retire Hurt
                </button>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600 border border-emerald-200/50 animate-pulse">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Live Viewer Mode
            </span>
          )}
        </div>

        {/* Retire hurt selection helper menu */}
        {showRetireConfirm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
            <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">Select batsman to retire hurt:</div>
            <div className="flex gap-2">
              {[striker, nonStriker].filter(Boolean).map(pid => (
                <button
                  key={pid}
                  onClick={() => {
                    onRetireHurt(pid!);
                    setShowRetireConfirm(false);
                  }}
                  className="rounded-lg bg-white border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100"
                >
                  🤕 {getPlayerName(pid!)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Change batsman helper menu */}
        {changingBatsmanType && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-black text-emerald-900 text-xs uppercase tracking-wider">
                Change {changingBatsmanType === 'striker' ? 'Striker' : 'Non-Striker'}
              </div>
              <button
                onClick={() => setChangingBatsmanType(null)}
                className="text-[10px] font-bold text-neutral-500 hover:text-neutral-900 uppercase"
              >
                Cancel
              </button>
            </div>
            
            <div className="text-xs text-emerald-800">
              Select a player to replace {getPlayerName(changingBatsmanType === 'striker' ? striker! : nonStriker!)}:
            </div>

            <div className="flex flex-wrap gap-2">
              {availBatPlayerIds
                .filter(pid => 
                  !unavailableBatIds.includes(pid) && 
                  pid !== (changingBatsmanType === 'striker' ? nonStriker : striker)
                )
                .map(pid => (
                  <button
                    key={pid}
                    onClick={() => {
                      if (onReplaceBatsman) {
                        onReplaceBatsman(changingBatsmanType, pid);
                      }
                      setChangingBatsmanType(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-emerald-300 hover:border-emerald-500 px-3 py-2 text-xs font-bold text-neutral-900 shadow-xs hover:bg-emerald-50 transition"
                  >
                    <span className="font-mono text-[10px] font-black text-emerald-600">#{getPlayerJersey(pid)}</span>
                    {getPlayerName(pid)}
                  </button>
                ))}
              {availBatPlayerIds.filter(pid => 
                !unavailableBatIds.includes(pid) && 
                pid !== (changingBatsmanType === 'striker' ? nonStriker : striker)
              ).length === 0 && (
                <div className="text-xs text-neutral-500 font-medium">No other available batsmen in the squad.</div>
              )}
            </div>
          </div>
        )}

        {/* Change bowler helper menu */}
        {changingBowler && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-black text-blue-900 text-xs uppercase tracking-wider">
                Change Bowler
              </div>
              <button
                onClick={() => setChangingBowler(false)}
                className="text-[10px] font-bold text-neutral-500 hover:text-neutral-900 uppercase"
              >
                Cancel
              </button>
            </div>
            
            <div className="text-xs text-blue-800">
              Select a player to replace {bowler ? getPlayerName(bowler) : 'the bowler'}:
            </div>

            <div className="flex flex-wrap gap-2">
              {availBowlPlayerIds
                .filter(pid => pid !== bowler)
                .map(pid => (
                  <button
                    key={pid}
                    onClick={() => {
                      onSelectBowler(pid);
                      setChangingBowler(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-blue-300 hover:border-blue-500 px-3 py-2 text-xs font-bold text-neutral-900 shadow-xs hover:bg-blue-50 transition"
                  >
                    <span className="font-mono text-[10px] font-black text-blue-600">#{getPlayerJersey(pid)}</span>
                    {getPlayerName(pid)}
                  </button>
                ))}
              {availBowlPlayerIds.filter(pid => pid !== bowler).length === 0 && (
                <div className="text-xs text-neutral-500 font-medium">No other available bowlers in the squad.</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Striker card */}
          <div
            className={`rounded-2xl border p-4 transition-all ${
              striker
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-dashed border-red-200 bg-red-50/30 text-center flex flex-col justify-center'
            }`}
          >
            {striker ? (
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-neutral-950">
                    Striker ●
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setChangingBatsmanType('striker');
                        setShowRetireConfirm(false);
                      }}
                      className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded transition"
                    >
                      Change
                    </button>
                  )}
                </div>
                <div className="font-extrabold text-neutral-900 mt-2 truncate">
                  {getPlayerName(striker)}
                </div>
                <div className="text-3xl font-black text-neutral-900 mt-1 font-mono leading-none">
                  {strikerData?.runs || 0}
                  <span className="text-sm font-semibold text-neutral-500 font-normal ml-1">
                    ({strikerData?.balls || 0}b)
                  </span>
                </div>
                <div className="mt-2 flex gap-3 text-[10px] font-bold text-neutral-500 font-mono">
                  <span>4s: {strikerData?.fours || 0}</span>
                  <span>6s: {strikerData?.sixes || 0}</span>
                  <span>SR: {sr(strikerData?.runs || 0, strikerData?.balls || 0)}</span>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <span className="text-xs font-bold text-red-700">Wicket Fallen!</span>
                <div className="text-[11px] text-red-500 mt-1">Select the next batsman from squad.</div>
              </div>
            )}
          </div>

          {/* Non-striker card */}
          <div
            className={`rounded-2xl border p-4 transition-all ${
              nonStriker
                ? 'border-neutral-200 bg-white'
                : isLastManStanding
                ? 'border-amber-200 bg-amber-50/30 text-center flex flex-col justify-center'
                : 'border-dashed border-red-200 bg-red-50/30 text-center flex flex-col justify-center'
            }`}
          >
            {nonStriker ? (
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-neutral-500">
                    Non-Striker
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setChangingBatsmanType('nonStriker');
                        setShowRetireConfirm(false);
                      }}
                      className="text-[9px] font-extrabold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 rounded transition"
                    >
                      Change
                    </button>
                  )}
                </div>
                <div className="font-extrabold text-neutral-900 mt-2 truncate">
                  {getPlayerName(nonStriker)}
                </div>
                <div className="text-3xl font-black text-neutral-900 mt-1 font-mono leading-none">
                  {nonStrikerData?.runs || 0}
                  <span className="text-sm font-semibold text-neutral-500 font-normal ml-1">
                    ({nonStrikerData?.balls || 0}b)
                  </span>
                </div>
                <div className="mt-2 flex gap-3 text-[10px] font-bold text-neutral-500 font-mono">
                  <span>4s: {nonStrikerData?.fours || 0}</span>
                  <span>6s: {nonStrikerData?.sixes || 0}</span>
                  <span>SR: {sr(nonStrikerData?.runs || 0, nonStrikerData?.balls || 0)}</span>
                </div>
              </div>
            ) : isLastManStanding ? (
              <div className="py-2">
                <span className="text-xs font-bold text-amber-800">Last Man Standing</span>
                <div className="text-[11px] text-amber-600 mt-1">Batter is scoring solo.</div>
              </div>
            ) : (
              <div className="py-2">
                <span className="text-xs font-bold text-red-700">Wicket Fallen!</span>
                <div className="text-[11px] text-red-500 mt-1">Select the next batsman from squad.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bowler Details Panel */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Current Bowler</h3>
        <div
          className={`rounded-2xl border p-4 flex items-center justify-between ${
            bowler ? 'border-neutral-200 bg-white' : 'border-dashed border-red-200 bg-red-50/30'
          }`}
        >
          {bowler ? (
            <>
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase bg-blue-500 text-neutral-950 px-1.5 py-0.5 rounded-md">
                    Active Bowler ●
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setChangingBowler(true);
                      }}
                      className="text-[9px] font-extrabold uppercase tracking-wider text-blue-700 hover:text-blue-950 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded transition"
                    >
                      Change
                    </button>
                  )}
                </div>
                <h4 className="font-extrabold text-neutral-950 mt-1.5 leading-tight">{getPlayerName(bowler)}</h4>
                <p className="text-[11px] text-neutral-500 font-semibold font-mono mt-0.5">
                  {bowlerData ? `${bowlerData.overs}.${bowlerData.balls}` : '0.0'} overs · {bowlerData?.runs || 0} runs · {bowlerData?.wickets || 0} wickets
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase text-neutral-400">Economy</div>
                <div className="text-lg font-black text-neutral-900 font-mono leading-none mt-1">
                  {bowlerData ? economy(bowlerData.runs, bowlerData.overs, bowlerData.balls) : '0.00'}
                </div>
              </div>
            </>
          ) : (
            <div className="py-1 text-center w-full">
              <span className="text-xs font-bold text-red-700">Bowler Required!</span>
              <div className="text-[11px] text-red-500 mt-0.5">Select a bowler from squad to initiate next over.</div>
            </div>
          )}
        </div>
      </div>

      {/* Selection Panel / Screens when batsman or bowler needs to be chosen */}
      {!isComplete && (
        <div className="space-y-3">
          {isAdmin ? (
            <>
              {/* Striker Selector */}
              {needsStriker && !isLastManStanding && (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/20 p-5 space-y-3 animate-none">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800">Assign New Striker</h4>
                  <div className="flex flex-wrap gap-2 animate-none">
                    {availBatPlayerIds
                      .filter(pid => !unavailableBatIds.includes(pid) && pid !== nonStriker)
                      .map(pid => (
                        <button
                          key={pid}
                          onClick={() => onSelectStriker(pid)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-900 shadow-xs hover:border-emerald-500 animate-none"
                        >
                          <span className="font-mono text-xs font-black text-emerald-600">#{getPlayerJersey(pid)}</span>
                          {getPlayerName(pid)}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Non-Striker Selector */}
              {needsNonStriker && !isLastManStanding && !needsStriker && (
                <div className="rounded-3xl border border-blue-200 bg-blue-50/10 p-5 space-y-3 animate-none">
                  <h4 className="text-xs font-black uppercase tracking-widest text-blue-800">Assign Non-Striker</h4>
                  <div className="flex flex-wrap gap-2 animate-none">
                    {availBatPlayerIds
                      .filter(pid => !unavailableBatIds.includes(pid) && pid !== striker)
                      .map(pid => (
                        <button
                          key={pid}
                          onClick={() => onSelectNonStriker(pid)}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-900 shadow-xs hover:border-blue-500 animate-none"
                        >
                          <span className="font-mono text-xs font-black text-blue-600">#{getPlayerJersey(pid)}</span>
                          {getPlayerName(pid)}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Bowler Selector */}
              {needsBowler && !needsStriker && (
                <div className="rounded-3xl border border-purple-200 bg-purple-50/10 p-5 space-y-3 animate-none">
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-800">Select Bowler for Next Over</h4>
                  <div className="flex flex-wrap gap-2 animate-none">
                    {availBowlPlayerIds
                      .filter(pid => pid !== bowler)
                      .map(pid => (
                        <button
                          key={pid}
                          onClick={() => onSelectBowler(pid)}
                          className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-900 shadow-xs hover:border-purple-500 animate-none"
                        >
                          <span className="font-mono text-xs font-black text-purple-600">#{getPlayerJersey(pid)}</span>
                          {getPlayerName(pid)}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Recall retired hurt batsmen if vacancies exist */}
              {retiredHurtIds.length > 0 && (needsStriker || needsNonStriker) && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/10 p-5 space-y-3 animate-none">
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-800">Recall Retired Hurt Batter</h4>
                  <div className="flex flex-wrap gap-2 animate-none">
                    {retiredHurtIds
                      .filter(pid => pid !== striker && pid !== nonStriker)
                      .map(pid => (
                        <button
                          key={pid}
                          onClick={() => {
                            if (needsStriker) {
                              onSelectStriker(pid);
                            } else {
                              onSelectNonStriker(pid);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-900 shadow-xs hover:border-amber-500 animate-none"
                        >
                          🤕 {getPlayerName(pid)}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            (needsStriker || needsNonStriker || needsBowler) && (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center animate-none">
                <span className="inline-flex p-3 rounded-full bg-emerald-50 text-emerald-500 mb-3 animate-none">
                  <RefreshCw size={24} className="animate-spin text-emerald-600" />
                </span>
                <h4 className="text-sm font-black text-neutral-900">Scorer is updating the field...</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Waiting for the scorer to assign the next batter/bowler. The scorecard updates live in real-time.
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* Primary Scoring Control Buttons */}
      {canScore && !isComplete && isAdmin && (
        <div id="scoring-board" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Scoring controls</span>
            <button
              onClick={onUndoLastBall}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50/40"
            >
              <Undo size={12} />
              Undo Last Ball
            </button>
          </div>

          {/* Numbers grid */}
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { val: '0', label: 'dot' },
              { val: '1', label: '1 run' },
              { val: '2', label: '2 runs' },
              { val: '3', label: '3 runs' },
            ].map(r => (
              <button
                key={r.val}
                onClick={() => onDeliverBall(r.val)}
                className="rounded-2xl border border-neutral-200 bg-white py-3 text-center shadow-xs active:scale-95 transition hover:border-emerald-500 focus:outline-none"
              >
                <div className="text-2xl font-black text-neutral-900">{r.val === '0' ? '•' : r.val}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">{r.label}</div>
              </button>
            ))}
          </div>

          {/* Actions grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => onDeliverBall('4')}
              className="rounded-2xl border border-emerald-100 bg-emerald-50 py-3 text-center shadow-xs active:scale-95 transition hover:bg-emerald-100/50 focus:outline-none"
            >
              <div className="text-2xl font-black text-emerald-700">4</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mt-0.5">Boundary</div>
            </button>

            <button
              onClick={() => onDeliverBall('6')}
              className="rounded-2xl border border-purple-100 bg-purple-50 py-3 text-center shadow-xs active:scale-95 transition hover:bg-purple-100/50 focus:outline-none"
            >
              <div className="text-2xl font-black text-purple-700">6</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-purple-600 mt-0.5">Maximum</div>
            </button>

            <button
              onClick={() => {
                setWicketOutPlayerId(striker || '');
                setShowWicketModal(true);
              }}
              className="rounded-2xl border border-red-100 bg-red-50 py-3 text-center shadow-xs active:scale-95 transition hover:bg-red-100/50 focus:outline-none"
            >
              <div className="text-2xl font-black text-red-600">W</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-red-500 mt-0.5">Wicket</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onDeliverBall('Wd')}
              className="rounded-2xl border border-amber-100 bg-amber-50 py-3 text-center shadow-xs active:scale-95 transition hover:bg-amber-100/50 focus:outline-none"
            >
              <div className="text-lg font-black text-amber-700">WIDE</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mt-0.5">+1 run & extra ball</div>
            </button>

            <button
              onClick={() => onDeliverBall('Nb')}
              className="rounded-2xl border border-amber-100 bg-amber-50 py-3 text-center shadow-xs active:scale-95 transition hover:bg-amber-100/50 focus:outline-none"
            >
              <div className="text-lg font-black text-amber-700">NO BALL</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mt-0.5">+1 run & extra ball</div>
            </button>
          </div>
        </div>
      )}

      {/* Finished Match Summary Card */}
      {isComplete && (() => {
        const getMatchWinnerId = (m: Match) => {
          if (m.status !== 'complete') return null;
          const r1 = m.innings[0].runs;
          const r2 = m.innings[1].runs;
          if (r1 > r2) return m.battingFirstId;
          if (r2 > r1) return m.fieldingFirstId;
          return null;
        };

        const isTournament = match.matchType === 'tournament' && match.seriesId;
        const seriesMatches = isTournament && allMatches ? allMatches.filter(m => m.seriesId === match.seriesId) : [];
        const completedMatches = seriesMatches.filter(m => m.status === 'complete');
        
        // Chronological order (oldest first)
        const sortedSeriesMatches = [...seriesMatches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const currentMatchNo = sortedSeriesMatches.findIndex(m => m.id === match.id) + 1;
        const totalSeriesMatches = match.tournamentMatches || 3;

        let team1Wins = 0;
        let team2Wins = 0;
        let ties = 0;

        completedMatches.forEach(m => {
          const wId = getMatchWinnerId(m);
          if (wId === match.team1Id) team1Wins++;
          else if (wId === match.team2Id) team2Wins++;
          else if (wId === null) ties++;
        });

        // Determine if series is completed
        const hasManualEnd = seriesMatches.some(m => m.seriesEnded);
        const isSeriesFinished = hasManualEnd || completedMatches.length >= totalSeriesMatches;

        let standingText = 'Series tied';
        if (team1Wins > team2Wins) {
          standingText = `${match.team1Name} leads ${team1Wins}-${team2Wins}`;
          if (isSeriesFinished) standingText = `${match.team1Name} wins the series ${team1Wins}-${team2Wins}!`;
        } else if (team2Wins > team1Wins) {
          standingText = `${match.team2Name} leads ${team2Wins}-${team1Wins}`;
          if (isSeriesFinished) standingText = `${match.team2Name} wins the series ${team2Wins}-${team1Wins}!`;
        } else if (team1Wins === team2Wins && team1Wins > 0) {
          standingText = `Series tied ${team1Wins}-${team2Wins}`;
        }

        return (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 text-center space-y-4 shadow-sm">
            <Award size={48} className="mx-auto text-emerald-600" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                {isTournament ? `Tournament Match ${currentMatchNo} of ${totalSeriesMatches}` : 'Match Complete'}
              </span>
              <h3 className="text-2xl font-black text-neutral-900 mt-3">{match.result}</h3>
            </div>

            {isTournament && (
              <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4 space-y-2.5 text-left">
                <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">🏆 Series Standing</span>
                  <span className="text-xs font-bold text-neutral-600">{standingText}</span>
                </div>
                <div className="space-y-1">
                  {sortedSeriesMatches.map((m, idx) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500 font-medium">Match {idx + 1}:</span>
                      <span className={m.id === match.id ? "font-bold text-emerald-600" : "text-neutral-700"}>
                        {m.status === 'live' ? 'Live in progress' : m.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {isTournament && !isSeriesFinished && onContinueSeries && isAdmin && (
                <button
                  onClick={() => onContinueSeries(match.seriesId!, match.team1Id, match.team2Id, totalSeriesMatches, match.tournamentName)}
                  className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 active:scale-95 shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Start Match {currentMatchNo + 1} of Series
                </button>
              )}

              {isTournament && !isSeriesFinished && onEndSeries && isAdmin && (
                <button
                  onClick={() => onEndSeries(match.seriesId!)}
                  className="w-full rounded-2xl bg-amber-600 py-3 text-sm font-bold text-white transition hover:bg-amber-500 active:scale-95 shadow-sm flex items-center justify-center gap-2"
                >
                  End Series Early / Complete Tournament
                </button>
              )}

              <button
                onClick={onExit}
                className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 active:scale-95 shadow-sm"
              >
                Exit Scorecard
              </button>
            </div>
          </div>
        );
      })()}

      {/* Completed Over Logs History (Expandable summary cards) */}
      {inn.overHistory.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Over Logs</h3>
          <div className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden divide-y divide-neutral-100">
            {[...inn.overHistory].reverse().map((ovBalls, i, arr) => {
              const currentOverNum = arr.length - i;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <span className="font-bold text-neutral-400 min-w-[36px] font-mono">Ov {currentOverNum}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ovBalls.map((b, bIdx) => (
                      <span
                        key={bIdx}
                        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-bold ${getBallBadgeStyles(b)}`}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Batting & Bowling card previews inside live score */}
      {inn.batting.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Live Batting Scorecard</h3>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
            <div className="grid grid-cols-[1fr_36px_36px_28px_28px_44px] border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-right text-[9px] font-black uppercase tracking-wider text-neutral-400">
              <div className="text-left">Batter</div>
              <div>R</div>
              <div>B</div>
              <div>4s</div>
              <div>6s</div>
              <div>S/R</div>
            </div>
            <div className="divide-y divide-neutral-100">
              {inn.batting.map(b => {
                const isActive = b.pid === striker || b.pid === nonStriker;
                return (
                  <div
                    key={b.pid}
                    className={`grid grid-cols-[1fr_36px_36px_28px_28px_44px] items-center px-4 py-2 text-right text-xs ${
                      isActive ? 'bg-emerald-50/20 font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-neutral-900 font-bold">{getPlayerName(b.pid)}</span>
                        {b.pid === striker && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Striker"></span>}
                        {b.pid === nonStriker && <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" title="Non-striker"></span>}
                      </div>
                      {(b.out || b.retiredHurt) && (
                        <div className="text-[10px] text-neutral-400 font-semibold mt-0.5 leading-none">
                          {getLiveWicketDesc(b)}
                        </div>
                      )}
                    </div>
                    <div className={`font-mono ${isActive ? 'font-black text-neutral-900' : ''}`}>{b.runs}</div>
                    <div className="font-mono">{b.balls}</div>
                    <div className="font-mono">{b.fours}</div>
                    <div className="font-mono">{b.sixes}</div>
                    <div className="font-mono text-neutral-400">{sr(b.runs, b.balls)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {inn.bowling.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Live Bowling Scorecard</h3>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
            <div className="grid grid-cols-[1fr_40px_35px_35px_40px] border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-right text-[9px] font-black uppercase tracking-wider text-neutral-400">
              <div className="text-left">Bowler</div>
              <div>Overs</div>
              <div>Runs</div>
              <div>Wkts</div>
              <div>Econ</div>
            </div>
            <div className="divide-y divide-neutral-100">
              {inn.bowling.map(b => {
                const isActive = b.pid === bowler;
                return (
                  <div
                    key={b.pid}
                    className={`grid grid-cols-[1fr_40px_35px_35px_40px] items-center px-4 py-2 text-right text-xs ${
                      isActive ? 'bg-blue-50/20 font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    <div className="text-left min-w-0 flex items-center gap-1">
                      <span className="truncate">{getPlayerName(b.pid)}</span>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>}
                    </div>
                    <div className="font-mono">{ovStr(b.overs, b.balls)}</div>
                    <div className="font-mono">{b.runs}</div>
                    <div className={`font-mono ${b.wickets > 0 ? 'font-bold text-emerald-600' : ''}`}>{b.wickets}</div>
                    <div className="font-mono text-neutral-400">{economy(b.runs, b.overs, b.balls)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wicket Details Dialog Modal */}
      {showWicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xl space-y-4 text-left"
          >
            <div>
              <h3 className="text-lg font-black text-neutral-950">Record Wicket</h3>
              <p className="text-xs text-neutral-500 mt-1">Specify how the wicket fell and who contributed.</p>
            </div>

            {/* Out Batter selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Who is Out?</label>
              <div className="grid grid-cols-2 gap-2">
                {striker && (
                  <button
                    type="button"
                    onClick={() => setWicketOutPlayerId(striker)}
                    className={`rounded-xl border p-2.5 text-xs font-bold text-center transition ${
                      wicketOutPlayerId === striker
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    Striker: {getPlayerName(striker)}
                  </button>
                )}
                {nonStriker && (
                  <button
                    type="button"
                    onClick={() => setWicketOutPlayerId(nonStriker)}
                    className={`rounded-xl border p-2.5 text-xs font-bold text-center transition ${
                      wicketOutPlayerId === nonStriker
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    Non-Striker: {getPlayerName(nonStriker)}
                  </button>
                )}
              </div>
            </div>

            {/* Wicket Type selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Wicket Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket'] as const).map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => {
                      setWicketType(type);
                      // Clear helper fielder if it's not a fielding helper type
                      if (type !== 'Caught' && type !== 'Run Out' && type !== 'Stumped') {
                        setWicketFielderId('');
                      }
                    }}
                    className={`rounded-xl border py-2 text-[11px] font-black text-center transition ${
                      wicketType === type
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Bowler Name (Read-Only Info) */}
            {wicketType !== 'Run Out' && bowler && (
              <div className="rounded-xl bg-neutral-50 p-2.5 border border-neutral-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-500">Wicket Credited To:</span>
                <span className="font-extrabold text-neutral-800">{getPlayerName(bowler)}</span>
              </div>
            )}

            {/* Helper Fielder Dropdown/Selection (Only for Caught, Run Out, Stumped) */}
            {['Caught', 'Run Out', 'Stumped'].includes(wicketType) && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                  {wicketType === 'Caught' ? 'Who caught it?' : wicketType === 'Stumped' ? 'Who stumped it?' : 'Who threw/assisted?'} (Fielder)
                </label>
                <select
                  value={wicketFielderId}
                  onChange={(e) => setWicketFielderId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Select Fielder --</option>
                  {availBowlPlayerIds.map(pid => (
                    <option key={pid} value={pid}>
                      #{getPlayerJersey(pid)} {getPlayerName(pid)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Completed Runs selector for Run Out */}
            {wicketType === 'Run Out' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                  Completed runs on this ball before run out:
                </label>
                <div className="flex gap-2">
                  {([0, 1, 2, 3] as const).map(num => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setRunOutRuns(num)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold text-center transition ${
                        runOutRuns === num
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      {num} {num === 1 ? 'Run' : 'Runs'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWicketModal(false);
                }}
                className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-xs font-bold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWicketSubmit}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white hover:bg-red-600 active:scale-95 transition"
              >
                Confirm Wicket
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Viewer Footer */}
      {!isAdmin && (
        <div className="pt-6 pb-2 text-center text-xs text-neutral-400 font-semibold tracking-wide border-t border-neutral-100/60 mt-6">
          Made with ❤️ Ranjith Ramesh
        </div>
      )}
    </div>
  );
}
