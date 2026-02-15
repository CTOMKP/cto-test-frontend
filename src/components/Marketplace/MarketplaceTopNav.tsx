import React, { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import notificationsService from '../../services/notificationsService';
import { getBackendUrl } from '../../utils/apiConfig';

export default function MarketplaceTopNav() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const backendUrl = getBackendUrl();
  const xp = useMemo(() => {
    const raw = localStorage.getItem('cto_user_xp');
    return raw ? Number(raw) : 0;
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;

  const loadNotifications = async () => {
    try {
      const res = await notificationsService.list();
      setItems(res?.items || []);
    } catch {
      // best-effort
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) return;
    const socket: Socket = io(`${backendUrl}/ws`, {
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      socket.emit('notifications.subscribe', { token });
    });
    socket.on('notifications.new', (payload: any) => {
      setItems((prev) => [payload, ...prev]);
    });
    return () => {
      socket.disconnect();
    };
  }, [backendUrl]);

  const handleClickNotification = async (n: any) => {
    try {
      if (!n.readAt) {
        await notificationsService.markRead(n.id);
      }
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      alert(`${n.title}${n.body ? `\n\n${n.body}` : ''}`);
    } catch {
      // ignore
    }
  };

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
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="h-9 w-9 rounded-xl bg-white/5"
                aria-label="Notifications"
              />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] text-white">
                  {unreadCount}
                </span>
              )}
              {open && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/10 bg-black/90 p-2 text-xs shadow-xl">
                  <div className="px-2 py-1 text-zinc-400">Notifications</div>
                  {items.length === 0 && (
                    <div className="px-2 py-3 text-zinc-500">No notifications</div>
                  )}
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleClickNotification(n)}
                      className={`w-full rounded-xl px-2 py-2 text-left ${
                        n.readAt ? 'text-zinc-400' : 'text-white'
                      } hover:bg-white/5`}
                    >
                      <div className="text-sm">{n.title}</div>
                      {n.body && <div className="text-[11px] text-zinc-500">{n.body}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="h-9 w-9 rounded-xl bg-white/5" />
            <button className="h-9 w-9 rounded-xl bg-white/5" />
          </div>
          <button className="h-9 w-9 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}
