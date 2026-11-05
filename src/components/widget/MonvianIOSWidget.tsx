import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight, Code2, Copy, Layers, Smartphone, X } from 'lucide-react';
import {
  MonvianWidgetPayload,
  WidgetSpotItem,
  getInitialWidgetPayload,
  syncWidgetWithItinerary,
  getKnownItinerariesList,
} from '../../services/widgetSyncService';
import { getSpotFallbackImage } from '../../utils/spotImages';
import { Itinerary } from '../../types';
import { triggerHapticFeedback } from '../../utils/haptics';

export interface MonvianIOSWidgetProps {
  /** Optional explicit itinerary to preview; if omitted, uses the user's primary active/favorite itinerary */
  itinerary?: Itinerary | null;
  /** Called when the user taps the widget body or one of the 3 tourist spots */
  onActivateItinerary?: (itineraryId: string, spotId?: string) => void;
  /** Whether to show the subtle iOS Home Screen context bar below the widget */
  showControlsBar?: boolean;
  /** Additional container classes */
  className?: string;
}

export const MonvianIOSWidget: React.FC<MonvianIOSWidgetProps> = ({
  itinerary,
  onActivateItinerary,
  showControlsBar = false,
  className = '',
}) => {
  const [payload, setPayload] = useState<MonvianWidgetPayload>(() =>
    itinerary ? syncWidgetWithItinerary(itinerary) : getInitialWidgetPayload()
  );
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);

  // Sync whenever an explicit itinerary prop changes
  useEffect(() => {
    if (itinerary) {
      setPayload(syncWidgetWithItinerary(itinerary));
    }
  }, [itinerary]);

  // Listen to real-time updates (itinerary selection, step reordering, spot edits, or favorite changes)
  useEffect(() => {
    const handleWidgetUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail.spots)) {
        setPayload(e.detail);
      } else {
        setPayload(getInitialWidgetPayload());
      }
    };

    const handleSpotsOrItineraryUpdated = () => {
      setPayload(getInitialWidgetPayload());
    };

    window.addEventListener('monvian:widget_updated', handleWidgetUpdated);
    window.addEventListener('monvian:spots_updated', handleSpotsOrItineraryUpdated);
    window.addEventListener('storage', handleSpotsOrItineraryUpdated);

    // Fetch latest hydrated data from backend SQLite database to ensure 100% accuracy
    const sessionId = localStorage.getItem('monvian_itinerary_session') || '';
    const currentId = payload?.itineraryId || '';
    fetch(
      `/api/widget/itinerary?itineraryId=${encodeURIComponent(currentId)}&sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: sessionId ? { 'x-session-id': sessionId } : {},
      }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.widget && Array.isArray(data.widget.spots) && data.widget.spots.length > 0) {
          setPayload(data.widget);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('monvian:widget_updated', handleWidgetUpdated);
      window.removeEventListener('monvian:spots_updated', handleSpotsOrItineraryUpdated);
      window.removeEventListener('storage', handleSpotsOrItineraryUpdated);
    };
  }, [payload?.itineraryId]);

  const handleTapWidgetOrSpot = useCallback(
    (spot?: WidgetSpotItem, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      triggerHapticFeedback(12);

      if (onActivateItinerary) {
        onActivateItinerary(payload.itineraryId, spot?.spotId);
        return;
      }

      // Dispatch global deep-link event so App / ItinerariesView opens the Roteiros tab with this itinerary highlighted
      window.dispatchEvent(
        new CustomEvent('monvian:open_widget_itinerary', {
          detail: {
            itineraryId: payload.itineraryId,
            spotId: spot?.spotId || null,
          },
        })
      );
    },
    [onActivateItinerary, payload.itineraryId]
  );

  const spotsToRender = (payload.spots || []).slice(0, 3);

  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* =====================================================================
          LARGE iOS WIDGET (2 × 2 ICONS FORMAT) — FAITHFUL TO MONVIAN REFERENCE
         ===================================================================== */}
      <motion.div
        onClick={(e) => handleTapWidgetOrSpot(undefined, e)}
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        role="button"
        tabIndex={0}
        aria-label={`Widget Monvian: ${payload.widgetTitle} - Roteiro ${payload.itineraryTitle}`}
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif",
          backgroundColor: '#FFFFFF',
          boxShadow: '0 16px 44px rgba(0, 0, 0, 0.065), 0 2px 10px rgba(0, 0, 0, 0.03)',
        }}
        className="w-full max-w-[368px] rounded-[42px] bg-[#FFFFFF] border border-black/[0.045] px-6 pt-4 pb-6 cursor-pointer transition-shadow hover:shadow-[0_20px_50px_rgba(0,0,0,0.09)] relative overflow-hidden"
      >
        {/* 1. TOP ROUTE CURVE + 4 NODES + CENTRAL BLACK PIN GRAPHIC */}
        <div className="w-full flex justify-center items-center pt-0.5 pb-1">
          <svg
            viewBox="0 0 320 62"
            className="w-full max-w-[296px] h-[54px] overflow-visible pointer-events-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="monvianWidgetRouteLine" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E4E4E9" stopOpacity="0" />
                <stop offset="14%" stopColor="#E4E4E9" stopOpacity="0.95" />
                <stop offset="86%" stopColor="#E4E4E9" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#E4E4E9" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="monvianPinShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
                <stop offset="65%" stopColor="#000000" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Smooth wavy route path */}
            <path
              d="M 8 46 C 36 49, 54 43, 74 32 C 92 22, 104 18, 118 21 C 135 25, 146 43, 165 45 C 184 47, 198 44, 215 33 C 232 22, 246 14, 264 15 C 282 16, 298 26, 312 37"
              stroke="url(#monvianWidgetRouteLine)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />

            {/* 4 Route Stops Grey Dots along the curve */}
            <circle cx="52" cy="43" r="4.5" fill="#C4C4C9" />
            <circle cx="102" cy="20" r="4.5" fill="#C4C4C9" />
            <circle cx="192" cy="45" r="4.5" fill="#C4C4C9" />
            <circle cx="256" cy="15.5" r="4.5" fill="#C4C4C9" />

            {/* Soft ground shadow beneath central pin */}
            <ellipse cx="160" cy="47.5" rx="16" ry="2.8" fill="url(#monvianPinShadow)" />

            {/* Central Black Location Pin with White Inner Circle */}
            <path
              d="M160 6C150.059 6 142 14.0589 142 24C142 35.25 157.4 45.4 159.15 46.52C159.67 46.85 160.33 46.85 160.85 46.52C162.6 45.4 178 35.25 178 24C178 14.0589 169.941 6 160 6Z"
              fill="#111111"
            />
            <circle cx="160" cy="23.5" r="6.8" fill="#FFFFFF" />
          </svg>
        </div>

        {/* 2. WIDGET HEADER PHRASE */}
        <h2
          className="text-[24px] sm:text-[26px] font-bold text-[#000000] text-center tracking-[-0.03em] leading-[1.12] mb-4"
          style={{ color: '#000000' }}
        >
          Vamos começar
          <br />
          sua jornada?
        </h2>

        {/* 3. FIRST 3 TOURIST SPOTS FROM USER'S SELECTED ITINERARY */}
        <div className="flex flex-col">
          {spotsToRender.map((spot, idx) => (
            <React.Fragment key={`${payload.itineraryId}-${spot.spotId}-${spot.position}`}>
              <motion.div
                onClick={(e) => handleTapWidgetOrSpot(spot, e)}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3.5 py-2.5 group/spot cursor-pointer"
              >
                {/* Real Photo of the Place with Rounded Corners */}
                <div
                  className="w-[60px] h-[60px] sm:w-[62px] sm:h-[62px] rounded-[16px] overflow-hidden shrink-0 bg-[#F2F2F7] border border-black/[0.04]"
                  style={{
                    clipPath: 'inset(0 round 16px)',
                    WebkitClipPath: 'inset(0 round 16px)',
                  }}
                >
                  <img
                    src={spot.image}
                    alt={spot.name}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getSpotFallbackImage(
                        spot.name,
                        spot.categoryLabel
                      );
                    }}
                    className="w-full h-full object-cover group-hover/spot:scale-105 transition-transform duration-300 ease-out pointer-events-none select-none"
                  />
                </div>

                {/* Position Number Circle Badge (1, 2, 3) */}
                <div
                  className="w-[31px] h-[31px] rounded-full bg-[#F2F2F7] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#F2F2F7' }}
                >
                  <span
                    className="text-[14.5px] font-bold text-[#000000] leading-none"
                    style={{ color: '#000000' }}
                  >
                    {spot.position}
                  </span>
                </div>

                {/* Spot Name & Brief Description */}
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <h3
                    className="text-[16px] sm:text-[16.5px] font-bold text-[#000000] tracking-[-0.02em] leading-[1.2] truncate"
                    style={{ color: '#000000' }}
                  >
                    {spot.name}
                  </h3>
                  <p
                    className="text-[13.5px] sm:text-[14px] font-normal text-[#6E6E73] tracking-[-0.01em] leading-[1.25] truncate mt-0.5"
                    style={{ color: '#6E6E73' }}
                  >
                    {spot.shortDescription}
                  </p>
                </div>
              </motion.div>

              {/* Hairline Divider between rows 1-2 and 2-3 */}
              {idx < spotsToRender.length - 1 && (
                <div className="w-full h-[1px] bg-[#ECECEF]" />
              )}
            </React.Fragment>
          ))}
        </div>
      </motion.div>

      {/* Optional Discreet iOS Caption & Configuration Trigger */}
      {showControlsBar && (
        <div className="mt-3 w-full max-w-[368px] px-2 flex items-center justify-between text-[12px] text-[#6E6E73]">
          <button
            type="button"
            onClick={() => handleTapWidgetOrSpot()}
            className="flex items-center gap-1.5 font-medium text-[#111111] hover:opacity-75 transition-opacity cursor-pointer truncate max-w-[62%]"
          >
            <span className="w-2 h-2 rounded-full bg-[#007AFF] shrink-0" />
            <span className="truncate">{payload.itineraryTitle}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsStudioModalOpen(true);
            }}
            className="px-3 py-1 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#111111] font-semibold text-[11.5px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Smartphone className="w-3.5 h-3.5 stroke-[2]" />
            <span>Configurar Widget</span>
          </button>
        </div>
      )}

      {/* Widget Studio & SwiftUI Code Modal */}
      <AnimatePresence>
        {isStudioModalOpen && (
          <MonvianWidgetStudioModal
            isOpen={isStudioModalOpen}
            onClose={() => setIsStudioModalOpen(false)}
            currentPayload={payload}
            onSelectPrimaryItinerary={(itin) => {
              try {
                localStorage.setItem('monvian_active_itinerary', JSON.stringify(itin));
              } catch {}
              const nextPayload = syncWidgetWithItinerary(itin);
              setPayload(nextPayload);
            }}
            onOpenInRoteiros={(itinId, spotId) => {
              setIsStudioModalOpen(false);
              if (onActivateItinerary) {
                onActivateItinerary(itinId, spotId);
              } else {
                window.dispatchEvent(
                  new CustomEvent('monvian:open_widget_itinerary', {
                    detail: { itineraryId: itinId, spotId: spotId || null },
                  })
                );
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface MonvianWidgetStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPayload: MonvianWidgetPayload;
  onSelectPrimaryItinerary: (itinerary: Itinerary) => void;
  onOpenInRoteiros: (itineraryId: string, spotId?: string) => void;
}

export const MonvianWidgetStudioModal: React.FC<MonvianWidgetStudioModalProps> = ({
  isOpen,
  onClose,
  currentPayload,
  onSelectPrimaryItinerary,
  onOpenInRoteiros,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'swiftui'>('preview');
  const [copiedCode, setCopiedCode] = useState(false);
  const allItineraries = getKnownItinerariesList();

  if (!isOpen) return null;

  const handleCopySwiftCode = () => {
    navigator.clipboard?.writeText(SWIFTUI_WIDGETKIT_SNIPPET).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
        }}
        className="w-full max-w-lg max-h-[90vh] bg-[#F2F2F7] rounded-t-[34px] sm:rounded-[34px] overflow-hidden flex flex-col shadow-2xl border border-black/[0.06]"
      >
        {/* Top Bar */}
        <div className="px-6 pt-5 pb-3.5 bg-white border-b border-black/[0.06] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[18px] font-bold text-[#000000] tracking-tight leading-tight">
              Widget do iPhone
            </h3>
            <p className="text-[12.5px] text-[#6E6E73] font-normal">
              Sincronizado com seu roteiro principal no Monvian
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] flex items-center justify-center text-[#111111] transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 stroke-[2.4]" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="px-6 pt-3 pb-2 bg-white shrink-0">
          <div className="p-1 rounded-xl bg-[#F2F2F7] grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-white text-[#000000] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#000000]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Roteiro Principal</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('swiftui')}
              className={`py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'swiftui'
                  ? 'bg-white text-[#000000] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#000000]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SwiftUI WidgetKit</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'preview' ? (
            <>
              {/* Live Widget Preview */}
              <div className="flex justify-center">
                <MonvianIOSWidget
                  onActivateItinerary={(itinId, spotId) => onOpenInRoteiros(itinId, spotId)}
                  showControlsBar={false}
                />
              </div>

              {/* Selector to switch active primary itinerary for the widget */}
              <div className="bg-white rounded-[24px] p-4 border border-black/[0.05] space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[13px] font-bold text-[#000000]">
                    Roteiro Exibido no Widget
                  </span>
                  <span className="text-[11.5px] font-medium text-[#007AFF]">
                    Atualização automática
                  </span>
                </div>

                <div className="divide-y divide-[#ECECEF]">
                  {allItineraries.map((itin) => {
                    const isSelected = itin.id === currentPayload.itineraryId;
                    return (
                      <button
                        key={itin.id}
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback(10);
                          onSelectPrimaryItinerary(itin);
                        }}
                        className="w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left hover:bg-[#F2F2F7]/60 rounded-xl transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={itin.coverImage}
                            alt={itin.title}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 bg-[#F2F2F7]"
                          />
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[#000000] truncate">
                              {itin.title}
                            </p>
                            <p className="text-[12px] text-[#6E6E73] truncate">
                              {itin.daysCount} {itin.daysCount === 1 ? 'dia' : 'dias'} · 3 primeiros pontos no widget
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="w-6 h-6 rounded-full bg-[#007AFF] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                          </span>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#C7C7CC] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-[24px] p-4 border border-black/[0.05] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-[14px] font-bold text-[#000000]">
                    ios/MonvianWidget/MonvianWidget.swift
                  </h4>
                  <p className="text-[12px] text-[#6E6E73]">
                    WidgetKit nativo (.systemLarge) conectado a /api/widget/itinerary
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySwiftCode}
                  className="px-3.5 py-1.5 rounded-full bg-[#007AFF] text-white text-[12px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Swift</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-2xl bg-[#1C1C1E] text-[#F2F2F7] text-[11.5px] font-mono overflow-x-auto leading-relaxed max-h-[340px]">
                <code>{SWIFTUI_WIDGETKIT_SNIPPET}</code>
              </pre>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const SWIFTUI_WIDGETKIT_SNIPPET = `import WidgetKit
import SwiftUI

struct MonvianWidgetSpot: Codable, Identifiable {
    let position: Int
    let spotId: String
    let name: String
    let shortDescription: String
    let image: String
    let deepLinkUrl: String
    var id: String { spotId }
}

struct MonvianWidgetEntryView: View {
    var entry: MonvianTimelineProvider.Entry

    var body: some View {
        VStack(spacing: 0) {
            MonvianRouteHeaderGraphic()
            Text("Vamos começar\\nsua jornada?")
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(.black)
                .multilineTextAlignment(.center)
                .padding(.top, 4)
                .padding(.bottom, 12)

            ForEach(Array(entry.payload.spots.prefix(3).enumerated()), id: \\.element.id) { index, spot in
                Link(destination: URL(string: spot.deepLinkUrl)!) {
                    spotRow(spot: spot)
                }
                if index < 2 {
                    Divider().padding(.vertical, 7)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .widgetURL(URL(string: entry.payload.deepLinkUrl))
        .containerBackground(for: .widget) { Color.white }
    }
}`;
