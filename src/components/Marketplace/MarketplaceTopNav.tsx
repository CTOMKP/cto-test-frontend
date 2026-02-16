import React, { useMemo } from 'react';
import NotificationsBell from '../Notifications/NotificationsBell';
import MessagesBell from '../Messages/MessagesBell';

export default function MarketplaceTopNav() {
  const xp = useMemo(() => {
    const raw = localStorage.getItem('cto_user_xp');
    return raw ? Number(raw) : 0;
  }, []);
  const avatarUrl = useMemo(() => {
    return localStorage.getItem('cto_user_avatar_url') || localStorage.getItem('profile_avatar_url') || '';
  }, []);

  return (
    <div className="w-full border-b border-white/5 bg-black/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button className="h-9 w-9 rounded-full bg-white/5 text-white">???</button>
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
          <span>{xp} ????</span>
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
