import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { paymentService } from '../../services/paymentService';
import { privyService } from '../../services/privyService';
import { privyPaymentService } from '../../services/privyPaymentService';
import { movementPaymentService } from '../../services/movementPaymentService';
import { getMovementWallet, sendMovementTransaction } from '../../lib/movement-wallet';
import toast from 'react-hot-toast';

interface ListingPaymentProps {
  listingId: string;
  listingTitle: string;
  onPaymentComplete?: () => void;
  onCancel?: () => void;
}

export const ListingPayment: React.FC<ListingPaymentProps> = ({
  listingId,
  listingTitle,
  onPaymentComplete,
  onCancel,
}) => {
  const navigate = useNavigate();
  const { authenticated, user, sendTransaction } = usePrivy();
  const { signRawHash } = useSignRawHash();
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<number>(50);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>('base');
  const [paymentMethod, setPaymentMethod] = useState<'movement' | 'evm' | 'circle'>('movement');

  const userId = localStorage.getItem('cto_user_email') || '';
  const userIdNum = parseInt(localStorage.getItem('cto_user_id') || '0');
  const isPrivyUser = authenticated && user;

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const data = await paymentService.getPricing();
      // Safe access to pricing data
      if (data?.pricing?.listing !== undefined) {
        setPricing(data.pricing.listing);
      }
    } catch (error) {
      console.error('Failed to load pricing:', error);
      // Keep default pricing (50) if fetch fails
    }
  };

  const handlePayment = async () => {
    if (!userId) {
      toast.error('Please login first');
      return;
    }

    setLoading(true);
    try {
      // Movement payment flow (preferred for user listings)
      if (paymentMethod === 'movement') {
        console.log('💳 Using Movement payment flow');
        
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
          console.log('🔍 Wallet not in Privy object, checking backend DB...');
          try {
            const walletResult = await privyService.getUserWallets();
            const wallets = walletResult?.data?.wallets || walletResult?.wallets || [];
            const dbWallet = wallets.find((w: any) => 
              w.blockchain?.toUpperCase() === 'MOVEMENT' || 
              w.blockchain?.toUpperCase() === 'APTOS'
            );
            
            if (dbWallet) {
              console.log('✅ Found wallet in DB:', dbWallet.address);
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

          console.log('✅ Movement payment data received:', paymentData);
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

            console.log('✅ Movement transaction sent:', txHash);
            toast.success('Transaction submitted! Verifying payment...');

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
      }
      // EVM Privy payment flow (for other chains)
      else if (paymentMethod === 'evm' && isPrivyUser && userIdNum > 0) {
        console.log('💳 Using Privy EVM payment flow');
        
        const result = await privyPaymentService.payForListing({
          userId: userIdNum,
          listingId,
          chain: selectedChain,
        });

        if (result.success) {
          console.log('✅ Transaction data received:', result.transactionData);
          toast.success('Signing transaction with Privy...');
          setPaymentId(result.paymentId);

          // Send transaction using Privy
          try {
            const txReceipt = await sendTransaction(result.transactionData.evmTransactionData);
            console.log('✅ Transaction sent:', txReceipt);
            
            toast.success('Transaction submitted! Verifying...');
            
            // Verify payment
            setTimeout(() => {
              verifyPayment(result.paymentId);
            }, 5000);
          } catch (txError: any) {
            console.error('Transaction failed:', txError);
            toast.error('Transaction cancelled or failed');
            setLoading(false);
            return;
          }
        }
      } 
      // Circle payment flow (legacy)
      else {
        console.log('💳 Using Circle payment flow');
        
        const result = await paymentService.payForListing({
          userId,
          listingId,
        });

        if (result.success) {
          toast.success('Payment initiated! Waiting for confirmation...');
          setPaymentId(result.paymentId);
          
          setTimeout(() => {
            verifyPayment(result.paymentId);
          }, 10000);
        }
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
    setVerifying(true);
    try {
      let result;
      if (isPrivyUser) {
        result = await privyPaymentService.verifyPayment(payId);
      } else {
        result = await paymentService.verifyPayment(payId, userId);
      }
      
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
              {paymentMethod === 'movement' ? '1 MOVE' : `$${pricing} USDC`}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This payment will publish your listing on the marketplace.
          </p>
        </div>

        {!paymentId ? (
          <div className="space-y-3">
            {isPrivyUser && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'movement' | 'evm' | 'circle')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="movement">Movement (1 MOVE) - Recommended</option>
                    <option value="evm">EVM Chains (USDC)</option>
                    <option value="circle">Circle Wallet (USDC)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {paymentMethod === 'movement' 
                      ? 'Pay with Movement test tokens using your Privy Movement wallet.'
                      : paymentMethod === 'evm'
                      ? 'Pay with USDC on EVM chains (Base, Polygon, etc.)'
                      : 'Pay with USDC from your Circle wallet.'}
                  </p>
                </div>
                
                {paymentMethod === 'evm' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Chain for Payment
                    </label>
                    <select
                      value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="base">Base (Recommended)</option>
                      <option value="polygon">Polygon</option>
                      <option value="ethereum">Ethereum</option>
                      <option value="arbitrum">Arbitrum</option>
                      <option value="optimism">Optimism</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose which chain to pay from. Base has lowest fees.
                    </p>
                  </div>
                )}
              </>
            )}
            
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
                paymentMethod === 'movement' ? 'Pay 1 MOVE' : `Pay $${pricing} USDC`
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
              ⏱️ Payments typically confirm within 5-15 minutes
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <strong>Note:</strong> {
              paymentMethod === 'movement' 
                ? 'Ensure you have at least 1 MOVE in your Movement wallet. Payment will be made from your Privy Movement wallet.'
                : paymentMethod === 'evm'
                ? `Ensure you have at least ${pricing} USDC in your ${selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)} wallet. Payment will be made from your Privy ${selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)} wallet.`
                : `Ensure you have at least ${pricing} USDC in your wallet. The payment will be deducted from your Circle wallet.`
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default ListingPayment;

