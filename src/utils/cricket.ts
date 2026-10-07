import { Match, Player, Team, InningsSnapshot, Innings } from '../types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function ovStr(overs: number, balls: number): string {
  return `${overs}.${balls}`;
}

export function rr(runs: number, overs: number, balls: number): string {
  const b = overs * 6 + balls;
  return b ? ((runs / b) * 6).toFixed(2) : '0.00';
}

export function sr(runs: number, balls: number): string {
  return balls ? ((runs / balls) * 100).toFixed(0) : '0';
}

export function economy(runs: number, overs: number, balls: number): string {
  const b = overs * 6 + balls;
  return b ? ((runs / b) * 6).toFixed(2) : '0.00';
}

export interface CalculatedStats {
  matches: number;
  runs: number;
  balls: number;
  wickets: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  hs: number;
  avg: string;
  sr: string;
}

export function getPlayerStats(playerId: string, matches: Match[]): CalculatedStats {
  let runs = 0;
  let balls = 0;
  let wickets = 0;
  let fifties = 0;
  let hundreds = 0;
  let fours = 0;
  let sixes = 0;
  let playedCount = 0;
  let hs = 0;
  let timesOut = 0;

  matches.forEach(m => {
    let playedThisMatch = false;
    m.innings.forEach(inn => {
      const bat = inn.batting.find(b => b.pid === playerId);
      const bowl = inn.bowling.find(b => b.pid === playerId);

      if (bat) {
        playedThisMatch = true;
        runs += bat.runs;
        balls += bat.balls;
        fours += bat.fours || 0;
        sixes += bat.sixes || 0;
        if (bat.runs > hs) {
          hs = bat.runs;
        }
        if (bat.runs >= 100) {
          hundreds++;
        } else if (bat.runs >= 50) {
          fifties++;
        }
        if (bat.out) {
          timesOut++;
        }
      }

      if (bowl) {
        playedThisMatch = true;
        wickets += bowl.wickets;
      }
    });

    if (playedThisMatch) {
      playedCount++;
    }
  });

  const avg = timesOut > 0 ? (runs / timesOut).toFixed(1) : (runs > 0 ? `${runs}.0` : '—');
  const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '—';

  return {
    matches: playedCount,
    runs,
    balls,
    wickets,
    fifties,
    hundreds,
    fours,
    sixes,
    hs,
    avg,
    sr: strikeRate,
  };
}

