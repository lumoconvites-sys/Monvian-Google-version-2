import React from 'react';

export interface AdminSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot?: any;
  spotToEdit?: any;
  mode?: string;
  onSave?: any;
  onSaveSuccess?: (savedSpot: any) => void;
}

export const AdminSpotModal: React.FC<AdminSpotModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full text-white">
        <h3 className="text-lg font-bold mb-4">Editar Ponto</h3>
        <button onClick={onClose} className="px-4 py-2 bg-zinc-800 rounded-xl cursor-pointer">Fechar</button>
      </div>
    </div>
  );
};

export default AdminSpotModal;
