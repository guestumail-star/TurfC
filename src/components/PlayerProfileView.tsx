import React from 'react';
import { Player, Match } from '../types';
import { getPlayerStats, sr } from '../utils/cricket';
import { ChevronLeft, Award, Activity, Shield, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';

interface PlayerProfileViewProps {
  playerId: string;
  players: Player[];
  matches: Match[];
  onBack: () => void;
}

export default function PlayerProfileView({
  playerId,
  players,
  matches,
  onBack,
}: PlayerProfileViewProps) {
  const player = players.find(p => p.id === playerId);
  if (!player) return null;

  const stats = getPlayerStats(playerId, matches);

  // Extract recent innings batted
  const recentInnings: { opponent: string; runs: number; balls: number; out: boolean; date: string }[] = [];

  matches.forEach(m => {
    m.innings.forEach((inn, idx) => {
      const bat = inn.batting.find(b => b.pid === playerId);
      if (bat) {
        const opponent = idx === 0 ? m.fieldingFirstName : m.battingFirstName;
        recentInnings.push({
          opponent,
          runs: bat.runs,
          balls: bat.balls,
          out: bat.out,
          date: m.completedAt || m.createdAt,
        });
      }
    });
  });

  // Reverse list to show recent first
  const reversedInnings = [...recentInnings].reverse().slice(0, 6);

  const downloadPlayerPDF = () => {
    const doc = new jsPDF();
    
    const darkColor = [23, 23, 23];
    const lightGray = [115, 115, 115];
    
    // Header Banner Style
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 45, 'F');
    
    // App branding & Player header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(player.name.toUpperCase(), 15, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text(`JERSEY #${player.jerseyNo || 'N/A'}  |  ROLE: ${player.role.toUpperCase()}`, 15, 26);
    
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text('TURF CRICS PLAYER PERFORMANCE PROFILE', 15, 36);
    
    let y = 55;

    const pageHeight = 297;
    const bottomMargin = 20;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = 25; // standard top margin for new page
        
        // Nice running header
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`${player.name} - Career Profile (Continued)`, 15, 12);
        doc.setDrawColor(230, 230, 230);
        doc.line(15, 15, 195, 15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      }
    };
    
    // Summary Banner
    checkPageBreak(15);
    doc.setFillColor(244, 244, 245);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CAREER STATISTICS', 18, y + 5.5);
    
    y += 14;

    // Career Stats Grid
    const statsList = [
      { label: 'Matches Played', val: stats.matches.toString() },
      { label: 'Total Runs Scored', val: stats.runs.toString() },
      { label: 'Highest Score (HS)', val: stats.hs.toString() },
      { label: 'Batting Average (Avg)', val: stats.avg.toString() },
      { label: 'Strike Rate (S/R)', val: stats.sr.toString() },
      { label: 'Wickets Taken', val: stats.wickets.toString() },
      { label: 'Fours (4s)', val: stats.fours.toString() },
      { label: 'Sixes (6s)', val: stats.sixes.toString() },
      { label: 'Fifties (50s)', val: stats.fifties.toString() },
      { label: 'Hundreds (100s)', val: stats.hundreds.toString() },
    ];

    // Grid layout in PDF
    const statsHeight = Math.ceil(statsList.length / 2) * 8 + 10;
    checkPageBreak(statsHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    
    statsList.forEach((s, idx) => {
      const col = idx % 2; // 0 or 1
      const xPos = col === 0 ? 18 : 110;
      const yPos = y + Math.floor(idx / 2) * 8;
      
      // Draw standard line/row
      doc.setDrawColor(240, 240, 240);
      doc.line(xPos, yPos + 6, xPos + 80, yPos + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text(s.label, xPos, yPos + 4);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(s.val, xPos + 78, yPos + 4, { align: 'right' });
    });

    y += statsHeight;

    // Recent Innings Section
    checkPageBreak(15);
    doc.setFillColor(244, 244, 245);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RECENT INNINGS LOG', 18, y + 5.5);
    
    y += 14;

    if (reversedInnings.length > 0) {
      // Table Header row for Innings
      checkPageBreak(15);
      doc.setFillColor(30, 41, 59);
      doc.rect(15, y, 180, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Opponent', 18, y + 4.5);
      doc.text('Date', 70, y + 4.5);
      doc.text('Runs', 120, y + 4.5, { align: 'right' });
      doc.text('Balls', 145, y + 4.5, { align: 'right' });
      doc.text('S/R', 180, y + 4.5, { align: 'right' });

      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      reversedInnings.forEach((inn) => {
        checkPageBreak(12);
        doc.setDrawColor(240, 240, 240);
        doc.line(15, y + 6, 195, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(`vs ${inn.opponent}`, 18, y + 4);

        doc.setFont('helvetica', 'normal');
        const innDate = inn.date ? new Date(inn.date).toLocaleDateString() : 'N/A';
        doc.text(innDate, 70, y + 4);

        const runsText = `${inn.runs}${inn.out ? '' : '*'}`;
        doc.setFont('helvetica', 'bold');
        doc.text(runsText, 120, y + 4, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.text(inn.balls.toString(), 145, y + 4, { align: 'right' });
        doc.text(sr(inn.runs, inn.balls), 180, y + 4, { align: 'right' });

        y += 7;
      });
    } else {
      checkPageBreak(12);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text('No recent batting logs available for this player.', 18, y + 4);
    }

    // Save PDF
    const filename = `${player.name}_Stats_Report.pdf`.replace(/\s+/g, '_');
    doc.save(filename);
  };

  return (
    <div id="player-profile-view" className="space-y-5">
      {/* Back Button & Download PDF Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition"
        >
          <ChevronLeft size={16} />
          Back to Players
        </button>

        <button
          onClick={downloadPlayerPDF}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition px-3.5 py-1.5 text-xs font-black text-white shadow-sm"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Stats PDF
        </button>
      </div>

      {/* Main Profile Info Card */}
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-xs text-center">
        {/* Giant Jersey emblem */}
        <div className="mx-auto flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60 leading-none">Jersey</span>
          <span className="text-2xl font-black mt-1 leading-none">{player.jerseyNo || '#'}</span>
        </div>

        <h2 className="mt-4 text-2xl font-black text-neutral-900 leading-tight">
          {player.name}
        </h2>
        <div className="mt-1 flex items-center justify-center gap-2 text-xs text-neutral-400 font-semibold uppercase tracking-wider">
          <span>{player.role}</span>
          {player.age && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-200"></span>
              <span>Age {player.age}</span>
            </>
          )}
        </div>
      </div>

      {/* Career Stats Bento Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Career Statistics</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            { label: 'Matches', val: stats.matches },
            { label: 'Runs Scored', val: stats.runs },
            { label: 'Highest Score', val: stats.hs },
            { label: 'Average', val: stats.avg },
            { label: 'Strike Rate', val: stats.sr },
            { label: 'Wickets', val: stats.wickets, highlight: 'text-emerald-600' },
            { label: 'Fours', val: stats.fours },
            { label: 'Sixes', val: stats.sixes },
            { label: 'Fifties (50s)', val: stats.fifties },
            { label: 'Hundreds (100s)', val: stats.hundreds },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-neutral-200/60 bg-white p-3.5 text-center transition hover:border-neutral-300"
            >
              <div className={`text-xl font-black ${s.highlight || 'text-neutral-900'}`}>{s.val}</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Innings Log */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Recent Innings</h3>

        {reversedInnings.length > 0 ? (
          <div className="grid gap-2">
            {reversedInnings.map((inn, index) => {
              const isFifty = inn.runs >= 50;
              const isThirty = inn.runs >= 30 && inn.runs < 50;
              const colorClass = isFifty
                ? 'text-emerald-600'
                : isThirty
                ? 'text-amber-600'
                : 'text-neutral-900';

              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide">
                      vs {inn.opponent}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-medium font-mono mt-0.5">
                      {inn.balls} balls · S/R {sr(inn.runs, inn.balls)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-xl font-black ${colorClass}`}>
                      {inn.runs}
                      {!inn.out && <span className="text-sm font-semibold ml-0.5">*</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-xs text-neutral-400 italic">
            No batting logs available for this player.
          </div>
        )}
      </div>
    </div>
  );
}
