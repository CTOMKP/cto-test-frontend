const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
const CREATOR_URL = process.env.REACT_APP_CREATOR_PROGRAM_URL || 'https://earn.ctomarketplace.com';

export async function openCreatorProgram(): Promise<void> {
  const token = localStorage.getItem('cto_auth_token');
  if (!token) {
    window.location.assign(CREATOR_URL);
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/handoff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'creator' }),
    });
    if (!response.ok) throw new Error(`Creator handoff failed (${response.status})`);
    const body = await response.json();
    const code = body?.code || body?.data?.code || body?.data?.data?.code;
    if (!code) throw new Error('Creator handoff response is missing a code');
    const destination = new URL(CREATOR_URL);
    destination.pathname = '/auth/callback';
    destination.searchParams.set('handoff', code);
    window.location.assign(destination.toString());
  } catch (error) {
    console.error('Unable to transfer the CTO session to Creator Program:', error);
    window.location.assign(CREATOR_URL);
  }
}