export function deliverBall(
  match: Match,
  outcome: string,
  teams: Team[],
  wicketDetail?: {
    type: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired';
    bowlerId?: string;
    helperId?: string;
    outPlayerId?: string;
    runOutRuns?: number;
  }
): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const innIdx = m.currentInnings - 1;
  const inn = m.innings[innIdx];
  const { striker, nonStriker, bowler } = inn;

  const strIdx = inn.batting.findIndex(b => b.pid === striker);
  const bowIdx = inn.bowling.findIndex(b => b.pid === bowler);

  if (strIdx === -1 || bowIdx === -1) {
    return m;
  }

  const bat = inn.batting[strIdx];
  const bowl = inn.bowling[bowIdx];

  // Save undo snapshot
  const { history, ...snap } = inn;
  if (!inn.history) {
    inn.history = [];
  }
  inn.history.push(JSON.parse(JSON.stringify(snap)));
  if (inn.history.length > 50) {
    inn.history.shift();
  }

  let isLegal = true;

  if (outcome === 'W') {
    const outPlayerId = wicketDetail?.outPlayerId || striker || '';
    const outIdx = inn.batting.findIndex(b => b.pid === outPlayerId);
    if (outIdx !== -1) {
      inn.batting[outIdx].out = true;
      inn.batting[outIdx].wicketDetail = {
        type: wicketDetail?.type || 'Bowled',
        bowlerId: wicketDetail?.bowlerId || bowler || undefined,
        helperId: wicketDetail?.helperId || undefined,
        runOutRuns: wicketDetail?.runOutRuns || undefined,
      };
    } else if (outPlayerId) {
      inn.batting.push({
        pid: outPlayerId,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: true,
        wicketDetail: {
          type: wicketDetail?.type || 'Bowled',
          bowlerId: wicketDetail?.bowlerId || bowler || undefined,
          helperId: wicketDetail?.helperId || undefined,
          runOutRuns: wicketDetail?.runOutRuns || undefined,
        }
      });
    }

    bat.balls++;
    inn.wickets++;
    if (!wicketDetail || (wicketDetail.type !== 'Run Out' && wicketDetail.type !== 'Retired')) {
      bowl.wickets++;
    }

    // Handle completed runout runs
    const roRuns = (wicketDetail?.type === 'Run Out' && wicketDetail?.runOutRuns) ? wicketDetail.runOutRuns : 0;
    if (roRuns > 0) {
      inn.runs += roRuns;
      bat.runs += roRuns;
      bowl.runs += roRuns;
      if (roRuns % 2 !== 0 && nonStriker) {
        inn.striker = nonStriker;
        inn.nonStriker = striker;
      }
    }

    const overBallValue = roRuns > 0 ? `${roRuns}+W` : 'W';
    inn.currentOver.push(overBallValue);
  } else if (outcome === 'Wd') {
    inn.runs++;
    inn.extras.wide++;
    bowl.runs++;
    isLegal = false;
    inn.currentOver.push('Wd');
  } else if (outcome === 'Nb') {
    inn.runs++;
    inn.extras.noBall++;
    bowl.runs++;
    isLegal = false;
    inn.currentOver.push('Nb');
  } else {
    const r = Number(outcome);
    bat.runs += r;
    bat.balls++;
    if (r === 4) bat.fours = (bat.fours || 0) + 1;
    if (r === 6) bat.sixes = (bat.sixes || 0) + 1;
    inn.runs += r;
    bowl.runs += r;

    if (r % 2 !== 0 && nonStriker) {
      inn.striker = nonStriker;
      inn.nonStriker = striker;
    }
    inn.currentOver.push(String(r));
  }

  if (isLegal) {
    inn.balls++;
    bowl.balls++;

    if (bowl.balls >= 6) {
      bowl.overs++;
      bowl.balls = 0;
    }

    if (inn.balls % 6 === 0 && inn.balls > 0) {
      const ovRuns = inn.currentOver.reduce((s, b) => {
        if (b === 'Wd' || b === 'Nb') return s + 1;
        if (b === 'W') return s;
        if (b.includes('+W')) {
          const r = Number(b.split('+W')[0]);
          return s + (isNaN(r) ? 0 : r);
        }
        if (b.includes('W+')) {
          const r = Number(b.split('W+')[1]);
          return s + (isNaN(r) ? 0 : r);
        }
        const parsed = Number(b);
        return s + (isNaN(parsed) ? 0 : parsed);
      }, 0);

      if (ovRuns === 0) {
        bowl.maidens++;
      }

      inn.overHistory.push([...inn.currentOver]);
      inn.currentOver = [];
      inn.overs++;
      inn.balls = 0;

      // Swap batsmen at the end of the over if both exist
      if (inn.striker && inn.nonStriker) {
        const tmp = inn.striker;
        inn.striker = inn.nonStriker;
        inn.nonStriker = tmp;
      }
      inn.bowler = null; // Bowler must change
    }
  }

  if (outcome === 'W') {
    const batTeamId = innIdx === 0 ? m.battingFirstId : m.fieldingFirstId;
    const batTeamObj = teams.find(t => t.id === batTeamId);
    const rosterIds = batTeamObj?.playerIds || [];
    const outPids = inn.batting.filter(b => b.out).map(b => b.pid);
    const rh = inn.retiredHurt || [];
    const remaining = rosterIds.filter(
      pid => ![...outPids, ...rh].includes(pid) && pid !== nonStriker && pid !== striker
    );

    const outPlayerId = wicketDetail?.outPlayerId || striker;
    const wasStriker = (outPlayerId === inn.striker);

    if (wasStriker) {
      inn.striker = null;
    } else {
      inn.nonStriker = null;
    }

    if (remaining.length === 0) {
      if (wasStriker) {
        if (inn.nonStriker) {
          inn.striker = inn.nonStriker;
          inn.nonStriker = null;
        } else {
          inn.striker = null;
        }
      } else {
        inn.nonStriker = null;
      }
    }
  }

  const batTeamIdForCheck = innIdx === 0 ? m.battingFirstId : m.fieldingFirstId;
  const batTeamObjForCheck = teams.find(t => t.id === batTeamIdForCheck);
  const rosterIdsForCheck = batTeamObjForCheck?.playerIds || [];
  const outPidsForCheck = inn.batting.filter(b => b.out).map(b => b.pid);
  const rhForCheck = inn.retiredHurt || [];
  const remainingForCheck = rosterIdsForCheck.filter(
    pid => ![...outPidsForCheck, ...rhForCheck].includes(pid) && pid !== inn.nonStriker && pid !== inn.striker
  );

  const totalBalls = m.totalOvers * 6;
  const legalBalls = inn.overs * 6 + inn.balls;
  const chased = m.currentInnings === 2 && inn.runs > m.innings[0].runs;

  const lastPlayerSolo = m.lastPlayerSolo ?? true;
  let allOut = false;
  if (lastPlayerSolo) {
    allOut = inn.striker === null && inn.nonStriker === null && remainingForCheck.length === 0;
  } else {
    const activeFieldersCount = [inn.striker, inn.nonStriker].filter(Boolean).length;
    allOut = (activeFieldersCount + remainingForCheck.length) < 2;
  }

  const oversUp = legalBalls >= totalBalls;

  if (oversUp || allOut || chased) {
    if (m.currentInnings === 1) {
      m.currentInnings = 2;
      m.innings[1].striker = null;
      m.innings[1].nonStriker = null;
      m.innings[1].bowler = null;
    } else {
      m.status = 'complete';
      m.completedAt = new Date().toISOString();
      const s1 = m.innings[0].runs;
      const s2 = m.innings[1].runs;
      const bf = m.battingFirstName;
      const bs = bf === m.team1Name ? m.team2Name : m.team1Name;

      if (chased) {
        const totalPossibleWickets = rosterIdsForCheck.length > 0
          ? (lastPlayerSolo ? rosterIdsForCheck.length : Math.max(1, rosterIdsForCheck.length - 1))
          : 10;
        const w = Math.max(0, totalPossibleWickets - inn.wickets);
        m.result = `${bs} won by ${w} wicket${w !== 1 ? 's' : ''}`;
      } else if (s1 > s2) {
        const r = s1 - s2;
        m.result = `${bf} won by ${r} run${r !== 1 ? 's' : ''}`;
      } else if (s1 === s2) {
        m.result = 'Match tied!';
      } else {
        const totalPossibleWickets = rosterIdsForCheck.length > 0
          ? (lastPlayerSolo ? rosterIdsForCheck.length : Math.max(1, rosterIdsForCheck.length - 1))
          : 10;
        const w = Math.max(0, totalPossibleWickets - inn.wickets);
        m.result = `${bs} won by ${w} wicket${w !== 1 ? 's' : ''}`;
      }
    }
  }

  return m;
}

