import axios from 'axios';

export interface EnrichedMarketData {
  symbol?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  priceUsd?: number | null;
  change24h?: number | null;
  liquidityUsd?: number | null;
  volume24h?: number | null;
  holders?: number | null;
  marketCap?: number | null;
  tier?: string | null;
  metadata?: any;
}

// Choose the best pair by highest USD liquidity
function pickBestDexPair(pairs: any[]): any | null {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  return pairs
    .filter(p => p?.chainId?.toString().toLowerCase().includes('sol') || p?.chainId === 'solana' || p?.chainId === 'sol')
    .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0] || pairs[0];
}

async function fetchFromDexScreener(contractAddress: string): Promise<Partial<EnrichedMarketData>> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    const pair = pickBestDexPair(data?.pairs || []);
    if (!pair) return {};
    const priceUsd = pair?.priceUsd ? Number(pair.priceUsd) : undefined;
    const volume24h = pair?.volume?.h24 ?? pair?.txns?.h24?.volume ?? undefined;
    const liquidityUsd = pair?.liquidity?.usd ?? undefined;
    const marketCap = pair?.fdv ?? pair?.marketCap ?? undefined;
    const change24h = pair?.priceChange?.h24 ?? undefined;
    const symbol = pair?.baseToken?.symbol ?? undefined;
    const name = pair?.baseToken?.name ?? undefined;
    return { priceUsd, volume24h, liquidityUsd, marketCap, change24h, symbol, name, metadata: { market: { pairAddress: pair?.pairAddress } } };
  } catch {
    return {};
  }
}

async function fetchFromJupiter(contractAddress: string): Promise<Partial<EnrichedMarketData>> {
  try {
    // Using lite-api.jup.ag as tokens.jup.ag is being phased out
    const url = `https://lite-api.jup.ag/token/${contractAddress}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const symbol = data?.symbol ?? undefined;
    const name = data?.name ?? undefined;
    const logoUrl = data?.logoURI ?? undefined;
    return { symbol, name, metadata: { logoUrl } };
  } catch {
    return {};
  }
}

async function fetchHoldersFromSolscan(contractAddress: string): Promise<Partial<EnrichedMarketData>> {
  try {
    const url = `https://public-api.solscan.io/token/meta?tokenAddress=${contractAddress}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const holders = data?.holder ? Number(data.holder) : (data?.holders ? Number(data.holders) : undefined);
    if (Number.isFinite(holders)) return { holders };
    return {};
  } catch {
    return {};
  }
}

// Optional GMGN endpoint if provided via env var. Response shape may vary; we map what we can.
async function fetchFromGmgn(contractAddress: string): Promise<Partial<EnrichedMarketData>> {
  try {
    const base = process.env.REACT_APP_GMGN_API_BASE; // e.g., https://api.gmgn.ai or your proxy
    if (!base) return {};
    // Example path (adjust to your GMGN endpoint format if different):
    const url = `${base.replace(/\/$/, '')}/solana/token/${contractAddress}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const priceUsd = data?.price_usd ?? data?.priceUsd;
    const marketCap = data?.market_cap_usd ?? data?.marketCap;
    const volume24h = data?.volume_24h_usd ?? data?.volume24h;
    const holders = data?.holders ?? data?.holder_count;
    const liquidityUsd = data?.liquidity_usd ?? data?.liquidityUsd;
    const change24h = data?.change_24h ?? data?.change24h;
    const tier = data?.tier ?? undefined;
    const symbol = data?.symbol ?? undefined;
    const name = data?.name ?? undefined;
    return {
      symbol,
      name,
      priceUsd: Number(priceUsd) || undefined,
      marketCap: Number(marketCap) || undefined,
      volume24h: Number(volume24h) || undefined,
      holders: Number(holders) || undefined,
      liquidityUsd: Number(liquidityUsd) || undefined,
      change24h: Number(change24h) || undefined,
      tier: typeof tier === 'string' ? tier : undefined,
    };
  } catch {
    return {};
  }
}

export async function enrichMarket(contractAddress: string, chain: string = 'SOLANA'): Promise<Partial<EnrichedMarketData>> {
  if (!contractAddress) return {};
  // Try GMGN (if configured), DexScreener, Jupiter, and Solscan holders
  const [gmgn, dex, jup, holders] = await Promise.all([
    fetchFromGmgn(contractAddress),
    fetchFromDexScreener(contractAddress),
    fetchFromJupiter(contractAddress),
    fetchHoldersFromSolscan(contractAddress),
  ]);

  // Merge priority: GMGN > DexScreener > Jupiter
  const merged: Partial<EnrichedMarketData> = {
    symbol: gmgn.symbol ?? dex.symbol ?? jup.symbol,
    name: gmgn.name ?? dex.name ?? jup.name,
    logoUrl: (jup.metadata as any)?.logoUrl ?? gmgn.logoUrl ?? dex.logoUrl,
    priceUsd: gmgn.priceUsd ?? dex.priceUsd,
    change24h: gmgn.change24h ?? dex.change24h,
    liquidityUsd: gmgn.liquidityUsd ?? dex.liquidityUsd,
    volume24h: gmgn.volume24h ?? dex.volume24h,
    holders: gmgn.holders ?? holders.holders,
    marketCap: gmgn.marketCap ?? dex.marketCap,
    tier: gmgn.tier ?? undefined,
    metadata: {
      ...(dex.metadata || {}),
      ...(jup.metadata || {}),
    },
  };

  return merged;
}