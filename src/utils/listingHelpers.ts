// Helper functions for user listings UI

export function getTierColor(tier: string): string {
  const tierUpper = tier?.toUpperCase() || 'SEED';
  switch (tierUpper) {
    case 'SEED':
      return '#6D6D6D';
    case 'SPROUT':
      return '#FF5900';
    case 'BLOOM':
      return '#15FF00';
    case 'STELLAR':
      return '#FFBB00';
    default:
      return '#6D6D6D';
  }
}

export function getTierIcon(tier: string): string {
  const tierUpper = tier?.toUpperCase() || 'SEED';
  switch (tierUpper) {
    case 'SEED':
      return '/project-categories/seed.svg';
    case 'SPROUT':
      return '/project-categories/sprout.svg';
    case 'BLOOM':
      return '/project-categories/bloom.svg';
    case 'STELLAR':
      return '/project-categories/stellar.svg';
    default:
      return '/project-categories/seed.svg';
  }
}

export function getRiskScoreColor(riskScore: number): string {
  if (riskScore >= 70) {
    return '#15FF00'; // Green - Low Risk
  } else if (riskScore >= 50) {
    return '#FFCB45'; // Yellow - Medium Risk
  } else {
    return '#FF3939'; // Red - High Risk
  }
}

export function formatNumber(
  value: number | undefined | null,
  options?: {
    decimalsAboveOne?: number;
    decimalsBelowOne?: number;
    minThreshold?: number;
  }
): string {
  if (value === undefined || value === null || !isFinite(value)) {
    return 'N/A';
  }

  const {
    decimalsAboveOne = 2,
    decimalsBelowOne = 6,
    minThreshold = 0.000001,
  } = options || {};

  if (value === 0) return '0';

  if (value < minThreshold && value > 0) {
    return `${minThreshold}<`;
  }

  if (value >= 1) {
    return value.toFixed(decimalsAboveOne);
  }

  return value.toFixed(decimalsBelowOne);
}

export function compactNumber(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || !isFinite(value)) {
    return 'N/A';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const format = (num: number, suffix: string) => {
    const fixed = num.toFixed(decimals);
    return fixed.endsWith('.0') ? `${sign}${fixed.slice(0, -2)}${suffix}` : `${sign}${fixed}${suffix}`;
  };

  if (abs >= 1e12) return format(abs / 1e12, 'T');
  if (abs >= 1e9) return format(abs / 1e9, 'B');
  if (abs >= 1e6) return format(abs / 1e6, 'M');
  if (abs >= 1e3) return format(abs / 1e3, 'k');

  return `${value}`;
}
