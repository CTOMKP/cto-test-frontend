import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MarketplaceTopNav from './MarketplaceTopNav';
import messagesService from '../../services/messagesService';


type ThreadParticipant = {
  id: number;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

type ThreadDetails = {
  id: string;
  posterId: number;
  applicantId: number;
  poster?: ThreadParticipant | null;
  applicant?: ThreadParticipant | null;
  ad?: {
    title?: string;
    description?: string;
  } | null;
};

const withAvatarCache = (url?: string | null, cacheValue?: string | number) => {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${cacheValue || Date.now()}`;
};

export default function MarketplaceUserProfile() {
  const navigate = useNavigate();
  const { threadId, profileUserId } = useParams();
  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  const myUserId = Number(localStorage.getItem('cto_user_id') || 0);
  const requestedUserId = Number(profileUserId || 0);

  useEffect(() => {
    if (requestedUserId && requestedUserId === myUserId) {
      navigate('/profile', { replace: true });
      return;
    }

    if (!threadId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    messagesService
      .getThread(threadId)
      .then((res: any) => {
        if (!mounted) return;
        const conversation = (res?.conversation || res?.thread || res) as ThreadDetails;
        setThread(conversation || null);
      })
      .catch(() => {
        if (!mounted) return;
        setThread(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [threadId, requestedUserId, myUserId, navigate]);

  const selectedUser = useMemo(() => {
    if (!thread) return null;

    if (requestedUserId === thread.posterId) return thread.poster || null;
    if (requestedUserId === thread.applicantId) return thread.applicant || null;

    return null;
  }, [thread, requestedUserId]);

  const selectedRole = useMemo(() => {
    if (!thread) return 'User';
    if (requestedUserId === thread.posterId) return 'Client / Poster';
    if (requestedUserId === thread.applicantId) return 'Applicant';
    return 'User';
  }, [thread, requestedUserId]);

  const avatarSrc = useMemo(() => {
    const raw = selectedUser?.avatarUrl || '';
    return withAvatarCache(raw, selectedUser?.id || thread?.id || '');
  }, [selectedUser?.avatarUrl, selectedUser?.id, thread?.id]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatarSrc, selectedUser?.id]);

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketplaceTopNav />

      <div className="px-6 py-8">
        <button
          type="button"
          onClick={() => navigate(threadId ? `/messages/${threadId}` : '/messages')}
          className="mb-6 rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/10"
        >
          Back to Messages
        </button>

        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-black/70 p-6">
          {loading ? (
            <div className="text-sm text-zinc-400">Loading profile...</div>
          ) : !thread ? (
            <div className="text-sm text-zinc-400">Thread not found.</div>
          ) : !selectedUser ? (
            <div className="text-sm text-zinc-400">User profile is not available in this conversation.</div>
          ) : (
            <div>
              <div className="flex items-center gap-4">
                {avatarSrc && !avatarError ? (
                  <img
                    src={avatarSrc}
                    alt="Profile"
                    className="h-20 w-20 rounded-full border border-white/10 object-cover"
                    onError={() => setAvatarError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-white/10" />
                )}
                <div>
                  <h1 className="text-2xl font-semibold">{selectedUser.name || selectedUser.email || 'User'}</h1>
                  <p className="mt-1 text-sm text-zinc-400">{selectedRole}</p>
                </div>
              </div>

              {selectedUser.bio && (
                <p className="mt-6 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">{selectedUser.bio}</p>
              )}

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Conversation Context</div>
                <p className="mt-2 text-sm text-zinc-200">{thread.ad?.title || 'Marketplace Conversation'}</p>
                <p className="mt-2 text-xs text-zinc-400 whitespace-pre-wrap">{thread.ad?.description || 'No ad description available.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
