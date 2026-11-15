import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { translatePtToEn } from '../i18n/ptToEnDictionary';

export type AppLanguage = 'pt' | 'en';

interface LanguageContextValue {
  language: AppLanguage;
  isEnglish: boolean;
  setLanguage: (lang: AppLanguage) => void;
  tr: (ptText: string) => string;
}

const STORAGE_KEY = 'monvian_language';
const LANGUAGE_EVENT = 'monvian:language_change';

const LanguageContext = createContext<LanguageContextValue>({
  language: 'pt',
  isEnglish: false,
  setLanguage: () => {},
  tr: (t) => t,
});

function readInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pt') {
      return saved;
    }
  } catch {}
  return 'pt';
}

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;
type TranslatableAttr = (typeof TRANSLATABLE_ATTRS)[number];

const SKIP_SELECTOR =
  'script, style, noscript, svg, code, pre, [contenteditable="true"], [data-no-translate]';

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (el.closest(SKIP_SELECTOR)) return true;
  return false;
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
    return true;
  }
  return shouldSkipElement(parent);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage);

  // WeakMaps preserve original Portuguese strings per DOM node safely across React re-renders
  const originalTextMapRef = useRef(new WeakMap<Text, string>());
  const lastWrittenTextMapRef = useRef(new WeakMap<Text, string>());
  const originalAttrMapRef = useRef(
    new WeakMap<Element, Partial<Record<TranslatableAttr, string>>>()
  );
  const lastWrittenAttrMapRef = useRef(
    new WeakMap<Element, Partial<Record<TranslatableAttr, string>>>()
  );
  const isApplyingRef = useRef(false);

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    setLanguageState((prev) => (prev === nextLang ? prev : nextLang));
    try {
      localStorage.setItem(STORAGE_KEY, nextLang);
      window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: nextLang }));
    } catch {}
  }, []);

  // Listen for language change events fired externally or across tabs
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === 'pt' || detail === 'en') {
        setLanguageState((prev) => (prev === detail ? prev : detail));
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'pt' || e.newValue === 'en')) {
        setLanguageState((prev) => (prev === e.newValue ? prev : (e.newValue as AppLanguage)));
      }
    };
    window.addEventListener(LANGUAGE_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const applyTranslationToTextNode = useCallback(
    (node: Text, lang: AppLanguage) => {
      if (shouldSkipTextNode(node)) return;
      const cur = node.nodeValue ?? '';
      if (!cur || !cur.trim()) return;

      const origMap = originalTextMapRef.current;
      const writtenMap = lastWrittenTextMapRef.current;
      const lastWritten = writtenMap.get(node);

      if (lang === 'en') {
        // If React/script updated the node with fresh text, refresh stored Portuguese source
        if (lastWritten === undefined || cur !== lastWritten) {
          origMap.set(node, cur);
        }
        const sourcePt = origMap.get(node) ?? cur;
        const translated = translatePtToEn(sourcePt);
        if (translated !== cur) {
          writtenMap.set(node, translated);
          node.nodeValue = translated;
        } else {
          writtenMap.set(node, cur);
        }
      } else {
        // Restore original Portuguese only if node still holds what we wrote
        const orig = origMap.get(node);
        if (orig !== undefined && lastWritten !== undefined && cur === lastWritten) {
          if (cur !== orig) {
            node.nodeValue = orig;
          }
          writtenMap.delete(node);
        }
      }
    },
    []
  );

  const applyTranslationToElementAttrs = useCallback(
    (el: Element, lang: AppLanguage) => {
      if (shouldSkipElement(el)) return;

      const origAttrMap = originalAttrMapRef.current;
      const writtenAttrMap = lastWrittenAttrMapRef.current;

      for (const attr of TRANSLATABLE_ATTRS) {
        const cur = el.getAttribute(attr);
        if (!cur || !cur.trim()) continue;

        let origRecord = origAttrMap.get(el);
        let writtenRecord = writtenAttrMap.get(el);
        const lastWritten = writtenRecord?.[attr];

        if (lang === 'en') {
          if (lastWritten === undefined || cur !== lastWritten) {
            if (!origRecord) {
              origRecord = {};
              origAttrMap.set(el, origRecord);
            }
            origRecord[attr] = cur;
          }
          const sourcePt = origRecord?.[attr] ?? cur;
          const translated = translatePtToEn(sourcePt);

          if (!writtenRecord) {
            writtenRecord = {};
            writtenAttrMap.set(el, writtenRecord);
          }

          if (translated !== cur) {
            writtenRecord[attr] = translated;
            el.setAttribute(attr, translated);
          } else {
            writtenRecord[attr] = cur;
          }
        } else {
          const orig = origRecord?.[attr];
          if (orig !== undefined && lastWritten !== undefined && cur === lastWritten) {
            if (cur !== orig) {
              el.setAttribute(attr, orig);
            }
            if (writtenRecord) {
              delete writtenRecord[attr];
            }
          }
        }
      }
    },
    []
  );

  const processSubtree = useCallback(
    (root: Node, lang: AppLanguage) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyTranslationToTextNode(root as Text, lang);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;

      const rootEl = root as Element;
      if (shouldSkipElement(rootEl)) return;

      applyTranslationToElementAttrs(rootEl, lang);

      const elWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
      let elNode: Node | null = elWalker.nextNode();
      while (elNode) {
        const el = elNode as Element;
        if (!shouldSkipElement(el)) {
          applyTranslationToElementAttrs(el, lang);
        }
        elNode = elWalker.nextNode();
      }

      const textWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
      let textNode: Node | null = textWalker.nextNode();
      while (textNode) {
        applyTranslationToTextNode(textNode as Text, lang);
        textNode = textWalker.nextNode();
      }
    },
    [applyTranslationToElementAttrs, applyTranslationToTextNode]
  );

  // Sync <html lang>, run pass on mount/language change, and attach MutationObserver in English mode
  useLayoutEffect(() => {
    try {
      document.documentElement.lang = language === 'en' ? 'en' : 'pt-BR';
    } catch {}

    const root = document.body;
    if (!root) return;

    isApplyingRef.current = true;
    try {
      processSubtree(root, language);
    } finally {
      isApplyingRef.current = false;
    }

    if (language !== 'en') {
      return;
    }

    const pendingRoots = new Set<Node>();
    const pendingAttrs = new Set<Element>();
    let flushScheduled = false;

    const flush = () => {
      flushScheduled = false;
      if (pendingRoots.size === 0 && pendingAttrs.size === 0) return;

      const roots = Array.from(pendingRoots);
      const attrs = Array.from(pendingAttrs);
      pendingRoots.clear();
      pendingAttrs.clear();

      isApplyingRef.current = true;
      try {
        for (const el of attrs) {
          if (el.isConnected) {
            applyTranslationToElementAttrs(el, 'en');
          }
        }
        for (const node of roots) {
          if (node.isConnected) {
            processSubtree(node, 'en');
          }
        }
      } finally {
        isApplyingRef.current = false;
      }
    };

    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      queueMicrotask(flush);
    };

    const observer = new MutationObserver((mutations) => {
      if (isApplyingRef.current) return;

      let hasWork = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => {
            pendingRoots.add(n);
            hasWork = true;
          });
        } else if (m.type === 'characterData') {
          pendingRoots.add(m.target);
          hasWork = true;
        } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
          pendingAttrs.add(m.target as Element);
          hasWork = true;
        }
      }

      if (hasWork) {
        scheduleFlush();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    return () => {
      observer.disconnect();
      pendingRoots.clear();
      pendingAttrs.clear();
    };
  }, [language, applyTranslationToElementAttrs, processSubtree]);

  const tr = useCallback(
    (ptText: string) => {
      if (language === 'en') {
        return translatePtToEn(ptText);
      }
      return ptText;
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isEnglish: language === 'en',
      setLanguage,
      tr,
    }),
    [language, setLanguage, tr]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
