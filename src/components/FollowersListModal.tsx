import React from 'react';
import { X } from 'lucide-react';

export interface FollowersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  users?: Array<{ id: string; name: string; username?: string; photo?: string }>;
  onSelectUser?: (userId: string) => void;
  userId?: string;
  username?: string;
  initialTab?: 'followers' | 'following';
  onOpenUserProfile?: (newUserId: any) => void;
  isDark?: boolean;
}

export const FollowersListModal: React.FC<FollowersListModalProps> = ({
  isOpen,
  onClose,
  title = 'Seguidores',
  users = [],
  onSelectUser,
  onOpenUserProfile,
  isDark = true,
}) => {
  if (!isOpen) return null;
  const handleSelect = (id: string) => {
    if (onSelectUser) onSelectUser(id);
    if (onOpenUserProfile) onOpenUserProfile(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`border rounded-3xl p-5 max-w-sm w-full relative ${
        isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
      }`}>
        <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
          {users.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">Nenhum seguidor ainda</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                onClick={() => handleSelect(u.id)}
                className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
                }`}
              >
                <img
                  src={u.photo || '/loogo.png'}
                  alt={u.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold">{u.name}</p>
                  {u.username && <p className="text-xs text-zinc-400">@{u.username}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
export default FollowersListModal;
