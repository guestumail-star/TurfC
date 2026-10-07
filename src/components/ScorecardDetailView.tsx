import React, { useState } from 'react';
import { Match, Player } from '../types';
import { sr, economy, ovStr } from '../utils/cricket';
import { ChevronLeft, Award, Calendar, Activity, Info, Users, Shield, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';

interface ScorecardDetailViewProps {
  match: Match;
  players: Player[];
  onBack: () => void;
  isAdmin?: boolean;
  onDeleteMatch?: (id: string) => void;
  allMatches?: Match[];
  onContinueSeries?: (seriesId: string, team1Id: string, team2Id: string, totalSeriesMatches: number, tournamentName?: string) => void;
  onEndSeries?: (seriesId: string) => void;
}

export default function ScorecardDetailView({
  match,
  players,
  onBack,
  isAdmin,
  onDeleteMatch,
  allMatches = [],
  onContinueSeries,
  onEndSeries,
}: ScorecardDetailViewProps) {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isTournament = match.matchType === 'tournament' && match.seriesId;
  const seriesMatches = isTournament && allMatches ? allMatches.filter(m => m.seriesId === match.seriesId) : [];
  const completedMatches = seriesMatches.filter(m => m.status === 'complete');
  
  const sortedSeriesMatches = [...seriesMatches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const currentMatchNo = sortedSeriesMatches.findIndex(m => m.id === match.id) + 1;
  const totalSeriesMatches = match.tournamentMatches || 3;

  const getMatchWinnerId = (m: Match) => {
    if (m.status !== 'complete') return null;
    const r1 = m.innings[0].runs;
    const r2 = m.innings[1].runs;
    if (r1 > r2) return m.battingFirstId;
    if (r2 > r1) return m.fieldingFirstId;
    return null;
  };

  let team1Wins = 0;
  let team2Wins = 0;
  let ties = 0;

  completedMatches.forEach(m => {
    const wId = getMatchWinnerId(m);
    if (wId === match.team1Id) team1Wins++;
    else if (wId === match.team2Id) team2Wins++;
    else if (wId === null) ties++;
  });

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

  const getPlayerName = (pid: string) => {
    const p = players.find(x => x.id === pid);
    return p ? p.name : 'Unknown Player';
  };

  const getPlayerJersey = (pid: string) => {
    const p = players.find(x => x.id === pid);
    return p ? p.jerseyNo : '#';
  };

  const getWicketString = (b: typeof innings.batting[0]) => {
    if (b.retiredHurt) return 'Retired Hurt';
    if (!b.out) return 'Not Out';
    if (!b.wicketDetail) return 'Out';

    const { type, bowlerId, helperId } = b.wicketDetail;
    const bowlerName = bowlerId ? getPlayerName(bowlerId) : '';
    const helperName = helperId ? getPlayerName(helperId) : '';

    switch (type) {
      case 'Bowled': return `b ${bowlerName}`;
      case 'Caught':
        if (helperId && helperId === bowlerId) return `c & b ${bowlerName}`;
        return helperId ? `c ${helperName} b ${bowlerName}` : `c & b ${bowlerName}`;
      case 'LBW': return `lbw b ${bowlerName}`;
      case 'Stumped': return helperName ? `st ${helperName} b ${bowlerName}` : `st b ${bowlerName}`;
      case 'Run Out': return helperName ? `run out (${helperName})` : `run out`;
      case 'Hit Wicket': return `hit wicket b ${bowlerName}`;
      case 'Retired': return `retired`;
      default: return 'out';
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    const darkColor = [23, 23, 23];
    const lightGray = [115, 115, 115];
    const matchDate = match.createdAt ? new Date(match.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

    // 1. Calculate Match Highlights & Heroes
    let topBatter = { name: 'N/A', runs: 0, balls: 0, team: 'N/A', fours: 0, sixes: 0 };
    let topBowler = { name: 'N/A', wickets: 0, runs: 0, team: 'N/A', oversStr: '0' };

    match.innings.forEach((inn, idx) => {
      const battingTeam = idx === 0 ? match.battingFirstName : match.fieldingFirstName;
      const bowlingTeam = idx === 0 ? match.fieldingFirstName : match.battingFirstName;

      inn.batting.forEach(b => {
        if (b.runs > topBatter.runs) {
          topBatter = {
            name: getPlayerName(b.pid),
            runs: b.runs,
            balls: b.balls,
            team: battingTeam,
            fours: b.fours,
            sixes: b.sixes
          };
        }
      });

      inn.bowling.forEach(b => {
        if (b.wickets > topBowler.wickets || (b.wickets === topBowler.wickets && b.runs < topBowler.runs)) {
          topBowler = {
            name: getPlayerName(b.pid),
            wickets: b.wickets,
            runs: b.runs,
            team: bowlingTeam,
            oversStr: ovStr(b.overs, b.balls)
          };
        }
      });
    });

    // ==========================================
    // PAGE 1: COVER & MATCH HIGHLIGHTS
    // ==========================================

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('TURF CRICKET MATCH REPORT', 105, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text('GENERATED BY TURF CRICS ENGINE', 105, 28, { align: 'center' });

    let y = 55;

    // Match Teams Heading
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${match.team1Name} vs ${match.team2Name}`, 15, y);

    // Meta details row
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.text(`Date: ${matchDate}   |   Match Type: ${match.matchType === 'tournament' ? 'Tournament' : 'Single Match'}   |   Overs: ${match.totalOvers}`, 15, y + 6);

    y += 16;

    // Match Result Banner
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(209, 250, 229);
    doc.roundedRect(15, y, 180, 15, 2, 2, 'FD');
    
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Result: ${match.result || 'Match In Progress / Saved'}`, 22, y + 9.5);

    y += 26;

    // SECTION: MATCH HIGHLIGHTS (Bento styled cards)
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('MATCH HEROES', 15, y);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y + 3, 195, y + 3);

    y += 8;

    // Top Batter Card (Left half)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 86, 45, 2, 2, 'FD');

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OUTSTANDING BATSMAN', 20, y + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text(topBatter.name !== 'N/A' ? topBatter.name : 'No Innings Yet', 20, y + 17);

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(11);
    doc.text(`${topBatter.runs} Runs from ${topBatter.balls} balls`, 20, y + 25);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Team: ${topBatter.team}  |  4s: ${topBatter.fours}  6s: ${topBatter.sixes}`, 20, y + 32);
    if (topBatter.balls > 0) {
      doc.text(`Strike Rate: ${sr(topBatter.runs, topBatter.balls)}`, 20, y + 38);
    }

    // Top Bowler Card (Right half)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(109, y, 86, 45, 2, 2, 'FD');

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OUTSTANDING BOWLER', 114, y + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text(topBowler.name !== 'N/A' ? topBowler.name : 'No Innings Yet', 114, y + 17);

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(11);
    doc.text(`${topBowler.wickets} Wkts for ${topBowler.runs} Runs`, 114, y + 25);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Team: ${topBowler.team}  |  Overs: ${topBowler.oversStr}`, 114, y + 32);
    const econVal = topBowler.name !== 'N/A' ? economy(topBowler.runs, 0, Math.round(parseFloat(topBowler.oversStr) * 6)) : '0.00';
    doc.text(`Economy Rate: ${econVal}`, 114, y + 38);

    y += 56;

    // SECTION: QUICK INNINGS OVERVIEW
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('QUICK INNINGS OVERVIEW', 15, y);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y + 3, 195, y + 3);

    y += 9;

    const inn1 = match.innings[0];
    const inn1OversStr = ovStr(inn1.overs, inn1.balls);
    const inn1TotalBalls = inn1.overs * 6 + inn1.balls;
    const inn1Rr = inn1TotalBalls > 0 ? ((inn1.runs / inn1TotalBalls) * 6).toFixed(2) : '0.00';

    // Innings 1 block
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, y, 180, 22, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 180, 22, 2, 2, 'D');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`1st Innings: ${match.battingFirstName}`, 20, y + 8);
    
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(12);
    doc.text(`${inn1.runs}/${inn1.wickets}`, 185, y + 9, { align: 'right' });

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Overs: ${inn1OversStr} (${match.totalOvers} max)   |   Run Rate: ${inn1Rr}   |   Extras: ${inn1.extras.wide + inn1.extras.noBall + inn1.extras.bye + inn1.extras.legBye}`, 20, y + 16);

    y += 28;

    const inn2 = match.innings[1];
    const hasInn2 = inn2 && inn2.batting.length > 0;

    if (hasInn2) {
      const inn2OversStr = ovStr(inn2.overs, inn2.balls);
      const inn2TotalBalls = inn2.overs * 6 + inn2.balls;
      const inn2Rr = inn2TotalBalls > 0 ? ((inn2.runs / inn2TotalBalls) * 6).toFixed(2) : '0.00';

      // Innings 2 block
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, y, 180, 22, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, y, 180, 22, 2, 2, 'D');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`2nd Innings: ${match.fieldingFirstName}`, 20, y + 8);
      
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(12);
      doc.text(`${inn2.runs}/${inn2.wickets}`, 185, y + 9, { align: 'right' });

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Overs: ${inn2OversStr} (${match.totalOvers} max)   |   Run Rate: ${inn2Rr}   |   Extras: ${inn2.extras.wide + inn2.extras.noBall + inn2.extras.bye + inn2.extras.legBye}`, 20, y + 16);
    } else {
      // No 2nd innings played
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(15, y, 180, 22, 2, 2, 'F');
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(15, y, 180, 22, 2, 2, 'D');

      doc.setTextColor(146, 64, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('2nd Innings: Not played or incomplete', 20, y + 13);
    }

    // Running Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Turf Cricket Stats  |  Page 1 of 3', 105, 285, { align: 'center' });

    // ==========================================
    // PAGE 2: FIRST INNINGS DETAILED SCORECARD
    // ==========================================
    doc.addPage();

    // Top Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`FIRST INNINGS SCORECARD: ${match.battingFirstName.toUpperCase()}`, 15, 16);

    y = 35;

    // Batting Card Title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Batting Performance', 15, y);
    y += 5;

    // Batting Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(15, y, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text('Batter', 18, y + 4.5);
    doc.text('Dismissal Status', 68, y + 4.5);
    doc.text('R', 135, y + 4.5, { align: 'right' });
    doc.text('B', 148, y + 4.5, { align: 'right' });
    doc.text('4s', 160, y + 4.5, { align: 'right' });
    doc.text('6s', 172, y + 4.5, { align: 'right' });
    doc.text('S/R', 190, y + 4.5, { align: 'right' });

    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

    inn1.batting.forEach((b) => {
      doc.setDrawColor(240, 240, 240);
      doc.line(15, y + 6, 195, y + 6);
      
      doc.setFont('helvetica', 'bold');
      doc.text(getPlayerName(b.pid), 18, y + 4);
      
      doc.setFont('helvetica', 'normal');
      doc.text(getWicketString(b), 68, y + 4);
      
      doc.text(b.runs.toString(), 135, y + 4, { align: 'right' });
      doc.text(b.balls.toString(), 148, y + 4, { align: 'right' });
      doc.text(b.fours.toString(), 160, y + 4, { align: 'right' });
      doc.text(b.sixes.toString(), 172, y + 4, { align: 'right' });
      doc.text(sr(b.runs, b.balls), 190, y + 4, { align: 'right' });
      
      y += 6.5;
    });

    // Extras & Totals row
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, 180, 9, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);
    doc.line(15, y + 9, 195, y + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const inn1ExtrasTotal = inn1.extras.wide + inn1.extras.noBall + inn1.extras.bye + inn1.extras.legBye;
    doc.text(`Extras: ${inn1ExtrasTotal} (Wd ${inn1.extras.wide}, Nb ${inn1.extras.noBall}, B ${inn1.extras.bye}, Lb ${inn1.extras.legBye})`, 18, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL: ${inn1.runs}/${inn1.wickets}  (${inn1OversStr} Ov)`, 190, y + 6, { align: 'right' });

    y += 18;

    // Bowling Section Header
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text('Bowling Performance', 15, y);
    y += 5;

    // Bowling Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(15, y, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text('Bowler', 18, y + 4.5);
    doc.text('Overs', 100, y + 4.5, { align: 'right' });
    doc.text('Runs', 125, y + 4.5, { align: 'right' });
    doc.text('Wickets', 150, y + 4.5, { align: 'right' });
    doc.text('Econ', 180, y + 4.5, { align: 'right' });

    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

    if (inn1.bowling.length > 0) {
      inn1.bowling.forEach((b) => {
        doc.setDrawColor(240, 240, 240);
        doc.line(15, y + 6, 195, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(getPlayerName(b.pid), 18, y + 4);

        doc.setFont('helvetica', 'normal');
        doc.text(ovStr(b.overs, b.balls), 100, y + 4, { align: 'right' });
        doc.text(b.runs.toString(), 125, y + 4, { align: 'right' });
        doc.text(b.wickets.toString(), 150, y + 4, { align: 'right' });
        doc.text(economy(b.runs, b.overs, b.balls), 180, y + 4, { align: 'right' });

        y += 6.5;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text('No bowling stats recorded.', 18, y + 5);
      y += 8;
    }

    // Running Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Turf Cricket Stats  |  Page 2 of 3', 105, 285, { align: 'center' });

    // ==========================================
    // PAGE 3: SECOND INNINGS DETAILED SCORECARD
    // ==========================================
    doc.addPage();

    // Top Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`SECOND INNINGS SCORECARD: ${match.fieldingFirstName.toUpperCase()}`, 15, 16);

    y = 35;

    if (hasInn2) {
      // Batting Card Title
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Batting Performance', 15, y);
      y += 5;

      // Batting Table Header
      doc.setFillColor(30, 41, 59);
      doc.rect(15, y, 180, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.text('Batter', 18, y + 4.5);
      doc.text('Dismissal Status', 68, y + 4.5);
      doc.text('R', 135, y + 4.5, { align: 'right' });
      doc.text('B', 148, y + 4.5, { align: 'right' });
      doc.text('4s', 160, y + 4.5, { align: 'right' });
      doc.text('6s', 172, y + 4.5, { align: 'right' });
      doc.text('S/R', 190, y + 4.5, { align: 'right' });

      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      inn2.batting.forEach((b) => {
        doc.setDrawColor(240, 240, 240);
        doc.line(15, y + 6, 195, y + 6);
        
        doc.setFont('helvetica', 'bold');
        doc.text(getPlayerName(b.pid), 18, y + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.text(getWicketString(b), 68, y + 4);
        
        doc.text(b.runs.toString(), 135, y + 4, { align: 'right' });
        doc.text(b.balls.toString(), 148, y + 4, { align: 'right' });
        doc.text(b.fours.toString(), 160, y + 4, { align: 'right' });
        doc.text(b.sixes.toString(), 172, y + 4, { align: 'right' });
        doc.text(sr(b.runs, b.balls), 190, y + 4, { align: 'right' });
        
        y += 6.5;
      });

      // Extras & Totals row
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 9, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, 195, y);
      doc.line(15, y + 9, 195, y + 9);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const inn2ExtrasTotal = inn2.extras.wide + inn2.extras.noBall + inn2.extras.bye + inn2.extras.legBye;
      doc.text(`Extras: ${inn2ExtrasTotal} (Wd ${inn2.extras.wide}, Nb ${inn2.extras.noBall}, B ${inn2.extras.bye}, Lb ${inn2.extras.legBye})`, 18, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const inn2OversStr = ovStr(inn2.overs, inn2.balls);
      doc.text(`TOTAL: ${inn2.runs}/${inn2.wickets}  (${inn2OversStr} Ov)`, 190, y + 6, { align: 'right' });

      y += 18;

      // Bowling Section Header
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.text('Bowling Performance', 15, y);
      y += 5;

      // Bowling Table Header
      doc.setFillColor(30, 41, 59);
      doc.rect(15, y, 180, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.text('Bowler', 18, y + 4.5);
      doc.text('Overs', 100, y + 4.5, { align: 'right' });
      doc.text('Runs', 125, y + 4.5, { align: 'right' });
      doc.text('Wickets', 150, y + 4.5, { align: 'right' });
      doc.text('Econ', 180, y + 4.5, { align: 'right' });

      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      if (inn2.bowling.length > 0) {
        inn2.bowling.forEach((b) => {
          doc.setDrawColor(240, 240, 240);
          doc.line(15, y + 6, 195, y + 6);

          doc.setFont('helvetica', 'bold');
          doc.text(getPlayerName(b.pid), 18, y + 4);

          doc.setFont('helvetica', 'normal');
          doc.text(ovStr(b.overs, b.balls), 100, y + 4, { align: 'right' });
          doc.text(b.runs.toString(), 125, y + 4, { align: 'right' });
          doc.text(b.wickets.toString(), 150, y + 4, { align: 'right' });
          doc.text(economy(b.runs, b.overs, b.balls), 180, y + 4, { align: 'right' });

          y += 6.5;
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.text('No bowling stats recorded.', 18, y + 5);
        y += 8;
      }
    } else {
      // Friendly message explaining no second innings
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(15, y, 180, 40, 3, 3, 'F');
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(15, y, 180, 40, 3, 3, 'D');

      doc.setTextColor(146, 64, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Second Innings Not Played Yet', 22, y + 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(180, 83, 9);
      doc.text('This match was saved or ended before the second innings could be started.', 22, y + 24);
      doc.text('Detailed scorecard details for the second innings will appear once the match is completed.', 22, y + 30);
    }

    // Running Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Turf Cricket Stats  |  Page 3 of 3', 105, 285, { align: 'center' });

    // Save PDF
    const filename = `${match.team1Name}_vs_${match.team2Name}_Scorecard.pdf`.replace(/\s+/g, '_');
    doc.save(filename);
  };

  const renderWicketText = (b: typeof innings.batting[0]) => {
    if (b.retiredHurt) {
      return <span className="text-amber-600 font-bold">Retired Hurt</span>;
    }
    if (!b.out) {
      return <span className="text-emerald-600 font-extrabold">Not Out *</span>;
    }
    if (!b.wicketDetail) {
      return <span className="text-red-500 font-bold">Out</span>;
    }

    const { type, bowlerId, helperId } = b.wicketDetail;
    const bowlerName = bowlerId ? getPlayerName(bowlerId) : '';
    const helperName = helperId ? getPlayerName(helperId) : '';

    let text = '';
    switch (type) {
      case 'Bowled':
        text = `b ${bowlerName}`;
        break;
      case 'Caught':
        if (helperId && helperId === bowlerId) {
          text = `c & b ${bowlerName}`;
        } else if (helperId) {
          text = `c ${helperName} b ${bowlerName}`;
        } else {
          text = `c & b ${bowlerName}`;
        }
        break;
      case 'LBW':
        text = `lbw b ${bowlerName}`;
        break;
      case 'Stumped':
        text = helperName ? `st ${helperName} b ${bowlerName}` : `st b ${bowlerName}`;
        break;
      case 'Run Out':
        text = helperName ? `run out (${helperName})` : `run out`;
        break;
      case 'Hit Wicket':
        text = `hit wicket b ${bowlerName}`;
        break;
      case 'Retired':
        text = `retired`;
        break;
      default:
        text = 'out';
    }

    return <span className="text-neutral-500 font-semibold">{text}</span>;
  };

  const innings = match.innings[activeTab];
  const battingTeamName = activeTab === 0 ? match.battingFirstName : match.fieldingFirstName;
  const bowlingTeamName = activeTab === 0 ? match.fieldingFirstName : match.battingFirstName;

  const totalExtras =
    innings.extras.wide + innings.extras.noBall + innings.extras.bye + innings.extras.legBye;

  return (
    <div id="scorecard-detail-view" className="space-y-4">
      {/* Back and Export Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition"
        >
          <ChevronLeft size={16} />
          Back to Archives
        </button>

        <div className="flex items-center gap-2">
          {isAdmin && onDeleteMatch && (
            <div className="flex items-center gap-1.5">
              {isConfirmingDelete ? (
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 p-1 border border-red-200 shadow-xs animate-fadeIn">
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-wider px-1.5">Confirm Delete?</span>
                  <button
                    onClick={() => {
                      onDeleteMatch(match.id);
                      setIsConfirmingDelete(false);
                    }}
                    className="rounded-lg bg-red-600 hover:bg-red-700 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs transition"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(false)}
                    className="rounded-lg bg-neutral-200 hover:bg-neutral-300 px-2.5 py-1 text-[10px] font-bold text-neutral-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 transition px-3.5 py-1.5 text-xs font-black text-red-600 border border-red-200 shadow-xs"
                  title="Delete Match"
                >
                  <Trash2 size={13} />
                  Delete Match
                </button>
              )}
            </div>
          )}

          <button
            onClick={downloadPDF}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition px-3.5 py-1.5 text-xs font-black text-white shadow-sm"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* Match Banner Card */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-xs">
        <div className="text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Completed Scorecard
          </span>
          <h2 className="mt-2 text-xl font-black text-neutral-900">
            {match.team1Name} <span className="text-neutral-400 font-semibold mx-1">VS</span> {match.team2Name}
          </h2>

          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 border border-emerald-100 text-sm font-black text-emerald-800">
            <Award size={16} className="text-emerald-600" />
            {match.result}
          </div>
        </div>

        {/* Quick Innings score preview */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
          <div className={`p-3 rounded-2xl border text-center ${activeTab === 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-neutral-100 bg-neutral-50/50'}`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{match.battingFirstName}</span>
            <div className="text-xl font-black text-neutral-900 mt-1">
              {match.innings[0].runs}/{match.innings[0].wickets}
            </div>
            <span className="text-xs text-neutral-500 font-mono">({ovStr(match.innings[0].overs, match.innings[0].balls)} ov)</span>
          </div>
          <div className={`p-3 rounded-2xl border text-center ${activeTab === 1 ? 'border-emerald-200 bg-emerald-50/40' : 'border-neutral-100 bg-neutral-50/50'}`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{match.fieldingFirstName}</span>
            <div className="text-xl font-black text-neutral-900 mt-1">
              {match.innings[1].runs}/{match.innings[1].wickets}
            </div>
            <span className="text-xs text-neutral-500 font-mono">({ovStr(match.innings[1].overs, match.innings[1].balls)} ov)</span>
          </div>
        </div>
      </div>

      {/* Tournament / Series Section */}
      {isTournament && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/20 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-800">
              🏆 Tournament: {match.tournamentName || 'Championship Series'}
            </span>
            <span className="text-xs font-black text-neutral-700">{standingText}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Series Match Results</span>
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

            <div className="flex flex-col justify-center gap-2">
              {isAdmin && !isSeriesFinished && onContinueSeries && (
                <button
                  onClick={() => onContinueSeries(match.seriesId!, match.team1Id, match.team2Id, totalSeriesMatches, match.tournamentName)}
                  className="w-full rounded-2xl bg-emerald-600 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Start Match {sortedSeriesMatches.length + 1} of Series
                </button>
              )}

              {isAdmin && !isSeriesFinished && onEndSeries && (
                <button
                  onClick={() => onEndSeries(match.seriesId!)}
                  className="w-full rounded-2xl bg-amber-600 py-2.5 text-xs font-black text-white transition hover:bg-amber-700 active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
                >
                  End Series Early / Complete
                </button>
              )}

              {isSeriesFinished && (
                <div className="rounded-xl bg-neutral-100 p-2.5 text-center text-xs font-black text-neutral-500">
                  🏆 This Series has finished.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scorecard Tabs */}
      <div className="flex rounded-xl bg-neutral-100 p-1">
        <button
          onClick={() => setActiveTab(0)}
          className={`flex-1 rounded-lg py-2 text-xs font-black transition-all ${
            activeTab === 0 ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          {match.battingFirstName} Innings
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`flex-1 rounded-lg py-2 text-xs font-black transition-all ${
            activeTab === 1 ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          {match.fieldingFirstName} Innings
        </button>
      </div>

      {/* Innings Card Content */}
      <div className="space-y-4">
        {/* Batting Scorecard Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
          <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Batting Card</h3>
          </div>
          <div className="grid grid-cols-[1fr_40px_40px_30px_30px_50px] border-b border-neutral-100 bg-neutral-50/50 px-4 py-2 text-right text-[10px] font-black uppercase tracking-wider text-neutral-400">
            <div className="text-left">Batter</div>
            <div>R</div>
            <div>B</div>
            <div>4s</div>
            <div>6s</div>
            <div>S/R</div>
          </div>

          <div className="divide-y divide-neutral-100">
            {innings.batting.map(b => (
              <div
                key={b.pid}
                className="grid grid-cols-[1fr_40px_40px_30px_30px_50px] items-center px-4 py-3 text-right text-sm text-neutral-700"
              >
                <div className="text-left min-w-0">
                  <div className="font-bold text-neutral-900 truncate">
                    {getPlayerName(b.pid)}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 mt-0.5 leading-none">
                    {renderWicketText(b)}
                  </div>
                </div>
                <div className="font-mono font-black text-neutral-900">{b.runs}</div>
                <div className="font-mono text-neutral-500">{b.balls}</div>
                <div className="font-mono text-neutral-500">{b.fours}</div>
                <div className="font-mono text-neutral-500">{b.sixes}</div>
                <div className="font-mono font-bold text-neutral-500">{sr(b.runs, b.balls)}</div>
              </div>
            ))}
          </div>

          {/* Extras and Totals Footer */}
          <div className="bg-neutral-50/60 p-4 border-t border-neutral-100 text-xs text-neutral-600 space-y-1">
            <div className="flex justify-between">
              <span>Extras</span>
              <span className="font-mono font-bold text-neutral-800">
                {totalExtras} <span className="font-normal text-neutral-400">(Wd {innings.extras.wide}, Nb {innings.extras.noBall}, B {innings.extras.bye}, Lb {innings.extras.legBye})</span>
              </span>
            </div>
            <div className="flex justify-between border-t border-neutral-200/50 pt-1.5 font-bold text-sm text-neutral-900">
              <span>Total</span>
              <span className="font-mono font-black text-emerald-600">
                {innings.runs}/{innings.wickets}{' '}
                <span className="text-xs font-normal text-neutral-400">({ovStr(innings.overs, innings.balls)} overs)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bowling Scorecard Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
          <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Bowling Card</h3>
          </div>
          <div className="grid grid-cols-[1fr_45px_40px_35px_45px] border-b border-neutral-100 bg-neutral-50/50 px-4 py-2 text-right text-[10px] font-black uppercase tracking-wider text-neutral-400">
            <div className="text-left">Bowler</div>
            <div>Overs</div>
            <div>Runs</div>
            <div>Wkt</div>
            <div>Econ</div>
          </div>

          <div className="divide-y divide-neutral-100">
            {innings.bowling.map(b => (
              <div
                key={b.pid}
                className="grid grid-cols-[1fr_45px_40px_35px_45px] items-center px-4 py-3 text-right text-sm text-neutral-700"
              >
                <div className="text-left font-bold text-neutral-900 truncate">
                  {getPlayerName(b.pid)}
                </div>
                <div className="font-mono text-neutral-500 font-semibold">{ovStr(b.overs, b.balls)}</div>
                <div className="font-mono text-neutral-500 font-semibold">{b.runs}</div>
                <div className="font-mono font-black text-emerald-600">{b.wickets}</div>
                <div className="font-mono font-bold text-neutral-500">
                  {economy(b.runs, b.overs, b.balls)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Viewer Footer */}
      {!isAdmin && (
        <div className="pt-6 pb-2 text-center text-xs text-neutral-400 font-semibold tracking-wide border-t border-neutral-100/60 mt-6">
          Made with ❤️ Ranjith Ramesh
        </div>
      )}
    </div>
  );
}
