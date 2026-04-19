import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { privyService } from '../../services/privyService';
import { movementPaymentService } from '../../services/movementPaymentService';
import solanaPaymentService from '../../services/solanaPaymentService';
import solanaWalletService from '../../services/solanaWalletService';
import { getMovementWallet, sendMovementTransaction } from '../../lib/movement-wallet';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import toast from 'react-hot-toast';

interface ListingPaymentProps {
  listingId: string;
  listingTitle: string;
  chain?: string;
  onPaymentComplete?: () => void;
  onCancel?: () => void;
}

export const ListingPayment: React.FC<ListingPaymentProps> = ({
  listingId,
  listingTitle,
  chain,
  onPaymentComplete,
  onCancel,
}) => {
  const navigate = useNavigate();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { signRawHash } = useSignRawHash();
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [movementTxHash, setMovementTxHash] = useState<string | null>(null);
  const [solanaTxHash, setSolanaTxHash] = useState<string | null>(null);
  const [solanaBalance, setSolanaBalance] = useState<number | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [paymentChain, setPaymentChain] = useState<'MOVEMENT' | 'SOLANA'>('MOVEMENT');

  const userId = localStorage.getItem('cto_user_email') || '';
  const isPrivyUser = authenticated && user;
  const isSolana = paymentChain === 'SOLANA';

  useEffect(() => {
    if (!isSolana) return;
    const solWallet =
      wallets.find((w) => (w as any).chainType === 'solana') ||
      wallets.find((w) => w.chainId === 'solana:mainnet' || w.chainId === 'solana:devnet') ||
      wallets.find((w) => w.walletClientType === 'solana' || (w as any).coinType === 501) ||
      wallets.find((w) => {
        const addr = w.address || '';
        return addr.length >= 32 && addr.length <= 44 && !addr.startsWith('0x');
      });
    if (!solWallet?.address) return;

    setSolanaAddress(solWallet.address);
    solanaWalletService
      .getBalance(solWallet.address)
      .then((data) => {
        if (typeof data?.usdc === 'number') setSolanaBalance(data.usdc);
      })
      .catch(() => null);
  }, [isSolana, wallets]);

  const getSolanaWallet = () => {
    const solWallet =
      wallets.find((w) => (w as any).chainType === 'solana') ||
      wallets.find((w) => w.chainId === 'solana:mainnet' || w.chainId === 'solana:devnet') ||
      wallets.find((w) => w.walletClientType === 'solana' || (w as any).coinType === 501) ||
      wallets.find((w) => {
        const addr = w.address || '';
        return addr.length >= 32 && addr.length <= 44 && !addr.startsWith('0x');
      });
    if (!solWallet) {
      throw new Error('No Solana wallet found. Please enable Solana in Privy and connect a Solana wallet.');
    }
    return solWallet;
  };

  const decodeBase64 = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const handlePayment = async () => {
    if (!userId) {
      toast.error('Please login first');
      return;
    }

    setLoading(true);
    try {
      if (isSolana) {
        console.log('Using Solana payment flow');

        if (!isPrivyUser) {
          toast.error('Privy session not found. Please log out and log back in.');
          setLoading(false);
          return;
        }

        let solanaWallet;
        try {
          solanaWallet = getSolanaWallet();
        } catch (walletError: any) {
          toast.error(walletError?.message || 'No Solana wallet found.');
          setLoading(false);
          return;
        }

        const paymentResult = await solanaPaymentService.createListingPayment(listingId);
        const paymentData = paymentResult?.data || paymentResult;
        if (!paymentData?.success) {
          throw new Error(paymentData?.message || 'Failed to create payment');
        }

        setPaymentId(paymentData.paymentId);
        toast.success('Signing transaction with Privy Solana wallet...');

        const txBase64 = paymentData.transaction;
        if (!txBase64) {
          throw new Error('Transaction data missing');
        }

        let signedTx: any;
        const txBytes = decodeBase64(txBase64);
        try {
          const versioned = VersionedTransaction.deserialize(txBytes);
          if ('signTransaction' in solanaWallet && typeof (solanaWallet as any).signTransaction === 'function') {
            signedTx = await (solanaWallet as any).signTransaction(versioned);
          } else if ((solanaWallet as any).provider?.signTransaction) {
            signedTx = await (solanaWallet as any).provider.signTransaction(versioned);
          } else {
            throw new Error('Solana wallet signing not available.');
          }
        } catch {
          const legacy = Transaction.from(txBytes);
          if ('signTransaction' in solanaWallet && typeof (solanaWallet as any).signTransaction === 'function') {
            signedTx = await (solanaWallet as any).signTransaction(legacy);
          } else if ((solanaWallet as any).provider?.signTransaction) {
            signedTx = await (solanaWallet as any).provider.signTransaction(legacy);
          } else {
            throw new Error('Solana wallet signing not available.');
          }
        }

        const connection = new Connection(
          process.env.REACT_APP_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
          'confirmed'
        );
        const raw = signedTx.serialize();
        const txHash = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
        await connection.confirmTransaction(txHash, 'confirmed');

        setSolanaTxHash(txHash);
        toast.success('Transaction submitted! Verifying payment...');

        const verifyResult = await solanaPaymentService.verifyPayment(paymentData.paymentId, txHash);
        const verifyData = verifyResult?.data || verifyResult;
        if (verifyData?.success && verifyData?.payment?.status === 'COMPLETED') {
          toast.success('Payment confirmed! Listing is now published!');
          if (onPaymentComplete) onPaymentComplete();
          setTimeout(() => navigate('/user-listings/mine'), 2000);
        } else {
          toast.error('Payment verification failed. Please try again.');
        }

        setLoading(false);
        return;
      }

      console.log('Using Movement payment flow');

      // Ensure user is actually logged in with Privy
      if (!isPrivyUser) {
        toast.error('Privy session not found. Please log out and log back in.');
        setLoading(false);
        return;
      }

      // Check if user has Movement wallet
      let movementWallet = getMovementWallet(user);

      // --- RESILIENCE: If frontend doesn't see it, check the backend/DB ---
      if (!movementWallet) {
        console.log('Wallet not in Privy object, checking backend DB...');
        try {
          const walletResult = await privyService.getUserWallets();
          const wallets = walletResult?.data?.wallets || walletResult?.wallets || [];
          const dbWallet = wallets.find((w: any) =>
            w.blockchain?.toUpperCase() === 'MOVEMENT' ||
            w.blockchain?.toUpperCase() === 'APTOS'
          );

          if (dbWallet) {
            console.log('Found wallet in DB:', dbWallet.address);
            // Use the DB wallet details as a fallback
            movementWallet = {
              address: dbWallet.address,
              publicKey: dbWallet.publicKey || dbWallet.address, // Fallback if pubkey missing
              chainType: 'aptos'
            };
          }
        } catch (e) {
          console.warn('Backend wallet check failed', e);
        }
      }

      if (!movementWallet) {
        toast.error('No Movement wallet found. Please go to Profile and click "Sync Wallets".');
        setLoading(false);
        return;
      }

      try {
        const result = await movementPaymentService.createListingPayment(listingId);

        // Handle wrapped response
        const paymentData = result?.data || result;

        if (!paymentData?.success) {
          throw new Error(paymentData?.message || 'Failed to create payment');
        }

        console.log('Movement payment data received:', paymentData);
        toast.success('Signing transaction with Privy Movement wallet...');
        setPaymentId(paymentData.paymentId);

        // Send Movement transaction using Aptos SDK and Privy signing
        // Movement uses Aptos-compatible transaction format
        const transactionData = paymentData.transactionData;

        try {
          // Get wallet public key
          const publicKey = movementWallet.publicKey || movementWallet.public_key;
          if (!publicKey) {
            throw new Error('Public key not found in Movement wallet');
          }

          // Send Movement transaction using helper function
          const txHash = await sendMovementTransaction(
            transactionData,
            movementWallet.address,
            publicKey,
            signRawHash
          );

          console.log('Movement transaction sent:', txHash);
          toast.success('Transaction submitted! Verifying payment...');
          setMovementTxHash(txHash);

          // Verify payment
          setTimeout(async () => {
            try {
              const verifyResult = await movementPaymentService.verifyPayment(
                paymentData.paymentId,
                txHash
              );

              // Handle wrapped response
              const verifyData = verifyResult?.data || verifyResult;

              if (verifyData?.success && verifyData?.payment?.status === 'COMPLETED') {
                toast.success('Payment confirmed! Listing is now published!');
                setLoading(false);
                if (onPaymentComplete) onPaymentComplete();
                setTimeout(() => {
                  navigate('/user-listings/mine');
                }, 2000);
              } else {
                toast.error('Payment verification failed. Please try again.');
                setLoading(false);
              }
            } catch (verifyError: any) {
              console.error('Payment verification failed:', verifyError);
              toast.error(verifyError?.message || 'Failed to verify payment');
              setLoading(false);
            }
          }, 5000);
        } catch (txError: any) {
          console.error('Movement transaction failed:', txError);
          toast.error(txError?.message || 'Transaction cancelled or failed');
          setPaymentId(null);
          setMovementTxHash(null);
          setLoading(false);
          return;
        }
      } catch (error: any) {
        console.error('Movement payment creation failed:', error);

        // Always clear loading state
        setLoading(false);
        setPaymentId(null);

        // Extract error message from response
        let errorMsg = 'Payment creation failed. Please try again.';
        if (error?.response?.data) {
          const data = error.response.data;
          errorMsg = data.message || data.error || (data.data?.message) || (typeof data === 'string' ? data : errorMsg);
        } else if (error?.message) {
          errorMsg = error.message;
        }

        // Show the RAW error message from the backend so we can see User ID/Wallet counts
        toast.error(errorMsg, { duration: 6000 });
        return;
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Payment failed';
      toast.error(`Payment failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (payId: string) => {
    if (isSolana) {
      if (!solanaTxHash) {
        toast.error('Transaction hash not found. Please try the payment again.');
        return;
      }
      setVerifying(true);
      try {
        const result = await solanaPaymentService.verifyPayment(payId, solanaTxHash);
        if (result.payment?.status === 'COMPLETED') {
          toast.success('Payment confirmed! Listing is now published!');
          if (onPaymentComplete) onPaymentComplete();
          setTimeout(() => navigate('/user-listings/mine'), 2000);
        } else if (result.payment?.status === 'FAILED') {
          toast.error('Payment failed. Please try again.');
        } else {
          toast.loading('Payment still processing. Please check back in a few minutes.');
        }
      } catch (error: any) {
        console.error('Verification failed:', error);
        toast.error('Failed to verify payment');
      } finally {
        setVerifying(false);
      }
      return;
    }

    if (!movementTxHash) {
      toast.error('Transaction hash not found. Please try the payment again.');
      return;
    }
    setVerifying(true);
    try {
      const result = await movementPaymentService.verifyPayment(payId, movementTxHash);
      
      if (result.payment?.status === 'COMPLETED') {
        toast.success('Payment confirmed! Listing is now published!');
        if (onPaymentComplete) onPaymentComplete();
        setTimeout(() => {
          navigate('/user-listings/mine');
        }, 2000);
      } else if (result.payment?.status === 'FAILED') {
        toast.error('Payment failed. Please try again.');
      } else {
        toast.loading('Payment still processing. Please check back in a few minutes.');
      }
    } catch (error: any) {
      console.error('Verification failed:', error);
      toast.error('Failed to verify payment');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Pay for Listing
        </h2>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <p className="text-sm text-blue-700">
            <strong>Listing:</strong> {listingTitle}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Listing Fee:</span>
            <span className="text-2xl font-bold text-gray-800">
              1.0 {isSolana ? 'USDC' : 'USDC.e'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This payment will publish your listing on the marketplace.
          </p>
        </div>

        {!paymentId ? (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="font-semibold text-gray-700 mb-2">Payment Method</p>
              <label className="flex items-center gap-2 text-gray-700 mb-2">
                <input
                  type="radio"
                  name="listing-payment-chain"
                  value="MOVEMENT"
                  checked={paymentChain === 'MOVEMENT'}
                  onChange={() => setPaymentChain('MOVEMENT')}
                  disabled={loading}
                />
                Fund with USDC.e (Movement)
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="listing-payment-chain"
                  value="SOLANA"
                  checked={paymentChain === 'SOLANA'}
                  onChange={() => setPaymentChain('SOLANA')}
                  disabled={loading}
                />
                Fund with USDC (Solana)
              </label>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                `Pay 1.0 ${isSolana ? 'USDC' : 'USDC.e'}`
              )}
            </button>

            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <p className="text-sm text-yellow-700">
                <strong>Payment initiated!</strong> Waiting for blockchain confirmation...
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                Payment ID: {paymentId.substring(0, 20)}...
              </p>
            </div>

            <button
              onClick={() => verifyPayment(paymentId)}
              disabled={verifying}
              className="w-full bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {verifying ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                'Check Payment Status'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              ⏱️ Payments confirm instantly on {isSolana ? 'Solana' : 'Movement'}. 
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <strong>Note:</strong> Ensure you have at least 1.0 {isSolana ? 'USDC' : 'USDC.e'} in your {isSolana ? 'Solana' : 'Movement'} wallet. {isSolana ? ' You will also need a tiny amount of SOL for gas.' : ' You will also need a tiny amount of MOVE for gas.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ListingPayment;

