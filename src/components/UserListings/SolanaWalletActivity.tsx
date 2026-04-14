import React, { useEffect, useState } from 'react';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import toast from 'react-hot-toast';
import solanaWalletService from '../../services/solanaWalletService';

const SOLANA_RPC = process.env.REACT_APP_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

// USDC mint (Solana mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

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

export const SolanaWalletActivity: React.FC = () => {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [solanaAddress, setSolanaAddress] = useState<string>('');
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const getSolanaWallet = () => {
    const solWallet =
      wallets.find((w) => (w as any).chainType === 'solana') ||
      wallets.find((w) => w.chainId === 'solana:mainnet' || w.chainId === 'solana:devnet') ||
      wallets.find((w) => (w as any).walletClientType === 'solana' || (w as any).coinType === 501) ||
      wallets.find((w) => {
        const addr = (w as any).address || '';
        return addr.length >= 32 && addr.length <= 44 && !addr.startsWith('0x');
      });
    if (!solWallet) throw new Error('No Solana wallet found. Connect a Solana wallet in Privy.');
    return solWallet;
  };

  const refreshBalances = async (address: string) => {
    try {
      const usdc = await solanaWalletService.getBalance(address);
      if (typeof usdc?.usdc === 'number') setUsdcBalance(usdc.usdc);
    } catch {
      // ignore
    }
    try {
      const lamports = await connection.getBalance(new PublicKey(address));
      setSolBalance(lamports / 1e9);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const solWallet = getSolanaWallet();
      const addr = (solWallet as any)?.address || '';
      setDebugInfo(
        `wallets=${wallets.length} | detected=${addr || 'none'} | first=${(wallets[0] as any)?.address || 'n/a'}`
      );
      if (addr) {
        setSolanaAddress(addr);
        refreshBalances(addr);
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
        setSolanaAddress(addr);
        refreshBalances(addr);
      }
    }
  }, [wallets, user]);

  const handleSend = async () => {
    if (!recipient || !amount) {
      toast.error('Please enter recipient and amount');
      return;
    }

    let recipientKey: PublicKey;
    let senderKey: PublicKey;
    try {
      recipientKey = new PublicKey(recipient);
      senderKey = new PublicKey(solanaAddress);
    } catch {
      toast.error('Invalid Solana address');
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const amountRaw = BigInt(Math.floor(parsedAmount * 1_000_000)); // USDC 6 decimals

    setSending(true);
    const toastId = toast.loading('Sending USDC...');

    try {
      let solWallet: any;
      try {
        solWallet = getSolanaWallet();
      } catch {
        toast.error('Solana wallet not available for signing. Please log out and log back in.');
        return;
      }
      const sourceAta = await getAssociatedTokenAddress(USDC_MINT, senderKey);
      const destAta = await getAssociatedTokenAddress(USDC_MINT, recipientKey);

      const destInfo = await connection.getAccountInfo(destAta);

      const tx = new Transaction();
      if (!destInfo) {
        tx.add(createAssociatedTokenAccountIx(senderKey, destAta, recipientKey, USDC_MINT));
      }
      tx.add(createTransferIx(sourceAta, destAta, senderKey, amountRaw));

      let signedTx: any;
      if ('signTransaction' in solWallet && typeof (solWallet as any).signTransaction === 'function') {
        signedTx = await (solWallet as any).signTransaction(tx);
      } else if ((solWallet as any).provider?.signTransaction) {
        signedTx = await (solWallet as any).provider.signTransaction(tx);
      } else {
        throw new Error('Solana wallet signing not available.');
      }

      const raw = signedTx.serialize();
      const txHash = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(txHash, 'confirmed');

      toast.success('USDC transfer successful!', { id: toastId });
      setRecipient('');
      setAmount('');
      setShowSend(false);
      refreshBalances(solanaAddress);
    } catch (err: any) {
      console.error('Solana transfer failed:', err);
      toast.error(err?.message || 'Transfer failed', { id: toastId });
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
            Send USDC
          </button>
        </div>

        {showSend && (
          <div className="mt-4 p-3 bg-black/10 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Solana address"
                className="w-full mt-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-white/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Amount (USDC)</label>
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
              {sending ? 'Sending...' : 'Confirm Transfer'}
            </button>
            <p className="text-[11px] text-emerald-100/90">
              You need a small amount of SOL for gas. USDC transfers will use your Solana USDC balance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolanaWalletActivity;
