import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Check,
  Plus,
  Sparkles,
  Grid,
  MapPin,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { MapVisualIcon } from '../../types';
import {
  STOP_ICON_CATEGORY_PRESETS,
  STOP_ICON_COLOR_PALETTE,
  FEATURED_STOP_SYMBOLS,
  ALL_LUCIDE_ICON_NAMES,
  searchLucideIconNames,
  resolveLucideIconName,
  sanitizeHexColor,
  getLucideIconNodeSync,
  loadLucideIconNode,
  type LucideSvgNode,
} from '../../utils/mapVisualIcons';
import { AdminMapPicker } from './AdminMapPicker';
import { IOSSwitch } from '../IOSSwitch';
import { ADMIN_MOTION_EASE } from './adminTheme';
import { persistMapVisualIconToFirestore } from '../../services/firestoreSync';

/**
 * Lightweight, memoized SVG renderer for ANY icon in the installed lucide-react library.
 * Loads on demand via lucide-react/dynamicIconImports and caches permanently in memory.
 */
export const LucideSymbolGlyph: React.FC<{
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}> = React.memo(({ name, size = 18, color = '#FFFFFF', strokeWidth = 2.2, className = '' }) => {
  const canonical = resolveLucideIconName(name);
  const [node, setNode] = useState<LucideSvgNode | null>(() => getLucideIconNodeSync(canonical));

  useEffect(() => {
    const sync = getLucideIconNodeSync(canonical);
    if (sync) {
      setNode(sync);
      return;
    }
    let mounted = true;
    loadLucideIconNode(canonical).then((resolved) => {
      if (mounted) setNode(resolved);
    });
    return () => {
      mounted = false;
    };
  }, [canonical]);

  if (!node) {
    return (
      <span
        className={`inline-block rounded-full bg-current opacity-30 ${className}`}
        style={{ width: size * 0.55, height: size * 0.55 }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {node.map(([tag, attrs], idx) => {
        const key = `${canonical}-${idx}`;
        switch (tag) {
          case 'path':
            return <path key={key} {...(attrs as React.SVGProps<SVGPathElement>)} />;
          case 'circle':
            return <circle key={key} {...(attrs as React.SVGProps<SVGCircleElement>)} />;
          case 'rect':
            return <rect key={key} {...(attrs as React.SVGProps<SVGRectElement>)} />;
          case 'line':
            return <line key={key} {...(attrs as React.SVGProps<SVGLineElement>)} />;
          case 'polyline':
            return <polyline key={key} {...(attrs as React.SVGProps<SVGPolylineElement>)} />;
          case 'polygon':
            return <polygon key={key} {...(attrs as React.SVGProps<SVGPolygonElement>)} />;
          case 'ellipse':
            return <ellipse key={key} {...(attrs as React.SVGProps<SVGEllipseElement>)} />;
          default:
            return null;
        }
      })}
    </svg>
  );
});

LucideSymbolGlyph.displayName = 'LucideSymbolGlyph';

interface AdminStopIconModalProps {
  isOpen: boolean;
  onClose: () => void;
  iconToEdit: MapVisualIcon | null;
  existingCategories: string[];
  onSaved: (savedIcon: MapVisualIcon, isNew: boolean) => void;
  authHeaders: Record<string, string>;
}

const DEFAULT_COORDS = { lat: -22.7236, lng: -45.5952 };

export const AdminStopIconModal: React.FC<AdminStopIconModalProps> = ({
  isOpen,
  onClose,
  iconToEdit,
  existingCategories,
  onSaved,
  authHeaders,
}) => {
  const [name, setName] = useState('');
  const [categoryMode, setCategoryMode] = useState<'preset' | 'custom'>('preset');
  const [category, setCategory] = useState<string>('gas_station');
  const [customCategory, setCustomCategory] = useState('');
  const [iconName, setIconName] = useState<string>('fuel');
  const [color, setColor] = useState<string>('#1668FF');
  const [hexInput, setHexInput] = useState<string>('#1668FF');
  const [latitude, setLatitude] = useState<number>(DEFAULT_COORDS.lat);
  const [longitude, setLongitude] = useState<number>(DEFAULT_COORDS.lng);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [visibleSymbolCount, setVisibleSymbolCount] = useState(72);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const colorPickerInputRef = useRef<HTMLInputElement>(null);

  // Merge built-in presets with any custom categories previously saved by the admin
  const customSavedCategories = useMemo(() => {
    const presetKeys = new Set(STOP_ICON_CATEGORY_PRESETS.map((p) => p.key));
    const presetLabelsLower = new Set(STOP_ICON_CATEGORY_PRESETS.map((p) => p.label.toLowerCase()));
    return existingCategories.filter(
      (cat) => cat && !presetKeys.has(cat) && !presetLabelsLower.has(cat.toLowerCase())
    );
  }, [existingCategories]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSymbolSearch('');
    setVisibleSymbolCount(72);

    if (iconToEdit) {
      setName(iconToEdit.name || '');
      const presetMatch = STOP_ICON_CATEGORY_PRESETS.find((p) => p.key === iconToEdit.category);
      if (presetMatch || customSavedCategories.includes(iconToEdit.category)) {
        setCategoryMode('preset');
        setCategory(iconToEdit.category);
        setCustomCategory('');
      } else {
        setCategoryMode('custom');
        setCategory('__custom__');
        setCustomCategory(iconToEdit.category || '');
      }
      const resolvedIcon = resolveLucideIconName(iconToEdit.icon, iconToEdit.category);
      const resolvedColor = sanitizeHexColor(iconToEdit.color, iconToEdit.category);
      setIconName(resolvedIcon);
      setColor(resolvedColor);
      setHexInput(resolvedColor);
      setLatitude(Number(iconToEdit.latitude) || DEFAULT_COORDS.lat);
      setLongitude(Number(iconToEdit.longitude) || DEFAULT_COORDS.lng);
      setIsActive(Number(iconToEdit.is_active ?? 1) === 1);
      setIsLibraryOpen(false);
    } else {
      setName('');
      setCategoryMode('preset');
      setCategory('gas_station');
      setCustomCategory('');
      setIconName('fuel');
      setColor('#1668FF');
      setHexInput('#1668FF');
      setLatitude(DEFAULT_COORDS.lat);
      setLongitude(DEFAULT_COORDS.lng);
      setIsActive(true);
      setIsLibraryOpen(false);
    }
  }, [isOpen, iconToEdit, customSavedCategories]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSaving, onClose]);

  const filteredSymbols = useMemo(() => {
    return searchLucideIconNames(symbolSearch);
  }, [symbolSearch]);

  const displayedSymbols = useMemo(
    () => filteredSymbols.slice(0, visibleSymbolCount),
    [filteredSymbols, visibleSymbolCount]
  );

  const handleCategorySelectChange = (value: string) => {
    if (value === '__custom__') {
      setCategoryMode('custom');
      setCategory('__custom__');
      return;
    }
    setCategoryMode('preset');
    setCategory(value);
    const preset = STOP_ICON_CATEGORY_PRESETS.find((p) => p.key === value);
    if (preset && !iconToEdit) {
      setIconName(preset.defaultIcon);
      setColor(preset.defaultColor);
      setHexInput(preset.defaultColor);
    }
  };

  const handleHexChange = (raw: string) => {
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
    setHexInput(cleaned.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      setColor(cleaned.toUpperCase());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const resolvedCategory =
      categoryMode === 'custom' ? customCategory.trim() : category.trim();

    if (!trimmedName) {
      setErrorMsg('Informe o nome do ponto de parada.');
      return;
    }
    if (!resolvedCategory) {
      setErrorMsg('Selecione ou informe uma categoria.');
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setErrorMsg('Selecione uma localização válida no mapa.');
      return;
    }

    const safeColor = sanitizeHexColor(color, resolvedCategory);
    const safeIcon = resolveLucideIconName(iconName, resolvedCategory);

    setIsSaving(true);
    try {
      const payload = {
        name: trimmedName,
        category: resolvedCategory,
        icon: safeIcon,
        color: safeColor,
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        is_active: isActive ? 1 : 0,
      };

      const isEdit = Boolean(iconToEdit?.id);
      const url = isEdit
        ? `/api/admin/map-visual-icons/${encodeURIComponent(iconToEdit!.id)}`
        : '/api/admin/map-visual-icons';

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.success || !data?.icon) {
        throw new Error(data?.error || 'Não foi possível salvar o ícone.');
      }

      const savedIcon: MapVisualIcon = data.icon;

      // Mirror immediately to Firestore client SDK so realtime listeners stay in sync on the same tick
      persistMapVisualIconToFirestore(savedIcon).catch(() => {});

      // Dispatch immediate optimistic event so the main map updates live with 0ms delay
      window.dispatchEvent(
        new CustomEvent('monvian:visual_icons_updated', {
          detail: { action: 'upsert', icon: savedIcon },
        })
      );

      onSaved(savedIcon, !isEdit);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar o marcador. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={iconToEdit ? 'Editar Ícone de Parada' : 'Novo Ícone de Parada'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => !isSaving && onClose()}
          className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center bg-[#0D1526]/40 backdrop-blur-[4px] sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.24, ease: ADMIN_MOTION_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[540px] max-h-[92dvh] bg-white rounded-t-[28px] sm:rounded-[28px] flex flex-col overflow-hidden"
            style={{
              boxShadow: '0 28px 64px -16px rgba(15, 23, 42, 0.28)',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
            }}
          >
            {/* Mobile Sheet Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Modal Header */}
            <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-3.5 flex items-center justify-between gap-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Live Marker Preview matching exact map appearance */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200"
                  style={{
                    backgroundColor: sanitizeHexColor(color, category),
                    border: '2px solid #FFFFFF',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.20)',
                  }}
                >
                  <LucideSymbolGlyph name={iconName} size={19} color="#FFFFFF" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[18px] sm:text-[19px] font-bold tracking-[-0.025em] text-[#0D1526] truncate">
                    {iconToEdit ? 'Editar Ícone de Parada' : 'Novo Ícone de Parada'}
                  </h2>
                  <p className="text-[12px] text-slate-500 truncate">
                    Personalize símbolo, cor e posição exata no mapa
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isSaving && onClose()}
                aria-label="Fechar"
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
              {errorMsg && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
                  {errorMsg}
                </div>
              )}

              {/* 1. Nome do Ponto */}
              <div>
                <label className="block text-[13px] font-semibold text-[#0D1526] mb-1.5">
                  Nome do Ponto
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="Ex: Posto Shell, Farmácia São Paulo..."
                  className="w-full px-4 py-3 rounded-[16px] bg-[#F7F9FC] border border-slate-200/90 text-[14.5px] font-medium text-[#0D1526] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#1668FF] focus:ring-2 focus:ring-[#1668FF]/15 transition-all"
                  required
                />
              </div>

              {/* 2. Categoria (Preset ou Personalizada) */}
              <div>
                <label className="block text-[13px] font-semibold text-[#0D1526] mb-1.5">
                  Categoria
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${sanitizeHexColor(color, category)}1A` }}
                    >
                      <LucideSymbolGlyph
                        name={iconName}
                        size={14}
                        color={sanitizeHexColor(color, category)}
                        strokeWidth={2.2}
                      />
                    </span>
                  </div>
                  <select
                    value={categoryMode === 'custom' ? '__custom__' : category}
                    onChange={(e) => handleCategorySelectChange(e.target.value)}
                    className="w-full appearance-none pl-12 pr-10 py-3 rounded-[16px] bg-[#F7F9FC] border border-slate-200/90 text-[14.5px] font-medium text-[#0D1526] focus:outline-none focus:bg-white focus:border-[#1668FF] focus:ring-2 focus:ring-[#1668FF]/15 transition-all cursor-pointer"
                  >
                    {STOP_ICON_CATEGORY_PRESETS.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label}
                      </option>
                    ))}
                    {customSavedCategories.length > 0 && (
                      <optgroup label="Categorias personalizadas">
                        {customSavedCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__custom__">+ Criar nova categoria personalizada...</option>
                  </select>
                  <ChevronDown className="pointer-events-none w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>

                {categoryMode === 'custom' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    maxLength={80}
                    placeholder="Digite o nome da nova categoria (ex: Lavanderia, Pet Shop...)"
                    className="mt-2.5 w-full px-4 py-2.5 rounded-[14px] bg-white border border-[#1668FF]/50 text-[14px] font-medium text-[#0D1526] placeholder:text-slate-400 focus:outline-none focus:border-[#1668FF] focus:ring-2 focus:ring-[#1668FF]/15"
                    required
                  />
                )}
              </div>

              {/* 3. Símbolo e Cor */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[13px] font-semibold text-[#0D1526]">
                    Símbolo e Cor
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLibraryOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1668FF] hover:text-[#0F5AE6] bg-[#EFF5FF] hover:bg-[#E1EEFF] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>
                      {isLibraryOpen
                        ? 'Ocultar biblioteca'
                        : `Todos os símbolos (${ALL_LUCIDE_ICON_NAMES.length})`}
                    </span>
                  </button>
                </div>

                {/* Featured Quick-Pick Symbols Row (2 x 6 clean grid matching reference) */}
                <div className="grid grid-cols-6 gap-2.5">
                  {FEATURED_STOP_SYMBOLS.map((sym) => {
                    const isSelected = resolveLucideIconName(iconName) === sym.name;
                    return (
                      <button
                        key={sym.name}
                        type="button"
                        title={sym.label}
                        onClick={() => {
                          setIconName(sym.name);
                          if (!iconToEdit) {
                            setColor(sym.color);
                            setHexInput(sym.color);
                          }
                        }}
                        className={`relative aspect-square rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-92 ${
                          isSelected
                            ? 'ring-[2.5px] ring-[#1668FF] ring-offset-2 scale-[1.04]'
                            : 'hover:scale-105 opacity-92 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isSelected ? sanitizeHexColor(color) : sym.color,
                          boxShadow: '0 4px 10px -2px rgba(15, 23, 42, 0.16)',
                        }}
                      >
                        <LucideSymbolGlyph name={sym.name} size={20} color="#FFFFFF" strokeWidth={2.2} />
                      </button>
                    );
                  })}
                </div>

                {/* Full Searchable Lucide Icon Library Browser */}
                <AnimatePresence initial={false}>
                  {isLibraryOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-[20px] bg-[#F7F9FC] border border-slate-200/80 p-3 space-y-2.5">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={symbolSearch}
                            onChange={(e) => {
                              setSymbolSearch(e.target.value);
                              setVisibleSymbolCount(72);
                            }}
                            placeholder="Buscar símbolo por nome (ex: farmácia, café, car, wifi, heart)..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-[13px] text-[#0D1526] placeholder:text-slate-400 focus:outline-none focus:border-[#1668FF]"
                          />
                          {symbolSearch && (
                            <button
                              type="button"
                              onClick={() => setSymbolSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#1668FF]" />
                            Selecionado: <strong className="text-[#0D1526]">{iconName}</strong>
                          </span>
                          <span>{filteredSymbols.length} disponíveis</span>
                        </div>

                        <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                          {displayedSymbols.map((symName) => {
                            const selected = resolveLucideIconName(iconName) === symName;
                            return (
                              <button
                                key={symName}
                                type="button"
                                title={symName}
                                onClick={() => setIconName(symName)}
                                className={`h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                  selected
                                    ? 'text-white shadow-sm scale-[1.03]'
                                    : 'bg-white border border-slate-200/70 text-slate-700 hover:border-[#1668FF]/50 hover:text-[#1668FF]'
                                }`}
                                style={selected ? { backgroundColor: sanitizeHexColor(color) } : undefined}
                              >
                                <LucideSymbolGlyph
                                  name={symName}
                                  size={17}
                                  color={selected ? '#FFFFFF' : '#334155'}
                                  strokeWidth={2}
                                />
                              </button>
                            );
                          })}
                        </div>

                        {filteredSymbols.length > visibleSymbolCount && (
                          <button
                            type="button"
                            onClick={() => setVisibleSymbolCount((prev) => prev + 96)}
                            className="w-full py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[12px] font-semibold text-[#1668FF] transition-colors cursor-pointer"
                          >
                            Carregar mais símbolos ({filteredSymbols.length - visibleSymbolCount} restantes)
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Color Palette + Hex Picker */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {STOP_ICON_COLOR_PALETTE.map((swatch) => {
                    const isSelected = sanitizeHexColor(color) === swatch.toUpperCase();
                    return (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => {
                          setColor(swatch);
                          setHexInput(swatch);
                        }}
                        aria-label={`Cor ${swatch}`}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer active:scale-90 ${
                          isSelected ? 'ring-2 ring-[#1668FF] ring-offset-2 scale-105' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}

                  {/* Custom color wheel trigger */}
                  <button
                    type="button"
                    onClick={() => colorPickerInputRef.current?.click()}
                    title="Cor personalizada"
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <input
                    ref={colorPickerInputRef}
                    type="color"
                    value={sanitizeHexColor(color)}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setColor(next);
                      setHexInput(next);
                    }}
                    className="sr-only"
                    aria-label="Seletor de cor personalizado"
                  />

                  {/* Hex Input */}
                  <div className="ml-auto flex items-center gap-1.5 bg-[#F7F9FC] border border-slate-200 rounded-xl px-2.5 py-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: sanitizeHexColor(color) }}
                    />
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => handleHexChange(e.target.value)}
                      maxLength={7}
                      aria-label="Código hexadecimal da cor"
                      className="w-[64px] bg-transparent text-[12px] font-mono font-semibold text-slate-700 outline-none uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Localização no Mapa Interativo (Reutilizando AdminMapPicker com Satélite) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold text-[#0D1526] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#1668FF]" />
                    <span>Localização no Mapa</span>
                  </label>
                  <span className="text-[11.5px] font-mono text-slate-500">
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </span>
                </div>
                <AdminMapPicker
                  lat={latitude}
                  lng={longitude}
                  onChange={(newLat, newLng) => {
                    setLatitude(newLat);
                    setLongitude(newLng);
                  }}
                  markerColor={sanitizeHexColor(color, category)}
                  markerIconName={resolveLucideIconName(iconName, category)}
                  initialMapMode="satelite"
                />
              </div>

              {/* 5. Status de exibição */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[16px] bg-[#F7F9FC] border border-slate-200/80">
                <div>
                  <p className="text-[13.5px] font-semibold text-[#0D1526]">
                    Exibir imediatamente no mapa
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    Publica o marcador em tempo real no mapa principal
                  </p>
                </div>
                <IOSSwitch checked={isActive} onChange={setIsActive} />
              </div>

              {/* Submit Action */}
              <div className="pt-1 pb-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 rounded-[18px] bg-[#1668FF] hover:bg-[#0F5AE6] active:scale-[0.99] disabled:opacity-60 text-white text-[15px] font-bold tracking-[-0.01em] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    boxShadow: '0 10px 24px -6px rgba(22, 104, 255, 0.45)',
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>{iconToEdit ? 'Salvar Alterações' : 'Salvar Ícone'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
