import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, UserCheck, UserPlus, ArrowLeft, Loader2, Users } from 'lucide-react';

export interface FollowUser {
  id: string;
  name: string;
  username: string;
  username_normalized?: string;
  avatar_url: string;
  bio?: string;
  is_following?: boolean;
  is_me?: boolean;
}

interface FollowersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  initialTab?: 'followers' | 'following';
  onOpenUserProfile: (userId: string, username?: string) => void;
  isDark?: boolean;
}

export const FollowersListModal: React.FC<FollowersListModalProps> = ({
  isOpen,
  onClose,
  userId,
  username,
  initialTab = 'followers',
  onOpenUserProfile,
  isDark = true,
}) => {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);

    const endpoint = activeTab === 'followers'
      ? `/api/users/${encodeURIComponent(userId)}/followers`
      : `/api/users/${encodeURIComponent(userId)}/following`;

    const token = localStorage.getItem('monvian_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(endpoint, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
          const initialMap: Record<string, boolean> = {};
          data.users.forEach((u: FollowUser) => {
            initialMap[u.id] = Boolean(u.is_following);
          });
          setFollowingMap(initialMap);
        } else {
          setUsers([]);
        }
      })
      .catch((err) => {
        console.error('Error fetching follow list:', err);
        if (isMounted) setUsers([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, activeTab]);

  const handleToggleFollow = async (e: React.MouseEvent, targetUser: FollowUser) => {
    e.stopPropagation();
    const token = localStorage.getItem('monvian_token');
    const currentStatus = Boolean(followingMap[targetUser.id]);
    const nextStatus = !currentStatus;

    // Optimistic UI update
    setFollowingMap((prev) => ({ ...prev, [targetUser.id]: nextStatus }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/users/${encodeURIComponent(targetUser.id)}/toggle-follow`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        setFollowingMap((prev) => ({ ...prev, [targetUser.id]: Boolean(data.is_following) }));
      } else {
        // Revert
        setFollowingMap((prev) => ({ ...prev, [targetUser.id]: currentStatus }));
      }
    } catch {
      setFollowingMap((prev) => ({ ...prev, [targetUser.id]: currentStatus }));
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase().trim().replace(/^@+/, '');
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term)
    );
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          className={`relative w-full max-w-lg h-[82vh] sm:h-[620px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col z-10 shadow-2xl border ${
            isDark
              ? 'bg-[#0f1012] border-white/10 text-white'
              : 'bg-[#ffffff] border-zinc-200 text-zinc-900'
          }`}
        >
          {/* Header Bar */}
          <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-white/10' : 'border-zinc-200'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full cursor-pointer transition-colors ${
                isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-zinc-100 text-zinc-800'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <span className="text-[16px] font-bold tracking-tight">
              @{username || 'usuario'}
            </span>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full cursor-pointer transition-colors ${
                isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-zinc-100 text-zinc-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-Tabs: Seguidores | Seguindo */}
          <div className={`flex items-center px-4 pt-2 border-b shrink-0 ${
            isDark ? 'border-white/10 bg-[#0f1012]' : 'border-zinc-200 bg-[#ffffff]'
          }`}>
            <button
              type="button"
              onClick={() => setActiveTab('followers')}
              className={`flex-1 py-3 text-[14px] font-bold tracking-tight text-center relative cursor-pointer transition-colors ${
                activeTab === 'followers'
                  ? isDark ? 'text-white' : 'text-zinc-950'
                  : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <span>Seguidores</span>
              {activeTab === 'followers' && (
                <motion.div
                  layoutId="followActiveTabLine"
                  className={`absolute bottom-0 left-0 right-0 h-[2px] ${
                    isDark ? 'bg-white' : 'bg-black'
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-3 text-[14px] font-bold tracking-tight text-center relative cursor-pointer transition-colors ${
                activeTab === 'following'
                  ? isDark ? 'text-white' : 'text-zinc-950'
                  : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <span>Seguindo</span>
              {activeTab === 'following' && (
                <motion.div
                  layoutId="followActiveTabLine"
                  className={`absolute bottom-0 left-0 right-0 h-[2px] ${
                    isDark ? 'bg-white' : 'bg-black'
                  }`}
                />
              )}
            </button>
          </div>

          {/* Search Bar inside list */}
          <div className="px-4 py-3 shrink-0">
            <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[18px] border transition-colors ${
              isDark
                ? 'bg-[#18191d] border-white/10 text-white'
                : 'bg-zinc-100 border-zinc-200 text-zinc-900'
            }`}>
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-transparent text-[14px] focus:outline-none placeholder:text-zinc-500"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto px-4 py-1 space-y-2 no-scrollbar">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                <span className="text-xs text-zinc-500 font-semibold">Carregando lista...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                <Users className="w-10 h-10 text-zinc-500/40 mb-3" />
                <p className="text-[15px] font-bold">
                  {searchFilter ? 'Nenhum usuário encontrado' : activeTab === 'followers' ? 'Nenhum seguidor ainda' : 'Não está seguindo ninguém ainda'}
                </p>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  {searchFilter ? 'Tente buscar por outro nome ou @username.' : 'Conecte-se com novos exploradores de Campos do Jordão!'}
                </p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isFollowing = Boolean(followingMap[u.id]);
                const isMe = Boolean(u.is_me);

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      onClose();
                      onOpenUserProfile(u.id, u.username);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-[20px] transition-all cursor-pointer ${
                      isDark
                        ? 'hover:bg-white/[0.06] active:bg-white/[0.08]'
                        : 'hover:bg-zinc-100 active:bg-zinc-200'
                    }`}
                  >
                    {/* User info */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                        <img
                          src={u.avatar_url || '/fotoperfil.png'}
                          alt={u.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/fotoperfil.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold truncate leading-tight">
                          {u.name}
                        </div>
                        <div className="text-[12px] text-zinc-400 truncate mt-0.5">
                          @{u.username}
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    {!isMe && (
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        type="button"
                        onClick={(e) => handleToggleFollow(e, u)}
                        className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold tracking-tight transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          isFollowing
                            ? isDark
                              ? 'bg-zinc-800 text-zinc-200 border border-white/10 hover:bg-zinc-700'
                              : 'bg-zinc-200 text-zinc-800 border border-zinc-300 hover:bg-zinc-300'
                            : isDark
                              ? 'bg-white text-black hover:bg-zinc-200 shadow-sm'
                              : 'bg-black text-white hover:bg-zinc-800 shadow-sm'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
                            <span>Seguindo</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5 stroke-[2.2]" />
                            <span>Seguir</span>
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
