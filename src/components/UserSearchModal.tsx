import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ArrowLeft, UserCheck, UserPlus, Loader2, Sparkles, Compass } from 'lucide-react';

export interface SearchUserItem {
  id: string;
  name: string;
  username: string;
  username_normalized: string;
  avatar_url: string;
  bio?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  is_me: boolean;
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: SearchUserItem) => void;
  isDark?: boolean;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  isDark = true,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      fetchUsers('');
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  const fetchUsers = async (searchQuery: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setResults(data.users);
        const map: Record<string, boolean> = {};
        data.users.forEach((u: SearchUserItem) => {
          map[u.id] = Boolean(u.is_following);
        });
        setFollowingMap((prev) => ({ ...prev, ...map }));
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      fetchUsers(val);
    }, 280);
  };

  const handleToggleFollow = async (e: React.MouseEvent, user: SearchUserItem) => {
    e.stopPropagation();
    const token = localStorage.getItem('monvian_token');
    const currentStatus = Boolean(followingMap[user.id]);
    const nextStatus = !currentStatus;

    // Optimistic UI
    setFollowingMap((prev) => ({ ...prev, [user.id]: nextStatus }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}/toggle-follow`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        setFollowingMap((prev) => ({ ...prev, [user.id]: Boolean(data.is_following) }));
      } else {
        setFollowingMap((prev) => ({ ...prev, [user.id]: currentStatus }));
      }
    } catch {
      setFollowingMap((prev) => ({ ...prev, [user.id]: currentStatus }));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex flex-col justify-start select-none overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Search View Container */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className={`relative w-full h-full flex flex-col z-10 rounded-t-[26px] ios-page-top-rounded ${
            isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-900'
          }`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 12px)',
            borderTopLeftRadius: '26px',
            borderTopRightRadius: '26px',
            overflow: 'hidden',
            WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          }}
        >
          {/* Search Header Bar (Instagram Style) */}
          <div className="px-4 pb-3 flex items-center gap-2.5 shrink-0 border-b border-white/[0.08] dark:border-white/[0.08]">
            {/* Back button */}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full cursor-pointer transition-colors ${
                isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-zinc-100 text-black'
              }`}
              title="Voltar"
            >
              <ArrowLeft
                className={`w-5 h-5 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              />
            </button>

            {/* Input with Magnifier (WhatsApp iOS style) */}
            <div className={`flex-1 flex items-center gap-2.5 px-3.5 h-[42px] rounded-full transition-colors ${
              isDark
                ? 'bg-[#202124] text-white'
                : 'bg-[#f0f2f5] text-[#111b21]'
            }`}>
              <Search className="w-[18px] h-[18px] text-[#8696a0] dark:text-[#8e8e93] shrink-0 stroke-[2]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Pesquisar pessoas, @username..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full bg-transparent text-[15px] font-normal focus:outline-none placeholder-[#8696a0] dark:placeholder-[#8e8e93]"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleQueryChange('')}
                  className="w-4 h-4 rounded-full bg-[#8696a0]/30 hover:bg-[#8696a0]/50 text-[#111b21] dark:text-white flex items-center justify-center cursor-pointer transition-colors"
                  title="Limpar"
                >
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-2 text-[14px] font-semibold text-white hover:text-zinc-300 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          {/* Search Results / Suggestions List */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-1">
            {/* Section label */}
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">
                {query.trim() ? 'Resultados' : 'Sugeridos para você'}
              </span>
              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Buscando...</span>
                </div>
              )}
            </div>

            {/* Results rendering */}
            {!loading && results.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-center px-6">
                <Compass className="w-12 h-12 text-zinc-600 mb-3 stroke-[1.5]" />
                <p className="text-[16px] font-bold">
                  {query ? `Nenhum usuário encontrado para "${query}"` : 'Nenhum usuário disponível'}
                </p>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  {query ? 'Verifique a digitação ou tente procurar pelo nome completo.' : 'Descubra criadores em Campos do Jordão.'}
                </p>
              </div>
            ) : (
              results.map((user) => {
                const isFollowing = Boolean(followingMap[user.id]);
                const isMe = Boolean(user.is_me);

                return (
                  <motion.div
                    key={user.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectUser(user)}
                    className={`flex items-center justify-between p-3 rounded-[22px] transition-colors cursor-pointer ${
                      isDark
                        ? 'hover:bg-white/[0.06] active:bg-white/[0.08]'
                        : 'hover:bg-zinc-100 active:bg-zinc-200'
                    }`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                        <img
                          src={user.avatar_url || '/fotoperfil.png'}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/fotoperfil.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14.5px] font-bold truncate leading-tight flex items-center gap-1.5">
                          <span>{user.name}</span>
                        </div>
                        <div className="text-[12.5px] text-zinc-400 font-medium truncate mt-0.5">
                          @{user.username}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">
                          {user.followers_count} {user.followers_count === 1 ? 'seguidor' : 'seguidores'}
                        </div>
                      </div>
                    </div>

                    {/* Quick Follow Button */}
                    {!isMe && (
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={(e) => handleToggleFollow(e, user)}
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
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
