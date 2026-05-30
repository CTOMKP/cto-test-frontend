import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setStoredCreatorReferralCode } from '../lib/creatorReferral';

export default function ReferralCapture() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('ref') || params.get('referral') || params.get('creator');
    if (code) {
      setStoredCreatorReferralCode(code);
    }
  }, [location.search]);

  return null;
}
