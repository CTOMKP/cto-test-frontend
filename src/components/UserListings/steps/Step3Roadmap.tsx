import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { ROUTES } from '../../../utils/constants';
import userListingsService from '../../../services/userListingsService';
import { movementPaymentService } from '../../../services/movementPaymentService';
import { getMovementWallet, sendMovementTransaction } from '../../../lib/movement-wallet';
import toast from 'react-hot-toast';

interface Step3RoadmapProps {
  draftListingId: string | null;
  onPublishComplete?: () => void;
  setCurrentStep: (step: number) => void;
}

export default function Step3Roadmap({
  draftListingId,
  onPublishComplete,
  setCurrentStep,
}: Step3RoadmapProps) {
  const navigate = useNavigate();
  const { authenticated, user } = usePrivy();
  const { signRawHash } = useSignRawHash();
  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [roadmapDescription, setRoadmapDescription] = useState('');
  const [roadmapLinks, setRoadmapLinks] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Load draft ID from localStorage if not provided
  useEffect(() => {
    if (!draftListingId) {
      const savedDraftId = localStorage.getItem('cto_draft_listing_id');
      // Draft ID will be used from localStorage in handlePublish
    }
  }, [draftListingId]);

  /**
   * Handle Movement payment flow
   */
  const handleMovementPayment = async (listingId: string): Promise<boolean> => {
    let loadingToast: string | undefined;
    try {
      setProcessingPayment(true);

      // Check if user has Movement wallet
      if (!authenticated || !user) {
        toast.error('Please login with Privy to make payment');
        return false;
      }

      const movementWallet = getMovementWallet(user);
      if (!movementWallet) {
        toast.error('No Movement wallet found. Please ensure your Privy wallet is connected to Movement network.');
        return false;
      }

      // Create Movement payment
      loadingToast = toast.loading('Creating payment...');
      
      let paymentResult;
      try {
        paymentResult = await movementPaymentService.createListingPayment(listingId);
      } catch (createError: any) {
        // Dismiss loading toast immediately on error
        toast.dismiss(loadingToast);
        const errorMsg = createError?.response?.data?.message || createError?.message || 'Failed to create payment';
        toast.error(errorMsg);
        return false;
      }
      
      // Dismiss loading toast after successful creation
      toast.dismiss(loadingToast);

      // Handle wrapped response
      const paymentData = paymentResult?.data || paymentResult;

      if (!paymentData?.success) {
        toast.error(paymentData?.message || 'Failed to create payment');
        return false;
      }

      toast.success('Payment created! Signing transaction...');
      setPaymentId(paymentData.paymentId);

      // Sign and send transaction using Privy and Aptos SDK
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

        // Wait a bit for transaction to be processed, then verify
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify payment with backend
        try {
          const verifyResult = await movementPaymentService.verifyPayment(
            paymentData.paymentId,
            txHash
          );

          // Handle wrapped response
          const verifyData = verifyResult?.data || verifyResult;

          if (verifyData?.success && verifyData?.payment?.status === 'COMPLETED') {
            toast.success('Payment verified!');
            return true;
          } else {
            throw new Error('Payment verification failed');
          }
        } catch (verifyError: any) {
          console.error('Payment verification failed:', verifyError);
          toast.error(verifyError?.message || 'Payment verification failed. Please try again.');
          return false;
        }
      } catch (txError: any) {
        console.error('Transaction failed:', txError);
        const errorMsg = txError?.message || 'Transaction cancelled or failed';
        toast.error(errorMsg);
        setPaymentId(null);
        return false;
      }
    } catch (error: any) {
      // This catch handles any unexpected errors not caught above
      console.error('Unexpected payment error:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Payment failed';
      toast.error(errorMsg);
      setPaymentId(null);
      return false;
    } finally {
      setProcessingPayment(false);
      // Ensure any lingering loading toasts are dismissed
      if (loadingToast !== undefined) {
        toast.dismiss(loadingToast);
      }
    }
  };

  const handlePublish = async () => {
    const currentDraftId = draftListingId || localStorage.getItem('cto_draft_listing_id');

    if (!currentDraftId) {
      toast.error('No draft listing found. Please go back and complete the previous steps.');
      return;
    }

    try {
      setLoading(true);

      // Update draft with roadmap data (append to description)
      const roadmapText =
        roadmapTitle || roadmapDescription || roadmapLinks
          ? `\n\nRoadmap:\n${roadmapTitle ? `Title: ${roadmapTitle}\n` : ''}${
              roadmapDescription ? `${roadmapDescription}\n` : ''
            }${roadmapLinks ? `Links: ${roadmapLinks}` : ''}`
          : '';

      if (roadmapText) {
        try {
          // Get current listing to append roadmap to description
          const currentListing = await userListingsService.getMyListing(currentDraftId);
          const currentDescription = currentListing?.data?.description || currentListing?.description || '';
          const updatedDescription = currentDescription + roadmapText;

          await userListingsService.update(currentDraftId, {
            description: updatedDescription,
          });
        } catch (updateError: any) {
          // If draft doesn't exist (404), clear stale ID
          if (updateError?.response?.status === 404) {
            localStorage.removeItem('cto_draft_listing_id');
            toast.error('Draft expired. Please create a new listing from the beginning.');
            return;
          }
          console.error('Failed to update draft with roadmap:', updateError);
        }
      }

      // Step 1: Save draft with roadmap (don't try to publish yet)
      // The draft is already saved, we just updated it with roadmap
      // Now redirect to My Listings where user can pay
      toast.success('Draft saved! Complete payment from My Listings to publish.', { icon: '💾' });
      
      setTimeout(() => {
        navigate(ROUTES.myUserListings);
      }, 1500);
      
      setLoading(false);
      if (onPublishComplete) {
        onPublishComplete();
      }
      return;
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message || error?.message || 'Publish failed';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div>
        <label htmlFor="roadmap-title" className="font-medium">
          Roadmap Title
        </label>
        <input
          id="roadmap-title"
          type="text"
          placeholder='Ex "Aptos NFT Artist for Hire"...'
          className="bg-white/5 border-[0.2px] h-12 mt-4 rounded-lg border-white/20 w-full px-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={roadmapTitle}
          onChange={(e) => setRoadmapTitle(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="roadmap-description" className="font-medium">
          Roadmap Description
        </label>
        <textarea
          id="roadmap-description"
          placeholder="Explain what you're offering or what you're looking for..."
          className="bg-white/5 border-[0.2px] h-auto mt-4 rounded-lg border-white/20 p-3 w-full text-white placeholder:text-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
          rows={5}
          value={roadmapDescription}
          onChange={(e) => setRoadmapDescription(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="roadmap-links" className="font-medium">
          Additional links (<span className="text-white/50">Optional</span>)
        </label>
        <input
          id="roadmap-links"
          type="text"
          placeholder="https://..., https://... (comma separated)"
          className="bg-white/5 border-[0.2px] h-12 mt-4 rounded-lg border-white/20 w-full px-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={roadmapLinks}
          onChange={(e) => setRoadmapLinks(e.target.value)}
        />
      </div>

      {/* Payment Info Notice */}
      <div className="bg-blue-500/20 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-blue-300">
          <strong>💡 Next Step:</strong> After clicking submit, you'll be redirected
          to pay with Movement test tokens to publish your listing.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-4 py-2 border border-white/20 text-white/70 rounded-lg hover:bg-white/5 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handlePublish}
          disabled={loading || !draftListingId}
          className="font-medium flex-1 gap-2 bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] rounded-lg h-9 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? 'Saving...' : 'Save Draft (Payment Required Next)'}
        </button>
      </div>
    </div>
  );
}



