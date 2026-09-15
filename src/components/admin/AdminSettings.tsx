import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Phone,
  AppWindow,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { InstagramLogo, WhatsAppLogo } from '../SocialIcons';

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    community_url: '',
    instagram_url: '',
    support_phone: '',
    app_name: 'Monvian - Campos do Jordão'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar configurações.');
      }

      showToast('Configurações salvas e aplicadas ao app!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-700">
          <CheckCircle2 className="w-4 h-4 text-[#00C896]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-blue-600 text-xs font-black tracking-wider uppercase mb-1">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          CONSOLE OPERACIONAL
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
          Configurações do Monvian
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
          Gerencie os canais oficiais, links de comunidade e informações do ecossistema.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs space-y-6">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Setting 1: Community URL */}
        <div className="space-y-2">
           <div className="flex items-center justify-between">
             <label className="text-xs font-black text-zinc-800 flex items-center gap-2">
               <WhatsAppLogo className="w-4 h-4" />
               Link da Comunidade (WhatsApp / Grupo VIP)
             </label>
             {settings.community_url && (
               <a
                 href={settings.community_url}
                 target="_blank"
                 rel="noreferrer"
                 className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
               >
                 Testar link <ExternalLink className="w-3 h-3" />
               </a>
             )}
           </div>
           <input
             type="url"
             value={settings.community_url || ''}
             onChange={(e) => setSettings({ ...settings, community_url: e.target.value })}
             placeholder="https://chat.whatsapp.com/..."
             className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono text-xs"
           />
           <p className="text-[11px] text-zinc-400">
             Este link é acionado quando os usuários clicam no botão da Comunidade no aplicativo.
           </p>
         </div>

         {/* Setting 2: Instagram */}
         <div className="space-y-2 pt-4 border-t border-zinc-100">
           <div className="flex items-center justify-between">
             <label className="text-xs font-black text-zinc-800 flex items-center gap-2">
               <InstagramLogo className="w-4 h-4" />
               Perfil Oficial do Instagram
             </label>
            {settings.instagram_url && (
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
              >
                Abrir perfil <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <input
            type="url"
            value={settings.instagram_url || ''}
            onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
            placeholder="https://instagram.com/monvian.campos"
            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono text-xs"
          />
        </div>

        {/* Setting 3: Phone */}
        <div className="space-y-2 pt-4 border-t border-zinc-100">
          <label className="text-xs font-black text-zinc-800 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600" />
            Telefone / WhatsApp de Suporte
          </label>
          <input
            type="text"
            value={settings.support_phone || ''}
            onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
            placeholder="+55 12 99123-4567"
            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-zinc-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
