import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import notificationsService from '../../services/notificationsService';
import { getBackendUrl } from '../../utils/apiConfig';

export default function NotificationsBell({
  buttonClassName = 'h-9 w-9 rounded-xl bg-white/5 text-white',
  iconClassName = 'mx-auto h-4 w-4',
}: {
  buttonClassName?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cto_auth_token'));
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backendUrl = getBackendUrl();
  const navigate = useNavigate();

  const getNotificationRoute = (n: any): string | null => {
    if (!n) return null;

    let data: any = n.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }

    if (typeof data?.redirectPath === 'string' && data.redirectPath.startsWith('/')) {
      return data.redirectPath;
    }

    if (n.type === 'LISTING_APPROVAL' && data?.listingId) {
      const isRejected =
        data?.status === 'REJECTED' ||
        data?.action === 'VIEW_REJECTED_LISTING' ||
        typeof data?.reason === 'string' ||
        /rejected/i.test(String(n?.title || ''));

      if (isRejected) {
        return `/user-listings/${data.listingId}`;
      }
      return `/user-listings/${data.listingId}/live`;
    }

    if (n.type === 'AD_APPROVAL' && data?.adId) {
      return `/marketplace/ads/${data.adId}`;
    }

    return null;
  };

  const loadNotifications = async () => {
    try {
      const res = await notificationsService.list();
      const nextItems = res?.items || [];
      setItems(nextItems);
      setUnreadCount(nextItems.filter((n: any) => !n.readAt).length);
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
    if (token) loadNotifications();
  }, [token]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cto_auth_token') {
        setToken(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    const interval = setInterval(() => {
      const next = localStorage.getItem('cto_auth_token');
      if (next !== token) setToken(next);
    }, 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
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
  }, [backendUrl, token]);

  useEffect(() => {
    const handler = () => {
      if (token) loadNotifications();
    };
    window.addEventListener('cto-notifications-ping', handler as EventListener);
    return () => window.removeEventListener('cto-notifications-ping', handler as EventListener);
  }, [token]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const unreadItems = useMemo(() => items.filter((n: any) => !n.readAt), [items]);

  const notificationSubtitle = (n: any): string | null => {
    if (n?.body) return n.body;

    let data: any = n?.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }

    if (n?.type === 'LISTING_APPROVAL') {
      const isRejected =
        data?.status === 'REJECTED' ||
        data?.action === 'VIEW_REJECTED_LISTING' ||
        typeof data?.reason === 'string' ||
        /rejected/i.test(String(n?.title || ''));
      return isRejected
        ? 'Click to view rejection feedback.'
        : 'Click to view your approved listing.';
    }

    return null;
  };

  const handleClickNotification = async (n: any) => {
    try {
      if (!n.readAt) {
        await notificationsService.markRead(n.id);
      }
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
      const route = getNotificationRoute(n);
      if (route) {
        setOpen(false);
        navigate(route);
        return;
      }
      alert(`${n.title}${n.body ? `\n\n${n.body}` : ''}`);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadItems.length || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await notificationsService.markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (busyNotificationId) return;
    setBusyNotificationId(id);
    try {
      await notificationsService.deleteNotification(id);
      setItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        setUnreadCount(next.filter((item: any) => !item.readAt).length);
        return next;
      });
    } catch {
      // ignore
    } finally {
      setBusyNotificationId(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          if (!open) loadNotifications();
          setOpen((v) => !v);
        }}
        className={buttonClassName}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" className={iconClassName} fill="none" stroke="currentColor" strokeWidth="2">
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
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-black/90 p-2 text-xs shadow-xl">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <div className="text-zinc-400">Notifications</div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!unreadItems.length || isMarkingAll}
              className="text-[11px] text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-2 py-3 text-zinc-500">No notifications</div>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`mb-1 flex items-start gap-2 rounded-xl px-2 py-2 ${
                  n.readAt ? 'text-zinc-400' : 'text-white'
                } hover:bg-white/5`}
              >
                <button
                  onClick={() => handleClickNotification(n)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm">{n.title}</div>
                  {notificationSubtitle(n) && (
                    <div className="text-[11px] text-zinc-500">
                      {notificationSubtitle(n)}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(n.id);
                  }}
                  disabled={busyNotificationId === n.id}
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                  title="Delete notification"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