export function undoLastBall(match: Match): Match | null {
  const m: Match = JSON.parse(JSON.stringify(match));
  const innIdx = m.currentInnings - 1;
  const inn = m.innings[innIdx];

  if (!inn.history || !inn.history.length) {
    return null;
  }

  const lastSnapshot = inn.history.pop();
  if (lastSnapshot) {
    m.innings[innIdx] = {
      ...lastSnapshot,
      history: inn.history,
    };
  }
  return m;
}

export function swapBatsmen(match: Match): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const inn = m.innings[m.currentInnings - 1];
  const tmp = inn.striker;
  inn.striker = inn.nonStriker;
  inn.nonStriker = tmp;
  return m;
}

export function retireHurt(match: Match, pid: string, teams: Team[]): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const innIdx = m.currentInnings - 1;
  const inn = m.innings[innIdx];

  if (!inn.retiredHurt) {
    inn.retiredHurt = [];
  }
  inn.retiredHurt.push(pid);

  const bat = inn.batting.find(b => b.pid === pid);
  if (bat) {
    bat.retiredHurt = true;
  }

  const striker = inn.striker;
  const nonStriker = inn.nonStriker;

  if (inn.striker === pid) {
    inn.striker = null;
  }
  if (inn.nonStriker === pid) {
    inn.nonStriker = null;
  }

  const batTeamId = innIdx === 0 ? m.battingFirstId : m.fieldingFirstId;
  const batTeamObj = teams.find(t => t.id === batTeamId);
  const rosterIds = batTeamObj?.playerIds || [];
  const outPids = inn.batting.filter(b => b.out).map(b => b.pid);
  const rh = inn.retiredHurt || [];
  const remaining = rosterIds.filter(
    id => ![...outPids, ...rh].includes(id) && id !== inn.nonStriker && id !== inn.striker
  );

  if (remaining.length === 0) {
    if (pid === striker && nonStriker) {
      inn.striker = nonStriker;
      inn.nonStriker = null;
    }
  }

  return m;
}

