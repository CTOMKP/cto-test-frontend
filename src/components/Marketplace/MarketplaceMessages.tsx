import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import messagesService from '../../services/messagesService';
import escrowService from '../../services/escrowService';
import { getBackendUrl } from '../../utils/apiConfig';
import MarketplaceTopNav from './MarketplaceTopNav';
import { usePrivyAuth } from '../../services/privyAuthService';
import { getMovementWallet, sendMovementTransaction } from '../../lib/movement-wallet';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import paymentService from '../../services/paymentService';

const backendUrl = getBackendUrl();

type Thread = {
  id: string;
  type?: 'GENERAL' | 'MARKETPLACE';
  ad?: any;
  posterId: number;
  applicantId: number;
  isArchived?: boolean;
  poster?: {
    id: number;
    name?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  };
  applicant?: {
    id: number;
    name?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  updatedAt?: string;
};

type InboxFilter = 'GENERAL' | 'MARKETPLACE' | 'ARCHIVED';

type UserSearchResult = {
  id: number;
  name?: string | null;
  avatarUrl?: string | null;
};

const mergeMessageLists = (current: any[] = [], incoming: any[] = []) => {
  const merged = new Map<string, any>();
  [...current, ...incoming].forEach((message, index) => {
    if (!message) return;
    const key = message.id
      ? String(message.id)
      : String(message.senderId || 'unknown') + ':' + String(message.createdAt || '') + ':' + String(message.content || message.body || index);
    merged.set(key, { ...(merged.get(key) || {}), ...message });
  });
  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = Date.parse(left?.createdAt || '') || 0;
    const rightTime = Date.parse(right?.createdAt || '') || 0;
    return leftTime - rightTime;
  });
};

