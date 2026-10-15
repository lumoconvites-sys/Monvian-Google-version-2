import React from 'react';
import { X } from 'lucide-react';

interface FollowersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: Array<{ id: string; name: string; username?: string; photo?: string }>;
  onSelectUser?: (userId: string) => void;
}

export const FollowersListModal: React.FC<FollowersListModalProps> = ({
  isOpen,
  onClose,
  title,
  users = [],
  onSelectUser
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 max-w-sm w-full relative">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
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
                onClick={() => onSelectUser && onSelectUser(u.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/60 cursor-pointer"
              >
                <img
                  src={u.photo || '/loogo.png'}
                  alt={u.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{u.name}</p>
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
