import React, { useMemo } from 'react';
import NotificationsBell from '../Notifications/NotificationsBell';
import MessagesBell from '../Messages/MessagesBell';
import { getStoredRewardData } from '../../utils/rewardStorage';

export default function MarketplaceTopNav() {
  const rewards = useMemo(() => getStoredRewardData(), []);
  const xp = rewards.xpBalance ?? 0;
  const rankLabel = rewards.rankLabel ?? 'Seedling';
  const avatarUrl = useMemo(() => {
    return localStorage.getItem('cto_user_avatar_url') || localStorage.getItem('profile_avatar_url') || '';
  }, []);

  return (
    <div className="w-full border-b border-white/5 bg-black/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button className="h-9 w-9 rounded-full bg-white/5 text-white">≡</button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-pink-500/20" />
            <span className="text-sm font-semibold">Marketplace</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
            <span>Discover</span>
            <span>Marketplace</span>
            <span>Forum</span>
            <span>Earn</span>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>{xp} XP</span>
          <span className="hidden rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300 md:inline-flex">
            {rankLabel}
          </span>
          <div className="flex items-center gap-2">
            <MessagesBell />
            <NotificationsBell />
            <button className="h-9 w-9 rounded-xl bg-white/5" />
          </div>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-9 w-9 rounded-full object-cover border border-white/10"
            />
          ) : (
            <button className="h-9 w-9 rounded-full bg-white/10" />
          )}
        </div>
      </div>
    </div>
  );
}
