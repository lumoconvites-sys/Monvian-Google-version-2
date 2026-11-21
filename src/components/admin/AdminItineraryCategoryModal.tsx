import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tag } from 'lucide-react';

export interface AdminItineraryCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  categoryToEdit?: any;
}

export const AdminItineraryCategoryModal: React.FC<AdminItineraryCategoryModalProps> = ({
  isOpen,
  onClose,
  categoryToEdit,
}) => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[8px] sm:p-4"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36, mass: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[440px] bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/[0.06] overflow-hidden"
            style={{
              paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom, 0px) + 14px))',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            <div className="px-6 pt-3 pb-4">
              <div className="w-11 h-[5px] rounded-full bg-[#D1D5DB] mx-auto mb-3.5" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-[#F2F3F5] text-[#111827] flex items-center justify-center shrink-0">
                    <Tag className="w-[18px] h-[18px] stroke-[2]" />
                  </span>
                  <h3 className="text-[18px] font-bold text-[#111827] tracking-[-0.02em] truncate">
                    {categoryToEdit ? 'Editar Categoria' : 'Categoria de Roteiro'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="w-9 h-9 rounded-full bg-[#F2F3F5] hover:bg-[#E5E7EB] text-[#374151] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-[17px] h-[17px]" />
                </button>
              </div>
            </div>

            <div className="px-6 pt-1">
              <p className="text-[13.5px] text-[#6B7280] leading-relaxed">
                As categorias organizam os filtros da Loja de Roteiros no aplicativo.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full h-[48px] rounded-full bg-[#111318] hover:bg-[#1F232B] text-white text-[14px] font-semibold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AdminItineraryCategoryModal;