export default function MarketplaceMessages() {
  const { threadId, profileUserId } = useParams();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [escrowModalOpen, setEscrowModalOpen] = useState(false);
  const [escrowViewOpen, setEscrowViewOpen] = useState(false);
  const [currentEscrow, setCurrentEscrow] = useState<any>(null);
  const [showEscrowProposed, setShowEscrowProposed] = useState(false);
  const [polling, setPolling] = useState(false);
  const [profileAvatarError, setProfileAvatarError] = useState(false);
  const [messageAvatarErrors, setMessageAvatarErrors] = useState<Record<string, boolean>>({});
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('MARKETPLACE');
  const [generalUserQuery, setGeneralUserQuery] = useState('');
  const [generalUserResults, setGeneralUserResults] = useState<UserSearchResult[]>([]);
  const [selectedGeneralUser, setSelectedGeneralUser] = useState<UserSearchResult | null>(null);
  const [searchingGeneralUsers, setSearchingGeneralUsers] = useState(false);
  const [generalInitialMessage, setGeneralInitialMessage] = useState('');
  const [creatingGeneral, setCreatingGeneral] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const threadCacheRef = useRef<Record<InboxFilter, Thread[]>>({
    MARKETPLACE: [],
    GENERAL: [],
    ARCHIVED: [],
  });
  const messageCacheRef = useRef<Map<string, any[]>>(new Map());
  const activeThreadRef = useRef<Thread | null>(null);
  const isMarketplaceConversationRef = useRef(true);

  const userId = Number(localStorage.getItem('cto_user_id') || 0);
  const isMarketplaceConversation = activeThread?.type !== 'GENERAL';

  useEffect(() => {
    activeThreadRef.current = activeThread;
    isMarketplaceConversationRef.current = isMarketplaceConversation;
  }, [activeThread, isMarketplaceConversation]);

  const mergeConversationMessages = useCallback((conversationId: string, incoming: any[]) => {
    const merged = mergeMessageLists(messageCacheRef.current.get(conversationId) || [], incoming);
    messageCacheRef.current.set(conversationId, merged);
    if (activeThreadRef.current?.id === conversationId) {
      setMessages(merged);
    }
    return merged;
  }, []);

  const updateConversationReaction = useCallback((conversationId: string, messageId: string, reactions: any[]) => {
    const updated = (messageCacheRef.current.get(conversationId) || []).map((message) =>
      message.id === messageId ? { ...message, reactions } : message,
    );
    messageCacheRef.current.set(conversationId, updated);
    if (activeThreadRef.current?.id === conversationId) {
      setMessages(updated);
    }
  }, []);

  const changeInboxFilter = (nextFilter: InboxFilter) => {
    if (nextFilter === inboxFilter) return;
    if (threadId) navigate('/messages');
    const cachedThreads = threadCacheRef.current[nextFilter] || [];
    const cachedActiveThread = cachedThreads[0] || null;
    setInboxFilter(nextFilter);
    setThreads(cachedThreads);
    setActiveThread(cachedActiveThread);
    activeThreadRef.current = cachedActiveThread;
    setMessages(cachedActiveThread ? messageCacheRef.current.get(cachedActiveThread.id) || [] : []);
    setLoadingThreads(true);
  };

  const selectThread = (thread: Thread) => {
    setActiveThread(thread);
    activeThreadRef.current = thread;
    setMessages(messageCacheRef.current.get(thread.id) || []);
  };

  useEffect(() => {
    const query = generalUserQuery.trim();
    if (inboxFilter !== 'GENERAL' || selectedGeneralUser || query.length < 2) {
      setGeneralUserResults([]);
      setSearchingGeneralUsers(false);
      return;
    }

    let active = true;
    setSearchingGeneralUsers(true);
    const timeout = window.setTimeout(() => {
      messagesService
        .searchUsers(query)
        .then((response: any) => {
          if (!active) return;
          setGeneralUserResults(response?.items || response || []);
        })
        .catch((error: any) => {
          if (!active) return;
          setGeneralUserResults([]);
          if (error?.response?.status !== 400) {
            toast.error(error?.response?.data?.message || 'Unable to search users');
          }
        })
        .finally(() => {
          if (active) setSearchingGeneralUsers(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [generalUserQuery, inboxFilter, selectedGeneralUser]);

  useEffect(() => {
    let mounted = true;
    setLoadingThreads(true);
    messagesService
      .listThreads(
        inboxFilter === 'ARCHIVED'
          ? { archived: true }
          : { type: inboxFilter, archived: false }
      )
      .then((res: any) => {
        if (!mounted) return;
        const items = res?.items || res || [];
        threadCacheRef.current[inboxFilter] = items;
        setThreads(items);
        if (threadId) {
          const match = items.find((t: Thread) => t.id === threadId);
          if (match) {
            setActiveThread(match);
          } else {
            messagesService.getThread(threadId).then((res: any) => {
              if (!mounted) return;
              const conversation = res?.conversation || res?.thread || res;
              if (conversation?.id) {
                setActiveThread(conversation);
                if (conversation.isArchived) setInboxFilter('ARCHIVED');
                else setInboxFilter(conversation.type === 'GENERAL' ? 'GENERAL' : 'MARKETPLACE');
              }
            }).catch(() => null);
          }
        } else if (items[0]) {
          setActiveThread(items[0]);
        } else {
          setActiveThread(null);
          setMessages([]);
        }
      })
      .finally(() => {
        if (mounted) setLoadingThreads(false);
      });
    return () => {
      mounted = false;
    };
  }, [threadId, inboxFilter]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        setPolling(true);
        const res = await messagesService.listThreads(
          inboxFilter === 'ARCHIVED'
            ? { archived: true }
            : { type: inboxFilter, archived: false }
        );
        if (!alive) return;
        const items = res?.items || res || [];
        threadCacheRef.current[inboxFilter] = items;
        setThreads(items);
      } catch {
        // ignore
      } finally {
        if (alive) setPolling(false);
      }
    };
    const interval = setInterval(poll, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [inboxFilter]);

  useEffect(() => {
    if (!activeThread) {
      setMessages([]);
      return;
    }
    const conversationId = activeThread.id;
    let alive = true;
    activeThreadRef.current = activeThread;
    localStorage.setItem('cto_active_conversation_id', conversationId);
    setMessages(messageCacheRef.current.get(conversationId) || []);
    setLoadingMessages(true);
    messagesService
      .getThread(conversationId)
      .then((res: any) => {
        if (!alive || activeThreadRef.current?.id !== conversationId) return;
        const convo = res?.conversation || res?.thread || res;
        if (convo?.id) {
          setActiveThread((prev) => prev?.id === conversationId ? { ...prev, ...convo } : prev);
        }
        mergeConversationMessages(conversationId, res?.messages || []);
        messagesService.markRead(conversationId).catch(() => null);
      })
      .finally(() => {
        if (alive && activeThreadRef.current?.id === conversationId) setLoadingMessages(false);
      });
    return () => {
      alive = false;
    };
  }, [activeThread?.id, mergeConversationMessages]);

  useEffect(() => {
    if (!activeThread || !isMarketplaceConversation) {
      setCurrentEscrow(null);
      return;
    }
    let alive = true;
    setCurrentEscrow(null);
    escrowService
      .getLatestByConversation(activeThread.id)
      .then((res: any) => {
        if (!alive) return;
        setCurrentEscrow(res?.escrow || res);
      })
      .catch(() => {
        if (!alive) return;
        setCurrentEscrow(null);
      });
    return () => {
      alive = false;
    };
  }, [activeThread?.id, isMarketplaceConversation]);

  useEffect(() => {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) return;
    const socket: Socket = io(backendUrl + '/ws', {
      transports: ['websocket', 'polling'],
    });
    let mounted = true;
    const refreshActiveEscrow = () => {
      const currentThread = activeThreadRef.current;
      if (!currentThread || !isMarketplaceConversationRef.current) return;
      escrowService.getLatestByConversation(currentThread.id).then((res: any) => {
        if (!mounted) return;
        setCurrentEscrow(res?.escrow || res);
      }).catch(() => {
        if (!mounted) return;
        setCurrentEscrow(null);
      });
    };
    socket.on('connect', () => {
      socket.emit('notifications.subscribe', { token });
    });
    socket.on('messages.new', (payload: any) => {
      if (!payload?.conversationId || !payload?.message) return;
      mergeConversationMessages(payload.conversationId, [payload.message]);
    });
    socket.on('messages.reaction', (payload: any) => {
      if (!payload?.conversationId || !payload?.messageId) return;
      updateConversationReaction(payload.conversationId, payload.messageId, payload.reactions || []);
    });
    socket.on('notifications.new', (payload: any) => {
      if (!mounted || payload?.type !== 'ESCROW') return;
      const convoId = payload?.data?.conversationId;
      const currentThread = activeThreadRef.current;
      if (currentThread && (!convoId || convoId === currentThread.id)) refreshActiveEscrow();
    });
    socket.on('escrow.update', (payload: any) => {
      const currentThread = activeThreadRef.current;
      if (!payload?.escrowId || !currentThread) return;
      const convoId = payload?.conversationId;
      if (convoId && convoId !== currentThread.id) return;
      refreshActiveEscrow();
    });
    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [mergeConversationMessages, updateConversationReaction]);

  const isPoster = useMemo(() => {
    if (!activeThread) return false;
    return activeThread.posterId === userId;
  }, [activeThread, userId]);

  const selectedProfileId = profileUserId ? Number(profileUserId) : null;

  const otherUser = useMemo(() => {
    if (!activeThread) return null;
    return isPoster ? activeThread.applicant : activeThread.poster;
  }, [activeThread, isPoster]);

  const withAvatarCache = (url?: string | null, cacheValue?: string | number) => {
    if (!url) return '';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheValue || Date.now()}`;
  };

  const posterAvatarSrc = useMemo(() => {
    const fallback = activeThread?.ad?.user?.avatarUrl || '';
    const base = activeThread?.poster?.avatarUrl || fallback;
    return withAvatarCache(base, activeThread?.poster?.id || activeThread?.updatedAt || '');
  }, [activeThread?.poster?.avatarUrl, activeThread?.poster?.id, activeThread?.ad?.user?.avatarUrl, activeThread?.updatedAt]);

  const applicantAvatarSrc = useMemo(() => {
    const base = activeThread?.applicant?.avatarUrl || '';
    return withAvatarCache(base, activeThread?.applicant?.id || activeThread?.updatedAt || '');
  }, [activeThread?.applicant?.avatarUrl, activeThread?.applicant?.id, activeThread?.updatedAt]);

  const getThreadUser = (id?: number | null) => {
    if (!activeThread || !id) return null;
    if (id === activeThread.posterId) return activeThread.poster;
    if (id === activeThread.applicantId) return activeThread.applicant;
    return null;
  };

  const profileAvatarSrc = useMemo(() => {
    const selectedUser = selectedProfileId ? getThreadUser(selectedProfileId) : otherUser;
    const fallback = selectedProfileId === activeThread?.posterId ? posterAvatarSrc : applicantAvatarSrc;
    const raw = selectedUser?.avatarUrl || fallback;
    return raw ? withAvatarCache(raw, activeThread?.updatedAt || selectedUser?.id || '') : '';
  }, [
    selectedProfileId,
    activeThread?.posterId,
    activeThread?.updatedAt,
    otherUser?.avatarUrl,
    otherUser?.id,
    posterAvatarSrc,
    applicantAvatarSrc,
  ]);

  const getMessageAvatarSrc = (senderId: number) => {
    if (!activeThread) return '';
    if (senderId === activeThread.posterId) return posterAvatarSrc;
    if (senderId === activeThread.applicantId) return applicantAvatarSrc;
    return '';
  };

  const selectedProfileUser = useMemo(() => {
    if (!activeThread || !selectedProfileId) return otherUser;
    return getThreadUser(selectedProfileId) || otherUser;
  }, [activeThread, selectedProfileId, otherUser]);

  const selectedProfileRole = useMemo(() => {
    if (!activeThread || !selectedProfileId) return isPoster ? 'Applicant' : 'Poster';
    return selectedProfileId === activeThread.posterId ? 'Poster' : 'Applicant';
  }, [activeThread, selectedProfileId, isPoster]);

  const renderMessageBody = (body: string) => {
    const text = String(body || '');
    const segments = text.split(/(https?:\/\/[^\s]+)/g);
    return segments.map((segment, idx) => {
      if (/^https?:\/\/[^\s]+$/i.test(segment)) {
        return (
          <a
            key={`${segment}-${idx}`}
            href={segment}
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-600"
            onClick={(e) => e.stopPropagation()}
          >
            {segment}
          </a>
        );
      }
      return <span key={`${idx}-${segment}`}>{segment}</span>;
    });
  };

  useEffect(() => {
    setProfileAvatarError(false);
  }, [selectedProfileUser?.id, profileAvatarSrc]);

  useEffect(() => {
    setMessageAvatarErrors({});
  }, [activeThread?.id, posterAvatarSrc, applicantAvatarSrc]);

  const handleSend = async () => {
    if (!activeThread || !input.trim()) return;
    const res = await messagesService.sendMessage(activeThread.id, input.trim());
    const msg = res?.message || res;
    mergeConversationMessages(activeThread.id, [msg]);
    setInput('');
  };

  const uploadAttachmentViaPresign = async (file: File) => {
    const token = localStorage.getItem('cto_auth_token');
    const response = await fetch(`${backendUrl}/api/v1/images/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        type: 'generic',
        userId: String(userId || ''),
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to request upload URL');
    }
    const payload: any = await response.json();
    const data = payload?.data?.data || payload?.data || payload;
    const uploadUrl = data?.uploadUrl;
    const key = data?.key;
    if (!uploadUrl || !key) {
      throw new Error('Invalid upload response');
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed with status ${putRes.status}`);
    }
    return `${backendUrl}/api/v1/images/view/${key}`;
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!activeThread || files.length === 0) return;
    try {
      setUploadingAttachment(true);
      for (const file of files) {
        const viewUrl = await uploadAttachmentViaPresign(file);
        const body = `Attachment: ${file.name}\n${viewUrl}`;
        const res = await messagesService.sendMessage(activeThread.id, body);
        const msg = res?.message || res;
        mergeConversationMessages(activeThread.id, [msg]);
      }
      toast.success(files.length > 1 ? 'Attachments sent' : 'Attachment sent');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleOpenUserProfile = (senderId: number) => {
    if (!activeThread) return;

    const normalizedSenderId = Number(senderId);
    if (!Number.isFinite(normalizedSenderId) || normalizedSenderId <= 0) return;

    if (normalizedSenderId === userId) {
      navigate('/profile');
      return;
    }

    navigate(`/messages/${activeThread.id}/profile/${normalizedSenderId}`);
  };

  const emojiList = [
    '\uD83D\uDE00', '\uD83D\uDE01', '\uD83D\uDE02', '\uD83E\uDD23', '\uD83D\uDE0A',
    '\uD83D\uDE0D', '\uD83D\uDE18', '\uD83D\uDE0E', '\uD83E\uDD14', '\uD83D\uDE05',
    '\uD83D\uDE42', '\uD83D\uDE07', '\uD83D\uDE09', '\uD83D\uDE0C', '\uD83D\uDE1C',
    '\uD83D\uDC4D', '\uD83D\uDC4E', '\uD83D\uDE4C', '\uD83D\uDD25', '\u2764\uFE0F',
  ];

  const groupReactions = (reactions: any[] = []) => {
    const map = new Map<string, { emoji: string; count: number }>();
    reactions.forEach((r) => {
      const key = r.emoji;
      const prev = map.get(key);
      map.set(key, { emoji: key, count: prev ? prev.count + 1 : 1 });
    });
    return Array.from(map.values());
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await messagesService.toggleReaction(messageId, emoji);
      if (res?.reactions && activeThread) {
        updateConversationReaction(activeThread.id, messageId, res.reactions);
      }
    } catch {
      // ignore
    } finally {
      setReactionPickerFor(null);
    }
  };

  const refreshEscrowForActiveThread = async () => {
    if (!activeThread) return null;
    const escrow = await escrowService.getLatestByConversation(activeThread.id).catch(() => null);
    const normalized = escrow?.escrow || escrow || null;
    setCurrentEscrow(normalized);
    return normalized;
  };

  const openEscrow = () => {
    if (currentEscrow?.id) {
      setEscrowViewOpen(true);
      return;
    }
    setEscrowModalOpen(true);
  };

  const openEscrowView = async () => {
    if (!activeThread) return;
    const escrow = await refreshEscrowForActiveThread();
    if (!escrow) return;
    setEscrowViewOpen(true);
  };

  const createEscrow = async (payload: any) => {
    if (!activeThread) return;
    const res = await escrowService.createOffer({
      conversationId: activeThread.id,
      ...payload,
    });
    setEscrowModalOpen(false);
    setCurrentEscrow(res?.escrow || res);
    setShowEscrowProposed(true);
    setTimeout(() => setShowEscrowProposed(false), 3000);
  };

  const hasEscrow = Boolean(currentEscrow?.id);
  const applicantDisplayName =
    activeThread?.applicant?.name || activeThread?.applicant?.email || 'applicant';

  const threadTitle = (thread: Thread) => {
    if (thread.type !== 'GENERAL') return thread.ad?.title || 'Marketplace conversation';
    const counterpart = thread.posterId === userId ? thread.applicant : thread.poster;
    return counterpart?.name || counterpart?.email || 'General conversation';
  };

  const handleCreateGeneral = async () => {
    if (!selectedGeneralUser) {
      toast.error('Search for and select a user first');
      return;
    }
    try {
      setCreatingGeneral(true);
      const response = await messagesService.createGeneral(
        selectedGeneralUser.id,
        generalInitialMessage.trim() || undefined
      );
      const conversation = response?.conversation || response;
      const generalThreads = [
        conversation,
        ...threadCacheRef.current.GENERAL.filter((item) => item.id !== conversation.id),
      ];
      threadCacheRef.current.GENERAL = generalThreads;
      setInboxFilter('GENERAL');
      setThreads(generalThreads);
      setActiveThread(conversation);
      activeThreadRef.current = conversation;
      setGeneralUserQuery('');
      setGeneralUserResults([]);
      setSelectedGeneralUser(null);
      setGeneralInitialMessage('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to start conversation');
    } finally {
      setCreatingGeneral(false);
    }
  };
  const handleArchiveState = async () => {
    if (!activeThread) return;
    try {
      if (inboxFilter === 'ARCHIVED' || activeThread.isArchived) {
        await messagesService.restoreThread(activeThread.id);
        const restoredThread = { ...activeThread, isArchived: false };
        threadCacheRef.current.ARCHIVED = threadCacheRef.current.ARCHIVED.filter((item) => item.id !== activeThread.id);
        const targetFilter: InboxFilter = restoredThread.type === 'GENERAL' ? 'GENERAL' : 'MARKETPLACE';
        threadCacheRef.current[targetFilter] = [
          restoredThread,
          ...threadCacheRef.current[targetFilter].filter((item) => item.id !== activeThread.id),
        ];
        setThreads(threadCacheRef.current.ARCHIVED);
        setActiveThread(null);
        activeThreadRef.current = null;
        setMessages([]);
        toast.success('Conversation restored');
      } else {
        await messagesService.archiveThread(activeThread.id);
        const archivedThread = { ...activeThread, isArchived: true };
        threadCacheRef.current[inboxFilter] = threadCacheRef.current[inboxFilter].filter((item) => item.id !== activeThread.id);
        threadCacheRef.current.ARCHIVED = [
          archivedThread,
          ...threadCacheRef.current.ARCHIVED.filter((item) => item.id !== activeThread.id),
        ];
        setThreads(threadCacheRef.current[inboxFilter]);
        setActiveThread(null);
        activeThreadRef.current = null;
        setMessages([]);
        toast.success('Conversation archived. Open the Archived tab to restore it.');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to update conversation');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketplaceTopNav />
      <div className="px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-6">
        <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
          <input className="w-full rounded-full bg-white/5 px-4 py-2 text-sm" placeholder="Search" />
          <div className="mt-3 flex gap-2 text-xs">
            <button
              onClick={() => changeInboxFilter('MARKETPLACE')}
              className={inboxFilter === 'MARKETPLACE' ? 'rounded-full bg-pink-600/20 px-3 py-1' : 'rounded-full border border-white/10 px-3 py-1 text-zinc-400'}
            >
              Marketplace
            </button>
            <button
              onClick={() => changeInboxFilter('GENERAL')}
              className={inboxFilter === 'GENERAL' ? 'rounded-full bg-pink-600/20 px-3 py-1' : 'rounded-full border border-white/10 px-3 py-1 text-zinc-400'}
            >
              General
            </button>
            <button
              onClick={() => changeInboxFilter('ARCHIVED')}
              className={inboxFilter === 'ARCHIVED' ? 'rounded-full bg-pink-600/20 px-3 py-1' : 'rounded-full border border-white/10 px-3 py-1 text-zinc-400'}
            >
              Archived
            </button>
          </div>
          {inboxFilter === 'GENERAL' && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <input
                  value={generalUserQuery}
                  onChange={(event) => {
                    setGeneralUserQuery(event.target.value);
                    setSelectedGeneralUser(null);
                  }}
                  className="w-full rounded-full bg-white/5 px-4 py-2 text-xs"
                  placeholder="Search by display name"
                  autoComplete="off"
                />
                {searchingGeneralUsers && (
                  <div className="px-3 py-2 text-[10px] text-zinc-500">Searching...</div>
                )}
                {!selectedGeneralUser && generalUserResults.length > 0 && (
                  <div className="mt-1 space-y-1 rounded-2xl border border-white/10 bg-zinc-950 p-2">
                    {generalUserResults.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          setSelectedGeneralUser(candidate);
                          setGeneralUserQuery(candidate.name || `User ${candidate.id}`);
                          setGeneralUserResults([]);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs hover:bg-white/5"
                      >
                        {candidate.avatarUrl ? (
                          <img src={candidate.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="h-7 w-7 rounded-full bg-white/10" />
                        )}
                        <span>
                          <span className="block font-medium">{candidate.name || 'Unnamed user'}</span>
                          <span className="block text-[10px] text-zinc-500">User #{candidate.id}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedGeneralUser && (
                <div className="px-3 text-[10px] text-emerald-400">
                  Selected {selectedGeneralUser.name || `User #${selectedGeneralUser.id}`}
                </div>
              )}
              <input
                value={generalInitialMessage}
                onChange={(event) => setGeneralInitialMessage(event.target.value)}
                className="w-full rounded-full bg-white/5 px-4 py-2 text-xs"
                placeholder="First message (optional)"
              />
              <button
                onClick={handleCreateGeneral}
                disabled={creatingGeneral || !selectedGeneralUser}
                className="w-full rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40"
              >
                {creatingGeneral ? 'Starting...' : 'Start general conversation'}
              </button>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => selectThread(t)}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-xs ${
                  activeThread?.id === t.id ? 'border-pink-500/60 bg-white/5' : 'border-white/10'
                }`}
              >
                <div className="text-sm font-semibold">{threadTitle(t)}</div>
                <div className="text-zinc-400 truncate">{t.lastMessagePreview || 'No messages yet'}</div>
              </button>
            ))}
            {loadingThreads && <div className="text-[10px] text-zinc-500">Loading...</div>}
            {polling && <div className="text-[10px] text-zinc-500">Refreshing...</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-4 flex flex-col">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Subject: {activeThread ? threadTitle(activeThread) : 'Conversation'}</span>
            {activeThread && (
              <button
                onClick={handleArchiveState}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400"
              >
                {inboxFilter === 'ARCHIVED' || activeThread.isArchived ? 'Restore conversation' : 'Archive conversation'}
              </button>
            )}
          </div>
          <div className="flex-1 mt-4 space-y-4 overflow-y-auto">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[78%] items-end gap-2 ${m.senderId === userId ? 'flex-row-reverse' : 'flex-row'}`}>
                  {getMessageAvatarSrc(m.senderId) && !messageAvatarErrors[String(m.senderId)] ? (
                    <button
                      type="button"
                      className="rounded-full"
                      onClick={() => handleOpenUserProfile(m.senderId)}
                      title="View profile"
                    >
                      <img
                        src={getMessageAvatarSrc(m.senderId)}
                        alt="User"
                        className="h-7 w-7 rounded-full object-cover border border-white/10"
                        onError={() =>
                          setMessageAvatarErrors((prev) => ({ ...prev, [String(m.senderId)]: true }))
                        }
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="h-7 w-7 rounded-full bg-white/10"
                      onClick={() => handleOpenUserProfile(m.senderId)}
                      title="View profile"
                    />
                  )}
                  <div className="w-full">
                  <div
                    onClick={() => setReactionPickerFor((prev) => (prev === m.id ? null : m.id))}
                    className={`rounded-2xl px-4 py-3 text-sm cursor-pointer ${
                      m.senderId === userId ? 'ml-auto bg-emerald-100 text-black' : 'bg-white text-black'
                    }`}
                    title="React"
                  >
                    <div className="whitespace-pre-wrap break-words">{renderMessageBody(m.body)}</div>
                  </div>
                  {reactionPickerFor === m.id && (
                    <div className="mt-2 rounded-2xl border border-white/10 bg-black/90 p-2">
                      <div className="grid grid-cols-8 gap-2">
                        {emojiList.map((e) => (
                          <button
                            key={`${m.id}-${e}`}
                            type="button"
                            className="h-7 w-7 rounded-lg bg-white/5 text-sm hover:bg-white/10"
                            onClick={() => toggleReaction(m.id, e)}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.reactions && m.reactions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groupReactions(m.reactions).map((r) => (
                        <button
                          key={`${m.id}-${r.emoji}`}
                          type="button"
                          onClick={() => toggleReaction(m.id, r.emoji)}
                          className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white"
                        >
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              </div>
            ))}
            {loadingMessages && (
              <div className="text-xs text-zinc-500">Loading messages...</div>
            )}
            {!loadingMessages && messages.length === 0 && (
              <div className="text-xs text-zinc-500">No messages yet.</div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="h-12 w-12 rounded-full border border-white/10 bg-white/5 text-lg"
              aria-label="Add attachment"
              title="Attach file"
              disabled={uploadingAttachment}
            >
              <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-8.49 8.49a5 5 0 01-7.07-7.07l8.49-8.49a3.5 3.5 0 114.95 4.95l-8.49 8.49a2 2 0 11-2.83-2.83l7.78-7.78" />
              </svg>
            </button>
            <input
              ref={attachmentInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleAttachmentUpload}
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-full bg-white/5 px-4 py-3 text-sm"
              placeholder={uploadingAttachment ? 'Uploading attachment...' : 'Type your message'}
            />
            <button
              onClick={handleSend}
              disabled={uploadingAttachment}
              className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black"
            >
              {uploadingAttachment ? 'Uploading...' : 'Send'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
          <div className="flex flex-col items-center text-center">
            {profileAvatarSrc && !profileAvatarError ? (
              <img
                key={profileAvatarSrc}
                src={profileAvatarSrc}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover border border-white/10"
                onError={() => setProfileAvatarError(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/10" />
            )}
            <div className="mt-3 font-semibold">{selectedProfileUser?.name || selectedProfileUser?.email || selectedProfileRole}</div>
            <div className="text-xs text-zinc-400">{selectedProfileRole}</div>
            <div className="text-xs text-zinc-400">Typically replies in 15 minutes</div>
            {!!activeThread?.id && (
              <button
                type="button"
                className="mt-3 rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
                onClick={() => navigate(`/messages/${activeThread.id}`)}
              >
                Back to Thread
              </button>
            )}
          </div>
          <div className="mt-6 space-y-3 text-xs text-zinc-400">
            <div>{isMarketplaceConversation ? 'Project Brief' : 'Conversation Type'}</div>
            <div className="text-white">
              {isMarketplaceConversation
                ? `${activeThread?.ad?.description?.slice(0, 120) || 'N/A'}...`
                : 'General conversation'}
            </div>
          </div>
          {isMarketplaceConversation && (
            <button
              onClick={hasEscrow ? openEscrowView : openEscrow}
              disabled={!isPoster && !hasEscrow}
              className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-semibold ${
                !isPoster && !hasEscrow
                  ? 'cursor-not-allowed border border-white/10 bg-white/5 text-zinc-500'
                  : 'bg-gradient-to-r from-pink-500 to-amber-400 text-black'
              }`}
            >
              {hasEscrow ? 'View Escrow' : isPoster ? 'Set Up Escrow' : 'No Escrow Set Yet'}
            </button>
          )}
        </div>
      </div>

      {isMarketplaceConversation && showEscrowProposed && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-40">
          <div className="rounded-2xl border border-white/10 bg-black/80 px-10 py-6 text-center">
            <p className="text-sm text-zinc-400">Escrow Deal Proposed</p>
            <p className="mt-2 text-xs text-zinc-500">Waiting for acceptance by {applicantDisplayName}</p>
            <button
              className="mt-4 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-2 text-xs font-semibold text-black"
              onClick={() => {
                setShowEscrowProposed(false);
                setEscrowViewOpen(true);
              }}
            >
              View Message
            </button>
          </div>
        </div>
      )}

      {isMarketplaceConversation && escrowModalOpen && (
        <EscrowCreateModal onClose={() => setEscrowModalOpen(false)} onSubmit={createEscrow} />
      )}

      {isMarketplaceConversation && escrowViewOpen && (
        <EscrowViewModal
          escrow={currentEscrow}
          onClose={() => setEscrowViewOpen(false)}
          isPoster={isPoster}
          onUpdated={refreshEscrowForActiveThread}
        />
      )}
      </div>
    </div>
  );
}

function EscrowCreateModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: any) => void }) {
  const [title, setTitle] = useState('Multisig Setup for Bagzilla Inu');
  const [amount, setAmount] = useState('320');
  const [deadline, setDeadline] = useState('');
  const [noDeadline, setNoDeadline] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/90 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Escrow Offer</h3>
          <button onClick={onClose} className="text-zinc-500">x</button>
        </div>
        <div className="mt-6 space-y-4 text-sm">
          <div>
            <label className="text-xs text-zinc-400">Task Title</label>
            <input className="mt-2 w-full rounded-xl bg-white/5 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Total Amount (USDC)</label>
            <input className="mt-2 w-full rounded-xl bg-white/5 px-3 py-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Deadline</label>
            <input className="mt-2 w-full rounded-xl bg-white/5 px-3 py-2" placeholder="MM/DD/YYYY" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <label className="mt-2 flex items-center gap-2 text-xs text-amber-400">
              <input type="checkbox" checked={noDeadline} onChange={(e) => setNoDeadline(e.target.checked)} />
              No fixed deadline
            </label>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-zinc-400">
            Escrow Method: Movement USDC only
          </div>
          <button
            onClick={() =>
              onSubmit({
                title,
                totalAmount: Number(amount),
                currency: 'USDC',
                deadline: noDeadline ? null : deadline,
                noDeadline,
                milestones: [],
              })
            }
            className="w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black"
          >
            Send Escrow Offer
          </button>
        </div>
      </div>
    </div>
  );
}

function EscrowViewModal({
  escrow,
  onClose,
  isPoster,
  onUpdated,
}: {
  escrow: any;
  onClose: () => void;
  isPoster: boolean;
  onUpdated?: () => Promise<any>;
}) {
  const { user: privyUser } = usePrivyAuth();
  const { signRawHash } = useSignRawHash();
  const [funding, setFunding] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<
    'accept' | 'decline' | 'review_release' | 'review_dispute' | 'dispute_response' | null
  >(null);
  const [disputeExplanation, setDisputeExplanation] = useState('');
  if (!escrow) return null;

  const refreshEscrow = async () => {
    if (onUpdated) await onUpdated();
  };

  const handleFund = async () => {
    try {
      setFunding(true);
      const wallet = getMovementWallet(privyUser);
      if (!wallet?.address || !(wallet as any)?.publicKey) {
        toast.error('Movement wallet not found.');
        return;
      }
      const payment = await escrowService.fund(escrow.id);
      const paymentId = payment?.payment?.paymentId || payment?.paymentId;
      const transactionData =
        payment?.payment?.transactionData || payment?.transactionData || payment?.payment?.transaction_data;
      if (!transactionData) {
        toast.error('Transaction data missing');
        return;
      }
      const txHash = await sendMovementTransaction(
        transactionData,
        wallet.address,
        (wallet as any).publicKey,
        signRawHash
      );
      if (paymentId) {
        await paymentService.verify(paymentId, txHash);
      }
      toast.success(`Escrow funded: ${txHash.substring(0, 8)}...`);
      await refreshEscrow();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fund escrow');
    } finally {
      setFunding(false);
    }
  };

  const handleDecision = async (action: 'accept' | 'decline') => {
    try {
      setDecisionLoading(action);
      if (action === 'accept') {
        await escrowService.accept(escrow.id);
        toast.success('Escrow offer accepted');
      } else {
        await escrowService.decline(escrow.id);
        toast.success('Escrow offer declined');
      }
      await refreshEscrow();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action} escrow`);
    } finally {
      setDecisionLoading(null);
    }
  };

  const handlePosterReview = async (satisfied: boolean) => {
    try {
      const loadingKey = satisfied ? 'review_release' : 'review_dispute';
      setDecisionLoading(loadingKey);
      let reason = '';
      if (!satisfied) {
        reason = window.prompt('Briefly describe the issue with the delivery:', '') || '';
      }
      await escrowService.posterReview(escrow.id, { satisfied, reason: reason.trim() || undefined });
      toast.success(satisfied ? 'Funds released' : 'Dispute opened. Applicant has been asked to explain.');
      await refreshEscrow();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit review decision');
    } finally {
      setDecisionLoading(null);
    }
  };

  const handleDisputeResponse = async () => {
    try {
      setDecisionLoading('dispute_response');
      await escrowService.submitDisputeResponse(escrow.id, disputeExplanation);
      toast.success('Your explanation has been sent for review');
      setDisputeExplanation('');
      await refreshEscrow();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send explanation');
    } finally {
      setDecisionLoading(null);
    }
  };

  const statusLabel = String(escrow.status || 'UNKNOWN').replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/90 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Escrow Offer</h3>
          <button onClick={onClose} className="text-zinc-500">x</button>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Status: {statusLabel}</div>
          <div>Task Title: {escrow.title}</div>
          <div>Total Amount: {escrow.totalAmount} USDC</div>
          <div>Deadline: {escrow.deadline ? new Date(escrow.deadline).toLocaleDateString() : 'No fixed deadline'}</div>
          <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-zinc-400">
            Escrow Method: Movement USDC
          </div>
          {!isPoster && escrow.status === 'PROPOSED' && (
            <div className="flex gap-3">
              <button
                onClick={() => handleDecision('accept')}
                disabled={decisionLoading !== null}
                className="flex-1 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
              >
                {decisionLoading === 'accept' ? 'Accepting...' : 'Accept Offer'}
              </button>
              <button
                onClick={() => handleDecision('decline')}
                disabled={decisionLoading !== null}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-300 disabled:opacity-40"
              >
                {decisionLoading === 'decline' ? 'Declining...' : 'Decline'}
              </button>
            </div>
          )}
          {!isPoster && escrow.status !== 'PROPOSED' && (
            <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-zinc-400">
              {escrow.status === 'UNDER_REVIEW'
                ? 'Deadline elapsed. Awaiting client review decision.'
                : escrow.status === 'DISPUTED'
                  ? 'A dispute is open. Please provide your explanation below.'
                  : 'Awaiting next escrow step from the poster.'}
            </div>
          )}
          {!isPoster && escrow.status === 'DISPUTED' && (
            <div className="space-y-2">
              <textarea
                value={disputeExplanation}
                onChange={(e) => setDisputeExplanation(e.target.value)}
                rows={3}
                placeholder="Explain what happened and any proof/context."
                className="w-full rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-zinc-200"
              />
              <button
                onClick={handleDisputeResponse}
                disabled={decisionLoading !== null || disputeExplanation.trim().length < 10}
                className="w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40"
              >
                {decisionLoading === 'dispute_response' ? 'Submitting...' : 'Submit Explanation'}
              </button>
            </div>
          )}
          {isPoster && escrow.status === 'AWAITING_PAYMENT' && (
            <button
              onClick={handleFund}
              disabled={funding}
              className="w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              {funding ? 'Funding...' : 'Fund Escrow'}
            </button>
          )}
          {isPoster && escrow.status === 'UNDER_REVIEW' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-zinc-400">
                Deadline has elapsed. Are you satisfied with delivery?
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePosterReview(true)}
                  disabled={decisionLoading !== null}
                  className="flex-1 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {decisionLoading === 'review_release' ? 'Releasing...' : 'Release Funds'}
                </button>
                <button
                  onClick={() => handlePosterReview(false)}
                  disabled={decisionLoading !== null}
                  className="flex-1 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-300 disabled:opacity-40"
                >
                  {decisionLoading === 'review_dispute' ? 'Submitting...' : 'Report Issue'}
                </button>
              </div>
            </div>
          )}
          {isPoster && !['AWAITING_PAYMENT', 'UNDER_REVIEW'].includes(escrow.status) && (
            <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-zinc-400">
              This escrow is currently in `{statusLabel}` state.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
