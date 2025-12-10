export interface CircleWallet {
  id: string;
  address: string;
  type: 'USER_CONTROLLED';
  blockchain: 'APTOS';
  description?: string;
  createdAt: string;
  userId: string;
}

export interface WalletBalance {
  asset: string;
  balance: string;
  decimals: number;
  symbol: string;
  usdValue: string;
}

export interface WalletState {
  wallet: CircleWallet | null;
  balances: WalletBalance[];
  isLoading: boolean;
  error: string | null;
}

export interface Transaction {
  id: string;
  type: 'withdrawal' | 'deposit' | 'mock' | 'unknown';
  hash: string | null;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  currency?: string; // For Circle API compatibility
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  fee: string;
  description?: string; // For Circle API compatibility
}

export interface WithdrawRequest {
  recipientAddress: string;
  amount: string;
  asset: 'APT' | 'USDC';
  fee?: string;
}

export interface CircleConfig {
  appId: string;
  apiKey: string;
  environment: 'sandbox' | 'production';
  apiBase: string;
  blockchain: 'APTOS';
  walletType: 'USER_CONTROLLED';
}

export interface QRCodeData {
  address: string;
  amount?: string;
  asset?: string;
}
