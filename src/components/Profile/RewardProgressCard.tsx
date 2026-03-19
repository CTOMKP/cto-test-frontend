import React from 'react';
import { RewardProgress } from '../../types/auth.types';

interface RewardProgressCardProps {
  rewards: Partial<RewardProgress>;
  className?: string;
}

export const RewardProgressCard: React.FC<RewardProgressCardProps> = ({ rewards, className = '' }) => {
  const xpBalance = rewards.xpBalance ?? 0;
  const rankLevel = rewards.rankLevel ?? rewards.rankTier ?? 1;
  const rankLabel = rewards.rankLabel ?? 'Seedling';
  const rankEmoji = rewards.rankEmoji ?? '🌱';
  const currentStreakDays = rewards.currentStreakDays ?? 0;
  const progressPercent = Math.max(0, Math.min(100, rewards.progressPercent ?? 0));
  const nextRankLabel = rewards.nextRankLabel ?? null;
  const rankScoreToNext = rewards.rankScoreToNext ?? 0;
  const daysToNext = rewards.daysToNext ?? 0;
  const rankScore = rewards.rankScore ?? 0;
  const progressLabel = Number.isInteger(progressPercent)
    ? `${progressPercent}%`
    : `${progressPercent.toFixed(1)}%`;
  const streakLabel = `${currentStreakDays} day${currentStreakDays === 1 ? '' : 's'}`;
  const timeGateLabel = `${daysToNext} day${daysToNext === 1 ? '' : 's'}`;

  return (
    <div className={`rounded-2xl border border-white/10 bg-zinc-950/80 p-6 text-white shadow-lg ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Rewards</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Level {rankLevel} - {rankLabel}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {rankEmoji} Rank tier from backend reputation rules
          </p>
        </div>
        <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-300">
          {xpBalance} XP
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
          <span>Rank Progress</span>
          <span>{progressLabel}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 via-amber-400 to-lime-400 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {nextRankLabel && (
          <p className="mt-2 text-xs text-zinc-400">
            {rankScore} RS earned toward {nextRankLabel}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current Streak</p>
          <p className="mt-2 text-xl font-semibold">{streakLabel}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">To Next Rank</p>
          <p className="mt-2 text-xl font-semibold">{rankScoreToNext} RS</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Time Gate</p>
          <p className="mt-2 text-xl font-semibold">{timeGateLabel}</p>
        </div>
      </div>

      {nextRankLabel && (
        <p className="mt-5 text-sm text-zinc-400">
          Next tier: <span className="font-medium text-zinc-200">{nextRankLabel}</span>
        </p>
      )}
    </div>
  );
};

export default RewardProgressCard;
