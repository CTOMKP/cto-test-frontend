import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from '../../utils/apiConfig';
import messagesBadgeService from '../../services/messagesBadgeService';

export default function MessagesBell({
  buttonClassName = 'flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white',
  iconClassName = 'h-4 w-4',
}: {
  buttonClassName?: string;
  iconClassName?: string;
}) {
  const [unread, setUnread] = useState(0);
  const backendUrl = getBackendUrl();

  const load = async () => {
    try {
      const res: any = await messagesBadgeService.listThreads();
      const items = res?.items || res || [];
      if (items.length > 0) {
        const total = items.reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0);
        setUnread(total);
      }
    } catch {
      // best-effort
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
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
    socket.on('messages.new', () => {
      setUnread((prev) => prev + 1);
      load();
    });
    return () => {
      socket.disconnect();
    };
  }, [backendUrl]);

  return (
    <div className="relative">
      <a
        href="/messages"
        className={buttonClassName}
        aria-label="Messages"
        title="Messages"
      >
        <svg viewBox="0 0 24 24" className={iconClassName} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v12H6l-2 2V4z" />
        </svg>
      </a>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] text-white">
          {unread}
        </span>
      )}
    </div>
  );
}