export function selectStriker(match: Match, pid: string): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const inn = m.innings[m.currentInnings - 1];

  if (!inn.batting.find(b => b.pid === pid)) {
    inn.batting.push({
      pid,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      retiredHurt: false,
    });
  }
  inn.striker = pid;
  return m;
}

export function selectNonStriker(match: Match, pid: string): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const inn = m.innings[m.currentInnings - 1];

  if (!inn.batting.find(b => b.pid === pid)) {
    inn.batting.push({
      pid,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      retiredHurt: false,
    });
  }
  inn.nonStriker = pid;
  return m;
}

export function selectBowler(match: Match, pid: string): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const inn = m.innings[m.currentInnings - 1];
  const oldBowlerId = inn.bowler;

  if (!inn.bowling.find(b => b.pid === pid)) {
    inn.bowling.push({
      pid,
      overs: 0,
      balls: 0,
      runs: 0,
      wickets: 0,
      maidens: 0,
    });
  }

  // If there was an old bowler, and they have bowled 0 overs and 0 balls in this innings,
  // we can clean them up from the bowling list!
  if (oldBowlerId && oldBowlerId !== pid) {
    const oldBowlIdx = inn.bowling.findIndex(b => b.pid === oldBowlerId);
    if (oldBowlIdx !== -1) {
      const oldBowl = inn.bowling[oldBowlIdx];
      if (oldBowl.overs === 0 && oldBowl.balls === 0) {
        inn.bowling.splice(oldBowlIdx, 1);
      }
    }
  }

  inn.bowler = pid;
  return m;
}

export function replaceBatsman(match: Match, type: 'striker' | 'nonStriker', newPid: string): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  const inn = m.innings[m.currentInnings - 1];
  const oldPid = type === 'striker' ? inn.striker : inn.nonStriker;

  // Set the new batsman
  if (type === 'striker') {
    inn.striker = newPid;
  } else {
    inn.nonStriker = newPid;
  }

  // Add new player to batting list if not exists
  if (!inn.batting.find(b => b.pid === newPid)) {
    inn.batting.push({
      pid: newPid,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      retiredHurt: false,
    });
  }

  // If old player had 0 runs and 0 balls, clean them up from the batting list
  if (oldPid) {
    const oldBatIdx = inn.batting.findIndex(b => b.pid === oldPid);
    if (oldBatIdx !== -1) {
      const oldBat = inn.batting[oldBatIdx];
      if (oldBat.runs === 0 && oldBat.balls === 0) {
        inn.batting.splice(oldBatIdx, 1);
      }
    }
  }

  return m;
}

export function endMatchManual(match: Match): Match {
  const m: Match = JSON.parse(JSON.stringify(match));
  m.status = 'complete';
  m.completedAt = new Date().toISOString();
  
  const s1 = m.innings[0].runs;
  const s2 = m.innings[1]?.runs || 0;
  const bf = m.battingFirstName;
  const bs = bf === m.team1Name ? m.team2Name : m.team1Name;
  
  if (m.currentInnings === 1) {
    m.result = `Match ended manually. ${bf} scored ${s1} runs.`;
  } else {
    if (s2 > s1) {
      m.result = `${bs} won by ${s2 - s1} runs (Ended Manually)`;
    } else if (s1 > s2) {
      m.result = `${bf} won by ${s1 - s2} runs (Ended Manually)`;
    } else {
      m.result = `Match tied at ${s1} runs (Ended Manually)`;
    }
  }
  return m;
}

