import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { WithdrawRequest, WalletBalance } from '../../types/wallet.types';
import { validateAptosAddress } from '../../utils/helpers';
import { SUPPORTED_ASSETS } from '../../utils/constants';
import toast from 'react-hot-toast';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (request: WithdrawRequest) => Promise<void>;
  balances: WalletBalance[];
  isLoading?: boolean;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  onWithdraw,
  balances,
  isLoading = false,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<'APT' | 'USDC'>('APT');
  const [estimatedFee, setEstimatedFee] = useState<string>('0.001');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    reset,
  } = useForm<WithdrawRequest>({
    mode: 'onChange',
  });

  const amount = watch('amount');
  const recipientAddress = watch('recipientAddress');

  // Get available balance for selected asset
  const selectedBalance = balances.find(b => b.asset === selectedAsset);
  const maxAmount = selectedBalance ? selectedBalance.balance : '0';

  const handleAssetChange = (asset: 'APT' | 'USDC') => {
    setSelectedAsset(asset);
    reset({ amount: '', recipientAddress: '' });
  };

  const setMaxAmount = () => {
    if (selectedBalance) {
      const maxAmountFormatted = (parseFloat(selectedBalance.balance) / Math.pow(10, selectedBalance.decimals)).toString();
      reset({ ...watch(), amount: maxAmountFormatted });
    }
  };

  const onSubmit = async (data: WithdrawRequest) => {
    try {
      const withdrawRequest: WithdrawRequest = {
        ...data,
        asset: selectedAsset,
        fee: estimatedFee,
      };

      await onWithdraw(withdrawRequest);
      toast.success('Withdrawal initiated successfully!');
      reset();
      onClose();
    } catch (error) {
      console.error('Withdrawal error:', error);
      // Error is already handled by the parent component
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Withdraw Funds
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Asset Selection */}
            <div>
              <label className="form-label">Asset</label>
              <div className="flex space-x-2">
                {(['APT', 'USDC'] as const).map((asset) => (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => handleAssetChange(asset)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAsset === asset
                        ? 'bg-cto-purple text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {asset}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Balance */}
            {selectedBalance && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Available:</span>{' '}
                  {(parseFloat(selectedBalance.balance) / Math.pow(10, selectedBalance.decimals)).toFixed(6)} {selectedBalance.symbol}
                </p>
              </div>
            )}

            {/* Recipient Address */}
            <div>
              <label htmlFor="recipientAddress" className="form-label">
                Recipient Address
              </label>
              <input
                id="recipientAddress"
                type="text"
                className={`input-field ${errors.recipientAddress ? 'border-red-500' : ''}`}
                placeholder="0x..."
                {...register('recipientAddress', {
                  required: 'Recipient address is required',
                  validate: (value) => validateAptosAddress(value) || 'Please enter a valid Aptos address',
                })}
              />
              {errors.recipientAddress && (
                <p className="error-text">{errors.recipientAddress.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="form-label">
                Amount
              </label>
              <div className="relative">
                <input
                  id="amount"
                  type="number"
                  step="any"
                  className={`input-field pr-20 ${errors.amount ? 'border-red-500' : ''}`}
                  placeholder="0.00"
                  {...register('amount', {
                    required: 'Amount is required',
                    min: { value: 0.000001, message: 'Amount must be greater than 0' },
                    validate: (value) => {
                      if (!selectedBalance) return true;
                      const maxAmountFormatted = parseFloat(selectedBalance.balance) / Math.pow(10, selectedBalance.decimals);
                      return parseFloat(value) <= maxAmountFormatted || `Amount cannot exceed available balance`;
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={setMaxAmount}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                >
                  MAX
                </button>
              </div>
              {errors.amount && (
                <p className="error-text">{errors.amount.message}</p>
              )}
            </div>

            {/* Estimated Fee */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Estimated Fee:</span> {estimatedFee} APT
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary flex-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || isLoading}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  'Confirm Withdrawal'
                )}
              </button>
            </div>
          </form>

          {/* Warning */}
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  Please double-check the recipient address. Transactions cannot be reversed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
