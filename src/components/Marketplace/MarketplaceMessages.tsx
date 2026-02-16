import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  ad: any;
  posterId: number;
  applicantId: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
};

export default function MarketplaceMessages() {
  const { threadId } = useParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [escrowModalOpen, setEscrowModalOpen] = useState(false);
  const [escrowViewOpen, setEscrowViewOpen] = useState(false);
  const [currentEscrow, setCurrentEscrow] = useState<any>(null);
  const [showEscrowProposed, setShowEscrowProposed] = useState(false);
  const [polling, setPolling] = useState(false);

  const userId = Number(localStorage.getItem('cto_user_id') || 0);

  useEffect(() => {
    let mounted = true;
    messagesService.listThreads().then((res: any) => {
      if (!mounted) return;
      const items = res?.items || res || [];
      setThreads(items);
      if (threadId) {
        const match = items.find((t: Thread) => t.id === threadId);
        if (match) setActiveThread(match);
      } else if (items[0]) {
        setActiveThread(items[0]);
      }
    });
    return () => {
      mounted = false;
    };
  }, [threadId]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        setPolling(true);
        const res = await messagesService.listThreads();
        if (!alive) return;
        const items = res?.items || res || [];
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
  }, []);

  useEffect(() => {
    if (!activeThread) return;
    messagesService.getThread(activeThread.id).then((res: any) => {
      setMessages(res?.messages || []);
    });
  }, [activeThread?.id]);

  useEffect(() => {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) return;
    const socket: Socket = io(`${backendUrl}/ws`, {
      transports: ['websocket', 'polling'],
    });
    let mounted = true;
    socket.on('connect', () => {
      socket.emit('notifications.subscribe', { token });
    });
    socket.on('messages.new', (payload: any) => {
      if (payload?.conversationId === activeThread?.id) {
        setMessages((prev) => [...prev, payload.message]);
      }
    });
    socket.on('notifications.new', (payload: any) => {
      if (!mounted) return;
      if (payload?.type !== 'ESCROW') return;
      const convoId = payload?.data?.conversationId;
      if (activeThread && (!convoId || convoId === activeThread.id)) {
        escrowService.getLatestByConversation(activeThread.id).then((res: any) => {
          setCurrentEscrow(res?.escrow || res);
        });
      }
    });
    socket.on('escrow.update', (payload: any) => {
      if (payload?.escrowId && activeThread) {
        escrowService.getLatestByConversation(activeThread.id).then((res: any) => {
          setCurrentEscrow(res?.escrow || res);
        });
      }
    });
    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [activeThread?.id]);

  const isPoster = useMemo(() => {
    if (!activeThread) return false;
    return activeThread.posterId === userId;
  }, [activeThread, userId]);

  const otherUser = useMemo(() => {
    if (!activeThread) return null;
    return isPoster ? activeThread.applicant : activeThread.poster;
  }, [activeThread, isPoster]);

  const handleSend = async () => {
    if (!activeThread || !input.trim()) return;
    const res = await messagesService.sendMessage(activeThread.id, input.trim());
    const msg = res?.message || res;
    setMessages((prev) => [...prev, msg]);
    setInput('');
  };

  const openEscrow = () => {
    setEscrowModalOpen(true);
  };

  const openEscrowView = async () => {
    if (!activeThread) return;
    const escrow = await escrowService.getLatestByConversation(activeThread.id).catch(() => null);
    setCurrentEscrow(escrow?.escrow || escrow);
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
    setTimeout(() => setShowEscrowProposed(false), 2500);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketplaceTopNav />
      <div className="px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-6">
        <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
          <input className="w-full rounded-full bg-white/5 px-4 py-2 text-sm" placeholder="Search" />
          <div className="mt-3 flex gap-2 text-xs">
            <button className="rounded-full bg-pink-600/20 px-3 py-1">Inbox</button>
            <button className="rounded-full border border-white/10 px-3 py-1 text-zinc-400">Archive</button>
          </div>
          <div className="mt-4 space-y-3">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveThread(t)}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-xs ${
                  activeThread?.id === t.id ? 'border-pink-500/60 bg-white/5' : 'border-white/10'
                }`}
              >
                <div className="text-sm font-semibold">{t.ad?.title || 'Conversation'}</div>
                <div className="text-zinc-400 truncate">{t.lastMessagePreview || 'No messages yet'}</div>
              </button>
            ))}
            {polling && <div className="text-[10px] text-zinc-500">Refreshing…</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-4 flex flex-col">
          <div className="text-sm text-zinc-400">
            Subject: {activeThread?.ad?.title || 'Conversation'}
          </div>
          <div className="flex-1 mt-4 space-y-4 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
                  m.senderId === userId ? 'ml-auto bg-emerald-100 text-black' : 'bg-white text-black'
                }`}
              >
                {m.body}
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-xs text-zinc-500">No messages yet.</div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-full bg-white/5 px-4 py-3 text-sm"
              placeholder="Type your message"
            />
            <button
              onClick={handleSend}
              className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black"
            >
              Send
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
          <div className="flex flex-col items-center text-center">
            {otherUser?.avatarUrl ? (
              <img
                src={otherUser.avatarUrl}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/10" />
            )}
            <div className="mt-3 font-semibold">{isPoster ? 'Applicant' : 'Poster'}</div>
            <div className="text-xs text-zinc-400">Typically replies in 15 minutes</div>
          </div>
          <div className="mt-6 space-y-3 text-xs text-zinc-400">
            <div>Project Brief</div>
            <div className="text-white">{activeThread?.ad?.description?.slice(0, 120) || 'N/A'}...</div>
          </div>
          {isPoster ? (
            <button
              onClick={openEscrow}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black"
            >
              Set Up Escrow
            </button>
          ) : (
            <button
              onClick={openEscrowView}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black"
            >
              View Escrow Offer
            </button>
          )}
        </div>
      </div>

      {showEscrowProposed && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-40">
          <div className="rounded-2xl border border-white/10 bg-black/80 px-10 py-6 text-center">
            <p className="text-sm text-zinc-400">Escrow Deal Proposed</p>
            <p className="mt-2 text-xs text-zinc-500">Waiting for acceptance by applicant</p>
            <button className="mt-4 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-2 text-xs font-semibold text-black">
              View Message
            </button>
          </div>
        </div>
      )}

      {escrowModalOpen && (
        <EscrowCreateModal onClose={() => setEscrowModalOpen(false)} onSubmit={createEscrow} />
      )}

      {escrowViewOpen && (
        <EscrowViewModal
          escrow={currentEscrow}
          onClose={() => setEscrowViewOpen(false)}
          isPoster={isPoster}
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
          <button onClick={onClose} className="text-zinc-500">×</button>
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

function EscrowViewModal({ escrow, onClose, isPoster }: { escrow: any; onClose: () => void; isPoster: boolean }) {
  const { user: privyUser } = usePrivyAuth();
  const { signRawHash } = useSignRawHash();
  const [funding, setFunding] = useState(false);
  if (!escrow) return null;

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
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fund escrow');
    } finally {
      setFunding(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/90 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Escrow Offer</h3>
          <button onClick={onClose} className="text-zinc-500">×</button>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <div>Task Title: {escrow.title}</div>
          <div>Total Amount: {escrow.totalAmount} USDC</div>
          <div>Deadline: {escrow.deadline ? new Date(escrow.deadline).toLocaleDateString() : 'No fixed deadline'}</div>
          <div className="rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-zinc-400">
            Escrow Method: Movement USDC
          </div>
          {!isPoster && (
            <div className="flex gap-3">
              <button
                onClick={() => escrowService.accept(escrow.id)}
                className="flex-1 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black"
              >
                Accept Offer
              </button>
              <button
                onClick={() => escrowService.decline(escrow.id)}
                className="flex-1 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-300"
              >
                Decline
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
        </div>
      </div>
    </div>
  );
}
