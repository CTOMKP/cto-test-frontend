import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useCreateWallet as useCreateSolanaWallet, useSignTransaction } from '@privy-io/react-auth/solana';
import toast from 'react-hot-toast';
import solanaWalletService from '../../services/solanaWalletService';
import { WalletTransaction } from '../../services/movementWalletService';

const resolveSolanaRpc = () => {
  const env = process.env.REACT_APP_SOLANA_RPC_URL;
  if (env) return env;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'https://api.devnet.solana.com';
    }
  }
  return 'https://api.mainnet-beta.solana.com';
};

const createRpcConnection = () =>
  new Connection(resolveSolanaRpc(), {
    commitment: 'confirmed',
    // Avoid aggressive SDK retry storms when devnet starts rate-limiting.
    disableRetryOnRateLimit: true,
  });

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

// USDC mint (Solana mainnet by default, override via env for devnet tests)
const DEFAULT_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT = new PublicKey(process.env.REACT_APP_SOLANA_USDC_MINT || DEFAULT_USDC_MINT);

const getAssociatedTokenAddress = async (mint: PublicKey, owner: PublicKey) => {
  const [ata] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
};

const createAssociatedTokenAccountIx = (
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys,
    data: Buffer.alloc(0),
  });
};

const createTransferIx = (
  sourceAta: PublicKey,
  destAta: PublicKey,
  owner: PublicKey,
  amount: bigint
) => {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction
  data.writeBigUInt64LE(amount, 1);
  const keys = [
    { pubkey: sourceAta, isSigner: false, isWritable: true },
    { pubkey: destAta, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys,
    data,
  });
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const sanitizeSolAddress = (value: string) =>
  (value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width chars from copy/paste
    .trim();

type SolanaWalletActivityProps = {
  onTransactionRecorded?: (tx: WalletTransaction) => void;
  onTransactionsHydrated?: (txs: WalletTransaction[]) => void;
};

export const SolanaWalletActivity: React.FC<SolanaWalletActivityProps> = ({
  onTransactionRecorded,
  onTransactionsHydrated,
}) => {
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signTransaction: signSolanaTransaction } = useSignTransaction();
  const [solanaAddress, setSolanaAddress] = useState<string>('');
  const [solanaWalletId, setSolanaWalletId] = useState<string>('');
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<'USDC' | 'SOL'>('USDC');
  const [sending, setSending] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const lastHydratedSignature = useRef<string>('');
  const walletsRef = useRef(wallets);
  const balanceCacheKey = (address: string) => `cto_solana_balance_${address}`;

  const sameAddress = (a?: string, b?: string) => (a || '').toLowerCase() === (b || '').toLowerCase();
  const toHydrationSignature = (txs: WalletTransaction[]) =>
    txs
      .map((tx) => `${tx.txHash}:${tx.txType}:${tx.amount}:${tx.tokenSymbol}:${tx.createdAt}`)
      .join('|');

  const emitHydratedTransactions = useCallback(
    (txs: WalletTransaction[]) => {
      const signature = toHydrationSignature(txs);
      if (signature === lastHydratedSignature.current) return;
      lastHydratedSignature.current = signature;
      onTransactionsHydrated?.(txs);
    },
    [onTransactionsHydrated]
  );

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  const getSolanaWallet = (candidateWallets: any[] = walletsRef.current as any[]) => {
    // First preference: signer wallet that exactly matches the displayed Solana address.
    const byShownAddress = candidateWallets.find((w) => sameAddress((w as any).address, solanaAddress));
    if (byShownAddress) return byShownAddress;

    // Second preference: use linkedAccounts Solana address, then find a matching signer wallet.
    const linked = user?.linkedAccounts || [];
    const linkedSol = linked.find((a: any) => a.chainType === 'solana' || a.walletClientType === 'solana');
    const linkedAddr = (linkedSol as any)?.address || '';
    if (linkedAddr) {
      const byLinkedAddress = candidateWallets.find((w) => sameAddress((w as any).address, linkedAddr));
      if (byLinkedAddress) return byLinkedAddress;
    }

    const solWallet =
      candidateWallets.find((w) => (w as any).chainType === 'solana') ||
      candidateWallets.find((w) => (((w as any).chainId || '') as string).startsWith('solana:')) ||
      candidateWallets.find((w) => (w as any).walletClientType === 'solana' || (w as any).coinType === 501) ||
      candidateWallets.find((w) => {
        const addr = (w as any).address || '';
        return addr.length >= 32 && addr.length <= 44 && !addr.startsWith('0x');
      });
    if (!solWallet) {
      const summary = candidateWallets
        .map((w: any) => `${w?.walletClientType || 'unknown'}:${w?.chainType || w?.chainId || 'n/a'}:${(w?.address || '').slice(0, 6)}`)
        .join(', ');
      throw new Error(`No Solana signer wallet found. Wallets=${candidateWallets.length} [${summary}]`);
    }
    return solWallet;
  };

  const ensureSolanaSignerWallet = async () => {
    const hasLinkedSolana = !!(user?.linkedAccounts || []).find(
      (a: any) => a.chainType === 'solana' || a.walletClientType === 'solana'
    );
    for (let i = 0; i < 3; i += 1) {
      try {
        return getSolanaWallet();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    try {
      if (!hasLinkedSolana) {
        await createSolanaWallet();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (err) {
      console.warn('[SolanaSend] no signer wallet found, trying to create one...', err);
    }
    for (let i = 0; i < 3; i += 1) {
      try {
        return getSolanaWallet();
      } catch (createErr: any) {
        console.warn('[SolanaSend] createSolanaWallet failed', createErr);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    return getSolanaWallet();
  };

  const refreshBalances = async (address: string) => {
    try {
      const data = await solanaWalletService.getBalance(address);
      const sol = typeof data?.sol === 'number' ? data.sol : 0;
      const usdc = typeof data?.usdc === 'number' ? data.usdc : 0;
      setSolBalance(sol);
      setUsdcBalance(usdc);
      try {
        localStorage.setItem(
          balanceCacheKey(address),
          JSON.stringify({
            sol: sol,
            usdc: usdc,
            at: Date.now(),
          })
        );
      } catch {
        // ignore cache write failures
      }
      setDebugInfo((prev) => `${prev} | balance_api=ok`);
    } catch (e: any) {
      setDebugInfo((prev) => `${prev} | balance_err=${e?.message || 'unknown'}`);
    }
  };

  const hydrateRecentTransactions = async (walletId: string) => {
    try {
      await solanaWalletService.pollTransactions(walletId, 15, solanaAddress);
      const txs = await solanaWalletService.getTransactions(walletId, 20);
      emitHydratedTransactions(txs);
    } catch (e: any) {
      setDebugInfo((prev) => `${prev} | tx_hydrate_err=${e?.message || 'unknown'}`);
    }
  };

  const resolveStoredSolanaWallet = (address?: string) => {
    try {
      const stored = localStorage.getItem('cto_user_wallets');
      const parsedWallets = stored ? JSON.parse(stored) : [];
      const normalizedAddress = sanitizeSolAddress(address || '');
      const byAddress = normalizedAddress
        ? parsedWallets.find(
            (w: any) =>
              (w.blockchain === 'SOLANA' || w.chainType === 'solana') &&
              sameAddress(w.address, normalizedAddress)
          )
        : null;
      if (byAddress) {
        return {
          id: byAddress.id as string,
          address: sanitizeSolAddress(byAddress.address || ''),
        };
      }
      const firstSol = parsedWallets.find(
        (w: any) => w.blockchain === 'SOLANA' || w.chainType === 'solana'
      );
      if (firstSol) {
        return {
          id: firstSol.id as string,
          address: sanitizeSolAddress(firstSol.address || ''),
        };
      }
    } catch {
      // ignore localStorage parse errors
    }
    return { id: '', address: '' };
  };

  useEffect(() => {
    try {
      const solWallet = getSolanaWallet();
      const addr = (solWallet as any)?.address || '';
      setDebugInfo(
        `wallets=${wallets.length} | detected=${addr || 'none'} | first=${(wallets[0] as any)?.address || 'n/a'}`
      );
      if (addr) {
        const cleanAddr = sanitizeSolAddress(addr);
        setSolanaAddress((prev) => (sameAddress(prev, cleanAddr) ? prev : cleanAddr));
        const storedWallet = resolveStoredSolanaWallet(cleanAddr);
        setSolanaWalletId((prev) => (prev === storedWallet.id ? prev : storedWallet.id));
      }
      return;
    } catch (e: any) {
      // Fallback: check Privy linkedAccounts
      const linked = user?.linkedAccounts || [];
      const linkedSol = linked.find((a: any) => a.chainType === 'solana' || a.walletClientType === 'solana');
      const linkedAddr = (linkedSol as any)?.address || '';

      // Fallback: check backend wallets from localStorage
      let storedAddr = '';
      try {
        const stored = localStorage.getItem('cto_user_wallets');
        const parsed = stored ? JSON.parse(stored) : [];
        const solStored = parsed.find((w: any) => w.blockchain === 'SOLANA' || w.chainType === 'solana');
        storedAddr = solStored?.address || '';
      } catch {
        storedAddr = '';
      }

      const addr = linkedAddr || storedAddr;
      setDebugInfo(
        `wallets=${wallets.length} | detected=none | linked=${linkedAddr || 'n/a'} | stored=${storedAddr || 'n/a'} | err=${e?.message || 'unknown'}`
      );
      if (addr) {
        const cleanAddr = sanitizeSolAddress(addr);
        setSolanaAddress((prev) => (sameAddress(prev, cleanAddr) ? prev : cleanAddr));
        const storedWallet = resolveStoredSolanaWallet(cleanAddr);
        setSolanaWalletId((prev) => (prev === storedWallet.id ? prev : storedWallet.id));
      }
    }
  }, [wallets, user?.id]);

  useEffect(() => {
    if (!solanaAddress) return;
    try {
      const cached = localStorage.getItem(balanceCacheKey(solanaAddress));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed?.sol === 'number') setSolBalance(parsed.sol);
        if (typeof parsed?.usdc === 'number') setUsdcBalance(parsed.usdc);
      }
    } catch {
      // ignore parse errors
    }
    refreshBalances(solanaAddress);
  }, [solanaAddress]);

  useEffect(() => {
    if (!solanaWalletId) return;
    hydrateRecentTransactions(solanaWalletId);
  }, [solanaWalletId]);

  useEffect(() => {
    if (!solanaWalletId && !solanaAddress) return;
    const interval = setInterval(() => {
      if (solanaAddress) {
        refreshBalances(solanaAddress);
      }
      if (solanaWalletId) {
        hydrateRecentTransactions(solanaWalletId);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [solanaWalletId, solanaAddress]);

  const handleSend = async () => {
    if (!recipient || !amount) {
      toast.error('Please enter recipient and amount');
      return;
    }

    const cleanRecipient = sanitizeSolAddress(recipient);
    const cleanSender = sanitizeSolAddress(solanaAddress);

    let recipientKey: PublicKey;
    let senderKey: PublicKey;
    try {
      recipientKey = new PublicKey(cleanRecipient);
    } catch {
      toast.error('Invalid recipient Solana address');
      return;
    }

    try {
      senderKey = new PublicKey(cleanSender);
    } catch {
      toast.error('Invalid sender Solana wallet address');
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const usdcAmountRaw = BigInt(Math.floor(parsedAmount * 1_000_000)); // USDC 6 decimals
    const solLamports = Math.floor(parsedAmount * 1_000_000_000); // SOL 9 decimals

    setSending(true);
    const toastId = toast.loading(`Sending ${asset}...`);

    try {
      console.log('[SolanaSend] start', {
        asset,
        recipient: cleanRecipient,
        amount,
        sender: cleanSender,
      });
      let solWallet: any;
      try {
        solWallet = await ensureSolanaSignerWallet();
        console.log('[SolanaSend] wallet detected', {
          walletClientType: (solWallet as any)?.walletClientType,
          chainType: (solWallet as any)?.chainType,
          chainId: (solWallet as any)?.chainId,
          hasSendTransaction: typeof (solWallet as any)?.sendTransaction === 'function',
          hasSignTransaction: typeof (solWallet as any)?.signTransaction === 'function',
        });
      } catch (walletErr: any) {
        const message = walletErr?.message || 'Solana wallet not available for signing. Please log out and log back in.';
        console.error('[SolanaSend] wallet detection failed', walletErr);
        setDebugInfo((prev) => `${prev} | wallet_err=${message}`);
        toast.error(message, { id: toastId });
        return;
      }
      const conn = createRpcConnection();
      const tx = new Transaction();

      if (asset === 'SOL') {
        if (solLamports <= 0) {
          throw new Error('Enter a valid SOL amount');
        }
        tx.add(
          SystemProgram.transfer({
            fromPubkey: senderKey,
            toPubkey: recipientKey,
            lamports: solLamports,
          })
        );
      } else {
        const sourceAta = await getAssociatedTokenAddress(USDC_MINT, senderKey);
        const destAta = await getAssociatedTokenAddress(USDC_MINT, recipientKey);
        const destInfo = await conn.getAccountInfo(destAta);
        if (!destInfo) {
          tx.add(createAssociatedTokenAccountIx(senderKey, destAta, recipientKey, USDC_MINT));
        }
        tx.add(createTransferIx(sourceAta, destAta, senderKey, usdcAmountRaw));
      }

      // Required for wallet signing/sending on most Solana wallet adapters.
      tx.feePayer = senderKey;
      console.log('[SolanaSend] fetching recent blockhash');
      const latest = await withTimeout(conn.getLatestBlockhash('confirmed'), 15000, 'Blockhash fetch');
      tx.recentBlockhash = latest.blockhash;
      console.log('[SolanaSend] blockhash ready', latest.blockhash);

      let txHash = '';
      const rpcUrl = resolveSolanaRpc();
      const signingChain = rpcUrl.includes('devnet') ? 'solana:devnet' : 'solana:mainnet';

      // Privy Solana standard wallets expect serialized bytes + explicit chain.
      const unsignedBytes = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      console.log('[SolanaSend] signing via useSignTransaction', { signingChain, bytes: unsignedBytes.length });
      const signedResult = await withTimeout(
        signSolanaTransaction({
          transaction: unsignedBytes,
          wallet: solWallet as any,
          chain: signingChain as any,
        }),
        60000,
        'Wallet signing'
      );
      const signedBytes = Buffer.from(signedResult.signedTransaction);

      console.log('[SolanaSend] broadcasting signed tx');
      txHash = await withTimeout(
        conn.sendRawTransaction(signedBytes, { skipPreflight: false, maxRetries: 3 }),
        30000,
        'Transaction broadcast'
      );
      console.log('[SolanaSend] tx hash', txHash);

      console.log('[SolanaSend] confirming tx');
      await withTimeout(
        conn.confirmTransaction(
          { signature: txHash, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
          'confirmed'
        ),
        60000,
        'Transaction confirmation'
      );

      toast.success(`${asset} transfer successful!`, { id: toastId });
      console.log('[SolanaSend] success');
      onTransactionRecorded?.({
        id: `solana-${txHash}`,
        walletId: cleanSender,
        txHash,
        txType: 'DEBIT',
        amount: asset === 'SOL' ? String(solLamports) : usdcAmountRaw.toString(),
        tokenSymbol: asset,
        tokenAddress: asset === 'SOL' ? 'solana-native' : 'solana-usdc',
        fromAddress: cleanSender,
        toAddress: cleanRecipient,
        status: 'CONFIRMED',
        description: `Solana ${asset} transfer`,
        createdAt: new Date().toISOString(),
      });
      if (solanaWalletId) {
        await hydrateRecentTransactions(solanaWalletId);
      }
      setRecipient('');
      setAmount('');
      setShowSend(false);
      setAsset('USDC');
      refreshBalances(solanaAddress);
    } catch (err: any) {
      console.error('Solana transfer failed:', err);
      const message = err?.message || 'Transfer failed';
      if (String(message).includes('429') || String(message).toLowerCase().includes('too many requests')) {
        toast.error('Solana devnet RPC is rate-limiting requests (429). Please retry in 20-60 seconds.', { id: toastId });
      } else {
        toast.error(message, { id: toastId });
      }
      setDebugInfo((prev) => `${prev} | send_err=${err?.message || 'unknown'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
      {!solanaAddress && (
        <div className="p-4 bg-yellow-50 text-yellow-800 text-xs border-b border-yellow-200">
          Solana wallet not detected. Debug: {debugInfo}
        </div>
      )}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Solana</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{solBalance.toFixed(4)}</h2>
                <span className="text-sm font-medium opacity-90">SOL</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">USDC</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{usdcBalance.toFixed(2)}</h2>
                <span className="text-sm font-medium opacity-90">USDC</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => refreshBalances(solanaAddress)}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all"
            title="Refresh balances"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] opacity-70 font-mono break-all">
          Wallet: {solanaAddress}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowSend(!showSend)}
            className="flex-1 py-2 px-4 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Assets
          </button>
        </div>

        {showSend && (
          <div className="mt-4 p-3 bg-black/10 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Token</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value as 'USDC' | 'SOL')}
                className="w-full mt-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm focus:outline-none focus:ring-1 focus:ring-white/50"
              >
                <option value="USDC" className="text-black">USDC</option>
                <option value="SOL" className="text-black">SOL</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(sanitizeSolAddress(e.target.value))}
                placeholder="Solana address"
                className="w-full mt-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-white/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Amount ({asset})</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.0"
                className="w-full mt-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-white/50"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full py-2 bg-white text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Send ${asset}`}
            </button>
            <p className="text-[11px] text-emerald-100/90">
              You need SOL for gas. Choose USDC for token transfer or SOL for native transfer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolanaWalletActivity;
