import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  AppWindow,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

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
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-black tracking-wider uppercase mb-1">
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
          CONSOLE OPERACIONAL
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          Configurações do Monvian
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Gerencie os canais oficiais, links de comunidade e informações do ecossistema.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSave} className="bg-white dark:bg-[#121418] rounded-3xl p-6 sm:p-8 border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-6">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Setting: Phone */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Telefone / WhatsApp de Suporte
          </label>
          <input
            type="text"
            value={settings.support_phone || ''}
            onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
            placeholder="+55 12 99123-4567"
            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
          />
        </div>

        {/* Setting 4: Map & Camera Configurations (Persistência Duradoura) */}
        <div className="space-y-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Configurações & Câmera do Mapa (Persistência na Nuvem)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              Cloud Firestore Ativo
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Todas as posições, ângulos de câmera, estilo padrão e tokens são sincronizados e preservados entre builds e publicações.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Latitude Central Padrão</label>
              <input
                type="text"
                value={settings.map_center_lat || '-22.7290'}
                onChange={(e) => setSettings({ ...settings, map_center_lat: e.target.value })}
                placeholder="-22.7290"
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Longitude Central Padrão</label>
              <input
                type="text"
                value={settings.map_center_lng || '-45.5830'}
                onChange={(e) => setSettings({ ...settings, map_center_lng: e.target.value })}
                placeholder="-45.5830"
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Zoom Inicial Padrão</label>
              <input
                type="text"
                value={settings.map_zoom || '11.75'}
                onChange={(e) => setSettings({ ...settings, map_zoom: e.target.value })}
                placeholder="11.75"
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Inclinação da Câmera (Pitch / 3D)</label>
              <input
                type="text"
                value={settings.map_pitch || '52'}
                onChange={(e) => setSettings({ ...settings, map_pitch: e.target.value })}
                placeholder="52"
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Modo de Estilo Padrão</label>
              <select
                value={settings.map_default_mode || 'explorar'}
                onChange={(e) => setSettings({ ...settings, map_default_mode: e.target.value })}
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="explorar">Explorar (Apple Maps Minimalista Escuro/Claro)</option>
                <option value="satelite">Satélite HD (Esri / Imagem Orbital)</option>
                <option value="carro">Carro / Navegação</option>
                <option value="animado">Animado / Linhas Topográficas</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Mapbox Access Token (Opcional)</label>
              <input
                type="password"
                value={settings.mapbox_access_token || ''}
                onChange={(e) => setSettings({ ...settings, mapbox_access_token: e.target.value })}
                placeholder="pk.eyJ1..."
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end">
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
