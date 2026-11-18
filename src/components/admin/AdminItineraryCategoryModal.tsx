import React from 'react';

export interface AdminItineraryCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  categoryToEdit?: any;
}

export const AdminItineraryCategoryModal: React.FC<AdminItineraryCategoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-md w-full text-zinc-900 shadow-2xl">
        <h3 className="text-lg font-black mb-4 text-zinc-900">Categoria de Roteiro</h3>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-sm rounded-xl transition-colors cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default AdminItineraryCategoryModal;
