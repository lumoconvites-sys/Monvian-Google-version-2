import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  ShieldCheck,
  Bell,
  Send,
  MapPin,
  Route,
  Loader2,
} from 'lucide-react';
import { getAuthHeaders } from '../../hooks/usePlatanos';

interface PushStats {
  totalSubscribers: number;
  activeSubscribers: number;
  newSpotsSubscribers: number;
  itinerarySubscribers: number;
  fcmDevices: number;
}

interface RecentPushAlert {
  id: string;
  type: 'new_spot' | 'itinerary_update';
  title: string;
  body: string;
  sent_count: number;
  delivery_mode: string;
  created_at: string;
}

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    community_url: '',
    instagram_url: '',
    support_phone: '',
    app_name: 'Monvian - Campos do Jordão',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // FCM Push Broadcast state
  const [pushStats, setPushStats] = useState<PushStats | null>(null);
  const [fcmConfigured, setFcmConfigured] = useState(false);
  const [recentPushAlerts, setRecentPushAlerts] = useState<RecentPushAlert[]>([]);
  const [pushType, setPushType] = useState<'new_spot' | 'itinerary_update'>('new_spot');
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushTargetId, setPushTargetId] = useState('');
  const [sendingPush, setSendingPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [spotsOptions, setSpotsOptions] = useState<Array<{ id: string; name: string; image?: string }>>([]);
  const [itinerariesOptions, setItinerariesOptions] = useState<Array<{ id: string; title: string; coverImage?: string }>>([]);

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

  const fetchPushStats = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/push/stats', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setFcmConfigured(Boolean(data.fcmConfigured));
        setPushStats(data.stats || null);
        setRecentPushAlerts(Array.isArray(data.recentAlerts) ? data.recentAlerts : []);
      }
    } catch {}
  };

  const fetchTargetOptions = async () => {
    try {
      const [spotsRes, itinRes] = await Promise.all([
        fetch('/api/spots').catch(() => null),
        fetch('/api/itineraries').catch(() => null),
      ]);
      if (spotsRes?.ok) {
        const sData = await spotsRes.json();
        const list = Array.isArray(sData?.spots) ? sData.spots : [];
        setSpotsOptions(list.map((s: any) => ({ id: String(s.id), name: String(s.name), image: s.image })));
      }
      if (itinRes?.ok) {
        const iData = await itinRes.json();
        const list = Array.isArray(iData?.itineraries) ? iData.itineraries : Array.isArray(iData) ? iData : [];
        setItinerariesOptions(
          list.map((i: any) => ({
            id: String(i.id),
            title: String(i.title),
            coverImage: i.coverImage || i.cover_image,
          }))
        );
      }
    } catch {}
  };

  useEffect(() => {
    fetchSettings();
    fetchPushStats();
    fetchTargetOptions();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
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

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    setPushError(null);

    if (!pushTitle.trim() || !pushBody.trim()) {
      setPushError('Preencha o título e a mensagem da notificação.');
      return;
    }

    setSendingPush(true);
    try {
      const headers = await getAuthHeaders();
      const matchedSpot =
        pushType === 'new_spot' ? spotsOptions.find((s) => s.id === pushTargetId) : undefined;
      const matchedItin =
        pushType === 'itinerary_update'
          ? itinerariesOptions.find((i) => i.id === pushTargetId)
          : undefined;

      const res = await fetch('/api/admin/push/send', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: pushType,
          title: pushTitle.trim(),
          body: pushBody.trim(),
          spotId: matchedSpot?.id || null,
          itineraryId: matchedItin?.id || null,
          imageUrl: matchedSpot?.image || matchedItin?.coverImage || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível enviar a notificação.');
      }

      setPushTitle('');
      setPushBody('');
      setPushTargetId('');
      showToast(
        `Alerta publicado (${data.subscribersCount || 0} inscritos • ${data.sentCount || 0} envios FCM).`
      );
      fetchPushStats();
    } catch (err: any) {
      setPushError(err.message || 'Erro ao enviar notificação push.');
    } finally {
      setSendingPush(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-white/15">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />
          <h1 className="text-[28px] sm:text-[34px] font-bold text-black tracking-[-0.03em] leading-tight">
            Configurações
          </h1>
        </div>
        <p className="text-sm text-[#858585] mt-1 sm:pl-[22px]">
          Gerencie os canais oficiais, parâmetros do mapa e notificações Push via Firebase Cloud Messaging.
        </p>
      </div>

      {/* Push Notifications (Firebase Cloud Messaging) Card */}
      <form
        onSubmit={handleSendPush}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#F2F2F2] text-black flex items-center justify-center">
              <Bell className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-black tracking-tight">
                Notificações Push (Firebase Cloud Messaging)
              </h2>
              <p className="text-xs text-[#858585]">
                Disparo automático ao criar locais ou atualizar roteiros, além de envio manual abaixo.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#F2F2F2] text-black border border-black/10">
            {fcmConfigured ? 'FCM HTTP v1 + Tempo Real' : 'Tempo Real + Web Push'}
          </span>
        </div>

        {pushStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl bg-[#F7F7F7] border border-black/[0.06] p-3">
              <p className="text-[11px] text-[#858585] font-medium">Inscritos ativos</p>
              <p className="text-lg font-bold text-black tabular-nums mt-0.5">
                {pushStats.activeSubscribers}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F7F7] border border-black/[0.06] p-3">
              <p className="text-[11px] text-[#858585] font-medium">Novos locais</p>
              <p className="text-lg font-bold text-black tabular-nums mt-0.5">
                {pushStats.newSpotsSubscribers}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F7F7] border border-black/[0.06] p-3">
              <p className="text-[11px] text-[#858585] font-medium">Roteiros</p>
              <p className="text-lg font-bold text-black tabular-nums mt-0.5">
                {pushStats.itinerarySubscribers}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F7F7] border border-black/[0.06] p-3">
              <p className="text-[11px] text-[#858585] font-medium">Tokens FCM</p>
              <p className="text-lg font-bold text-black tabular-nums mt-0.5">
                {pushStats.fcmDevices}
              </p>
            </div>
          </div>
        )}

        {pushError && (
          <div className="p-3.5 rounded-2xl bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pushError}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F2F2F2]">
          <button
            type="button"
            onClick={() => {
              setPushType('new_spot');
              setPushTargetId('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              pushType === 'new_spot'
                ? 'bg-black text-white shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Novo local</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPushType('itinerary_update');
              setPushTargetId('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              pushType === 'itinerary_update'
                ? 'bg-black text-white shadow-xs'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>Atualização em roteiro</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-700">
              {pushType === 'new_spot' ? 'Vincular ponto turístico (opcional)' : 'Vincular roteiro (opcional)'}
            </label>
            <select
              value={pushTargetId}
              onChange={(e) => {
                const val = e.target.value;
                setPushTargetId(val);
                if (pushType === 'new_spot') {
                  const found = spotsOptions.find((s) => s.id === val);
                  if (found && !pushTitle) {
                    setPushTitle(`Novo local: ${found.name}`);
                  }
                } else {
                  const found = itinerariesOptions.find((i) => i.id === val);
                  if (found && !pushTitle) {
                    setPushTitle(`Roteiro atualizado: ${found.title}`);
                  }
                }
              }}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-black"
            >
              <option value="">Sem vínculo direto</option>
              {pushType === 'new_spot'
                ? spotsOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                : itinerariesOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-700">Título da notificação</label>
            <input
              type="text"
              maxLength={110}
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              placeholder={
                pushType === 'new_spot'
                  ? 'Ex: Novo mirante em Campos do Jordão'
                  : 'Ex: Roteiro Romântico atualizado'
              }
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-black focus:bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-700">Mensagem</label>
          <textarea
            rows={2}
            maxLength={240}
            value={pushBody}
            onChange={(e) => setPushBody(e.target.value)}
            placeholder="Escreva uma mensagem clara e objetiva para os viajantes..."
            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-black focus:bg-white resize-none"
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={sendingPush}
            className="px-5 py-2.5 bg-black hover:bg-[#171717] active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
          >
            {sendingPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sendingPush ? 'Enviando...' : 'Enviar Notificação Push'}</span>
          </button>
        </div>

        {recentPushAlerts.length > 0 && (
          <div className="pt-4 border-t border-zinc-100 space-y-2">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Últimos alertas enviados
            </p>
            <div className="space-y-1.5">
              {recentPushAlerts.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#F7F7F7] border border-black/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black truncate">{item.title}</p>
                    <p className="text-[11px] text-[#858585] truncate">{item.body}</p>
                  </div>
                  <span className="text-[10.5px] font-medium text-[#858585] shrink-0">
                    {item.type === 'itinerary_update' ? 'Roteiro' : 'Local'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* General Settings Form Card */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs space-y-6">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Setting: Phone */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-800 flex items-center gap-2">
            <Phone className="w-4 h-4 text-black" />
            Telefone / WhatsApp de Suporte
          </label>
          <input
            type="text"
            value={settings.support_phone || ''}
            onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
            placeholder="+55 12 99123-4567"
            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-black focus:bg-white transition-all"
          />
        </div>

        {/* Setting 4: Map & Camera Configurations (Persistência Duradoura) */}
        <div className="space-y-4 pt-6 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-black" />
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                Configurações & Câmera do Mapa (Persistência na Nuvem)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F2F2F2] text-black border border-black/10">
              Cloud Firestore Ativo
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Todas as posições, ângulos de câmera, estilo padrão e tokens são sincronizados e preservados entre builds e publicações.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Latitude Central Padrão</label>
              <input
                type="text"
                value={settings.map_center_lat || '-22.7290'}
                onChange={(e) => setSettings({ ...settings, map_center_lat: e.target.value })}
                placeholder="-22.7290"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Longitude Central Padrão</label>
              <input
                type="text"
                value={settings.map_center_lng || '-45.5830'}
                onChange={(e) => setSettings({ ...settings, map_center_lng: e.target.value })}
                placeholder="-45.5830"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Zoom Inicial Padrão</label>
              <input
                type="text"
                value={settings.map_zoom || '11.75'}
                onChange={(e) => setSettings({ ...settings, map_zoom: e.target.value })}
                placeholder="11.75"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Inclinação da Câmera (Pitch / 3D)</label>
              <input
                type="text"
                value={settings.map_pitch || '52'}
                onChange={(e) => setSettings({ ...settings, map_pitch: e.target.value })}
                placeholder="52"
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Modo de Estilo Padrão</label>
              <select
                value={settings.map_default_mode || 'explorar'}
                onChange={(e) => setSettings({ ...settings, map_default_mode: e.target.value })}
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-black font-medium"
              >
                <option value="explorar">Explorar (Apple Maps Minimalista Escuro/Claro)</option>
                <option value="satelite">Satélite HD (Esri / Imagem Orbital)</option>
                <option value="carro">Carro / Navegação</option>
                <option value="animado">Animado / Linhas Topográficas</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700">Mapbox Access Token (Opcional)</label>
              <input
                type="password"
                value={settings.mapbox_access_token || ''}
                onChange={(e) => setSettings({ ...settings, mapbox_access_token: e.target.value })}
                placeholder="pk.eyJ1..."
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:border-black"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-zinc-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving || loading}
            className="px-6 py-2.5 bg-black hover:bg-[#171717] active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
