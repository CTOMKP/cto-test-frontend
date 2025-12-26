/**
 * Movement Network wallet utilities using Privy
 * Based on reference implementation from Movement-Network-ConnectWallet-Template
 */

import {
  useSignRawHash,
} from "@privy-io/react-auth/extended-chains";
import type { CurveSigningChainType } from "@privy-io/api-types";
import { toHex } from "viem";

// Types for Privy's signRawHash function (not exported from the module)
interface SignRawHashInput {
  address: string;
  chainType: CurveSigningChainType;
  hash: `0x${string}`;
}

interface SignRawHashOutput {
  signature: `0x${string}`;
}
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
  RawTransaction,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";

/**
 * Create a Movement wallet using Privy
 * Movement wallets are created with chainType: 'aptos' (Aptos-compatible)
 * @param privyUser - The authenticated Privy user
 * @param createWallet - The createWallet function from useCreateWallet hook
 */
export async function createMovementWallet(privyUser: any, createWallet: any) {
  try {
    // First check if user already has a Movement wallet
    // Movement wallets are detected as chainType === 'aptos'
    const existingWallet = privyUser.linkedAccounts?.find(
      (account: any) => account.type === 'wallet' && account.chainType === 'aptos'
    );
    
    if (existingWallet) {
      return {
        id: existingWallet.id,
        address: existingWallet.address,
        public_key: existingWallet.publicKey,
        chain_type: existingWallet.chainType
      };
    }

    // Create Movement wallet using Privy
    // Movement Network uses Aptos-compatible wallet format
    const wallet = await createWallet({
      chainType: 'aptos',
    });
    
    return wallet;
  } catch (error) {
    console.error('Error creating Movement wallet:', error);
    throw error;
  }
}

/**
 * Hook to sign transactions using Privy for Movement Network
 */
export function useSignWithPrivy() {
  const { signRawHash } = useSignRawHash();

  const signHash = async (walletAddress: string, hash: any) => {
    try {
      const { signature: rawSignature } = await signRawHash({
        address: walletAddress,
        chainType: "aptos", // Movement uses Aptos-compatible signing
        hash: toHex(hash),
      });
      return {
        data: {
          signature: rawSignature
        }
      };
    } catch (error) {
      console.error('Error signing with Privy:', error);
      throw error;
    }
  };

  return { signHash };
}

/**
 * Get Movement wallet from Privy user
 */
export function getMovementWallet(privyUser: any) {
  if (!privyUser?.linkedAccounts) {
    return null;
  }

  // Movement wallets are detected as chainType === 'aptos'
  return privyUser.linkedAccounts.find(
    (account: any) => account.type === 'wallet' && account.chainType === 'aptos'
  );
}

/**
 * Send Movement transaction using Privy signing
 * @param transactionData - Transaction data from backend (Aptos format)
 * @param walletAddress - Movement wallet address from Privy
 * @param publicKey - Public key from Privy wallet
 * @param signRawHash - Privy's signRawHash function
 * @returns Transaction hash
 */
export async function sendMovementTransaction(
  transactionData: {
    type: string;
    function: string;
    type_arguments: string[];
    arguments: string[];
  },
  walletAddress: string,
  publicKey: string,
  signRawHash: (input: SignRawHashInput) => Promise<SignRawHashOutput>
): Promise<string> {
  try {
    // Initialize Movement client (uses Movement Bardock)
    // STRATEGIC FIX: Use Network.CUSTOM instead of Network.TESTNET
    // This prevents the BAD_CHAIN_ID error by forcing the SDK to fetch the correct Chain ID from the node.
    const movementConfig = new AptosConfig({
      network: Network.CUSTOM,
      fullnode: process.env.REACT_APP_MOVEMENT_NODE_URL || 'https://testnet.movementnetwork.xyz/v1',
    });
    const movement = new Aptos(movementConfig);

    // Convert address to AccountAddress
    const senderAddress = AccountAddress.from(walletAddress);

    // Build the transaction
    // Convert arguments - amount should be a string (native units)
    const functionArguments = transactionData.arguments.map((arg, index) => {
      // First argument is recipient address (string), second is amount (string/number)
      if (index === 1 && typeof arg === 'string' && /^\d+$/.test(arg)) {
        // Amount in native units - keep as string for BigInt compatibility
        return arg;
      }
      return arg;
    });

    // Validate function format (should be "module::module::function")
    if (!transactionData.function.includes('::') || transactionData.function.split('::').length !== 3) {
      throw new Error(`Invalid function format: ${transactionData.function}. Expected format: "module::module::function"`);
    }

    // Type assertion: transactionData.function is validated to have the correct format
    const functionName = transactionData.function as `${string}::${string}::${string}`;

    // STRATEGIC FIX: Automatically use aptos_account::transfer_coins for MOVE transfers
    // This handles uninitialized recipient accounts (ECOIN_STORE_NOT_PUBLISHED)
    let finalFunctionName = functionName;
    if (functionName === "0x1::coin::transfer") {
      finalFunctionName = "0x1::aptos_account::transfer_coins";
    }

    const rawTxn = await movement.transaction.build.simple({
      sender: senderAddress,
      data: {
        function: finalFunctionName,
        typeArguments: transactionData.type_arguments,
        functionArguments: functionArguments,
      },
    });

    // Generate signing message
    const message = generateSigningMessageForTransaction(rawTxn);

    // Sign with Privy
    // 'aptos' is the correct chainType for Movement Network (Aptos-compatible)
    const { signature } = await signRawHash({
      address: walletAddress,
      chainType: 'aptos' as CurveSigningChainType,
      hash: toHex(message) as `0x${string}`,
    });

    // Create authenticator
    // STRATEGIC FIX: Aggressively clean the public key to ensure it is exactly 32 bytes
    let cleanPublicKey = publicKey.replace('0x', '');
    
    // Some keys come with a leading 00 for ed25519 representation
    if (cleanPublicKey.length === 66 && cleanPublicKey.startsWith('00')) {
      cleanPublicKey = cleanPublicKey.substring(2);
    }

    if (cleanPublicKey.length !== 64) {
      throw new Error(`Invalid public key length: expected 64 hex characters (32 bytes), got ${cleanPublicKey.length}`);
    }

    const publicKeyBytes = Buffer.from(cleanPublicKey, 'hex');
    const signatureBytes = Buffer.from(signature.replace('0x', ''), 'hex');

    const senderAuthenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(publicKeyBytes),
      new Ed25519Signature(signatureBytes)
    );

    // Submit transaction
    const pendingTxn = await movement.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator,
    });

    // Wait for transaction
    const executedTxn = await movement.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return executedTxn.hash;
  } catch (error: any) {
    console.error('Error sending Movement transaction:', error);
    throw new Error(error?.message || 'Failed to send Movement transaction');
  }
}

