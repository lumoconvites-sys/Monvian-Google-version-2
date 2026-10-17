import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export interface AdminSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotToEdit?: any;
  onSaveSuccess?: (savedSpot: any) => void;
}

export const AdminSpotModal: React.FC<AdminSpotModalProps> = ({
  isOpen,
  onClose,
  spotToEdit,
  onSaveSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    category: 'attractions',
    image: '',
    rating: 4.8,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (spotToEdit) {
      setFormData(spotToEdit);
    } else {
      setFormData({
        name: '',
        description: '',
        address: '',
        category: 'attractions',
        image: '',
        rating: 4.8,
      });
    }
  }, [spotToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (spotToEdit) {
        const spotRef = doc(db, 'spots', spotToEdit.id);
        await updateDoc(spotRef, { ...formData, updatedAt: serverTimestamp() });
        onSaveSuccess?.({ ...spotToEdit, ...formData });
      } else {
        const docRef = await addDoc(collection(db, 'spots'), {
          ...formData,
          isActive: true,
          isVerified: false,
          createdAt: serverTimestamp(),
        });
        onSaveSuccess?.({ id: docRef.id, ...formData, isActive: true, isVerified: false });
      }
      onClose();
    } catch (err) {
      console.error('Error saving spot:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full text-zinc-900 dark:text-white shadow-2xl">
        <h3 className="text-xl font-black mb-4">{spotToEdit ? 'Editar Ponto' : 'Novo Ponto'}</h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Nome"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl"
          />
          <textarea
            placeholder="Descrição"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl"
          />
          <input
            type="text"
            placeholder="Endereço"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl"
          />
          <input
            type="text"
            placeholder="URL da Imagem"
            value={formData.image}
            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl"
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 rounded-xl cursor-pointer font-black">Fechar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl cursor-pointer font-black">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSpotModal;
