import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import notificationsService from '../../services/notificationsService';
import { getBackendUrl } from '../../utils/apiConfig';

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const backendUrl = getBackendUrl();

  const loadNotifications = async () => {
    try {
      const res = await notificationsService.list();
      const nextItems = res?.items || [];
      if (nextItems.length > 0) {
        setItems(nextItems);
        setUnreadCount(nextItems.filter((n: any) => !n.readAt).length);
      }
    } catch {
      // best-effort
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) return;
    const socket: Socket = io(`${backendUrl}/ws`, {
      transports: ['polling', 'websocket'],
    });
    socket.on('connect', () => {
      socket.emit('notifications.subscribe', { token });
    });
    socket.on('connect_error', () => {
      // fallback to polling only; list is already polled
    });
    socket.on('notifications.new', (payload: any) => {
      const activeConvoId = localStorage.getItem('cto_active_conversation_id');
      const isMessagesPage = window.location.pathname.startsWith('/messages');
      const isSameConvo =
        payload?.type === 'MESSAGE' && payload?.data?.conversationId && payload.data.conversationId === activeConvoId;
      if (isMessagesPage && isSameConvo) {
        return;
      }
      setItems((prev) => [payload, ...prev]);
      setUnreadCount((prev) => prev + 1);
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
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
      alert(`${n.title}${n.body ? `\n\n${n.body}` : ''}`);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!open) loadNotifications();
          setOpen((v) => !v);
        }}
        className="h-9 w-9 rounded-xl bg-white/5 text-white"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
      </button>
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
  );
}
