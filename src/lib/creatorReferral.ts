const CREATOR_REFERRAL_CODE_KEY = 'cto_creator_referral_code';

export function getStoredCreatorReferralCode() {
  return localStorage.getItem(CREATOR_REFERRAL_CODE_KEY) || '';
}

export function setStoredCreatorReferralCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return;
  localStorage.setItem(CREATOR_REFERRAL_CODE_KEY, trimmed);
}

export function clearStoredCreatorReferralCode() {
  localStorage.removeItem(CREATOR_REFERRAL_CODE_KEY);
}
