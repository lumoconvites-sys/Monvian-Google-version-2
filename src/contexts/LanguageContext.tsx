import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

export type AppLanguage = 'pt' | 'en' | 'es' | 'ja';
type TranslatorFn = (raw: string) => string;

interface LanguageContextValue {
  language: AppLanguage;
  isEnglish: boolean;
  setLanguage: (lang: AppLanguage) => void;
  tr: (ptText: string) => string;
}

const STORAGE_KEY = 'monvian_language';
const LANGUAGE_EVENT = 'monvian:language_change';
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;
type TranslatableAttr = (typeof TRANSLATABLE_ATTRS)[number];

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CODE', 'PRE']);
const SKIP_TEXT_PARENT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE']);
const SKIP_SELECTOR =
  'script, style, noscript, svg, code, pre, [contenteditable="true"], [data-no-translate], .notranslate';

// On-demand lazy dictionary cache — zero dictionaries loaded when using default Portuguese ('pt')
const translatorCache = new Map<AppLanguage, TranslatorFn>();
const translatorPromises = new Map<AppLanguage, Promise<TranslatorFn>>();

function loadTranslator(lang: AppLanguage): Promise<TranslatorFn> {
  if (lang === 'pt') return Promise.resolve((raw: string) => raw);
  const cached = translatorCache.get(lang);
  if (cached) return Promise.resolve(cached);
  const existing = translatorPromises.get(lang);
  if (existing) return existing;

  let promise: Promise<TranslatorFn>;
  if (lang === 'en') {
    promise = import('../i18n/ptToEnDictionary').then((m) => m.translatePtToEn);
  } else if (lang === 'es') {
    promise = import('../i18n/ptToEsDictionary').then((m) => m.translatePtToEs);
  } else {
    promise = import('../i18n/ptToJaDictionary').then((m) => m.translatePtToJa);
  }

  const wrapped = promise.then((fn) => {
    translatorCache.set(lang, fn);
    translatorPromises.delete(lang);
    return fn;
  });
  translatorPromises.set(lang, wrapped);
  return wrapped;
}

function isValidAppLanguage(val: unknown): val is AppLanguage {
  return val === 'pt' || val === 'en' || val === 'es' || val === 'ja';
}

function readInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'pt';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValidAppLanguage(saved)) return saved;
  } catch {
    // ignore storage errors
  }
  return 'pt';
}

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  return Boolean(el.closest(SKIP_SELECTOR));
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TEXT_PARENT_TAGS.has(parent.tagName.toUpperCase())) return true;
  return shouldSkipElement(parent);
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'pt',
  isEnglish: false,
  setLanguage: () => {},
  tr: (ptText) => ptText,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage);
  const [translatorReadyVersion, setTranslatorReadyVersion] = useState(0);
  const langRef = useRef<AppLanguage>(language);
  const hasEverTranslatedRef = useRef<boolean>(false);

  // WeakMaps preserve original Portuguese strings per DOM node safely across React re-renders
  const originalTextMapRef = useRef(new WeakMap<Text, string>());
  const lastWrittenTextMapRef = useRef(new WeakMap<Text, string>());
  const originalAttrMapRef = useRef(
    new WeakMap<Element, Partial<Record<TranslatableAttr, string>>>()
  );
  const lastWrittenAttrMapRef = useRef(
    new WeakMap<Element, Partial<Record<TranslatableAttr, string>>>()
  );

  langRef.current = language;

  // Preload language dictionaries so switching languages is instantaneous with zero reload
  useEffect(() => {
    let cancelled = false;
    const langsToLoad: AppLanguage[] =
      language !== 'pt' ? [language, 'en', 'es', 'ja'] : ['en', 'es', 'ja'];
    for (const lang of langsToLoad) {
      if (lang === 'pt' || translatorCache.has(lang)) continue;
      loadTranslator(lang)
        .then(() => {
          if (!cancelled) {
            setTranslatorReadyVersion((v) => v + 1);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    const normalized: AppLanguage = isValidAppLanguage(nextLang) ? nextLang : 'pt';
    setLanguageState((prev) => (prev === normalized ? prev : normalized));
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
      window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: normalized }));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Listen for language change events fired externally or across tabs
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (isValidAppLanguage(detail)) {
        setLanguageState((prev) => (prev === detail ? prev : detail));
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isValidAppLanguage(e.newValue)) {
        const nextVal = e.newValue;
        setLanguageState((prev) => (prev === nextVal ? prev : nextVal));
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
    (node: Text, lang: AppLanguage, translate: TranslatorFn | null) => {
      if (shouldSkipTextNode(node)) return;
      const cur = node.nodeValue ?? '';
      if (!cur || !cur.trim()) return;

      const origMap = originalTextMapRef.current;
      const writtenMap = lastWrittenTextMapRef.current;
      const lastWritten = writtenMap.get(node);

      if (lang !== 'pt' && translate) {
        if (lastWritten === undefined || cur !== lastWritten) {
          origMap.set(node, cur);
        }
        const sourcePt = origMap.get(node) ?? cur;
        const translated = translate(sourcePt);
        if (translated !== cur) {
          writtenMap.set(node, translated);
          node.nodeValue = translated;
        } else {
          writtenMap.set(node, cur);
        }
      } else if (lang === 'pt') {
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
    (el: Element, lang: AppLanguage, translate: TranslatorFn | null) => {
      if (shouldSkipElement(el)) return;

      const origAttrMap = originalAttrMapRef.current;
      const writtenAttrMap = lastWrittenAttrMapRef.current;

      for (const attr of TRANSLATABLE_ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        const cur = el.getAttribute(attr);
        if (!cur || !cur.trim()) continue;

        let origRecord = origAttrMap.get(el);
        let writtenRecord = writtenAttrMap.get(el);
        const lastWritten = writtenRecord?.[attr];

        if (lang !== 'pt' && translate) {
          if (lastWritten === undefined || cur !== lastWritten) {
            if (!origRecord) {
              origRecord = {};
              origAttrMap.set(el, origRecord);
            }
            origRecord[attr] = cur;
          }
          const sourcePt = origRecord?.[attr] ?? cur;
          const translated = translate(sourcePt);
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
        } else if (lang === 'pt') {
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
    (root: Node, lang: AppLanguage, translate: TranslatorFn | null) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyTranslationToTextNode(root as Text, lang, translate);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        return;
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        if (shouldSkipElement(root as Element)) return;
        applyTranslationToElementAttrs(root as Element, lang, translate);
      }

      // Single-pass TreeWalker for both elements and text nodes with subtree rejection
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              if (
                SKIP_TAGS.has(el.tagName.toUpperCase()) ||
                el.getAttribute('contenteditable') === 'true' ||
                el.hasAttribute('data-no-translate') ||
                el.classList.contains('notranslate')
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          applyTranslationToTextNode(current as Text, lang, translate);
        } else {
          applyTranslationToElementAttrs(current as Element, lang, translate);
        }
        current = walker.nextNode();
      }
    },
    [applyTranslationToElementAttrs, applyTranslationToTextNode]
  );

  // Sync <html lang> & translate DOM ONLY when needed (zero work on initial PT boot)
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      const htmlLangMap: Record<AppLanguage, string> = {
        pt: 'pt-BR',
        en: 'en',
        es: 'es',
        ja: 'ja',
      };
      document.documentElement.lang = htmlLangMap[language] ?? 'pt-BR';
      document.documentElement.dataset.monvianLang = language;
    } catch {
      // ignore DOM errors
    }

    if (language === 'pt') {
      // Skip expensive full-DOM walk on initial PT load when nothing was ever translated
      if (hasEverTranslatedRef.current && document.body) {
        processSubtree(document.body, 'pt', null);
        hasEverTranslatedRef.current = false;
      }
      return;
    }

    const translate = translatorCache.get(language);
    if (!translate) return;

    if (document.body) {
      hasEverTranslatedRef.current = true;
      processSubtree(document.body, language, translate);
    }
  }, [language, translatorReadyVersion, processSubtree]);

  // Observe dynamic DOM updates (modals, routes, sheets, toasts) via rAF batching when non-PT is active
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    if (language === 'pt') return;

    const translate = translatorCache.get(language);
    if (!translate) return;

    let rafId: number | null = null;
    const pendingNodes = new Set<Node>();
    const pendingAttrs = new Set<Element>();

    const flush = () => {
      rafId = null;
      const activeLang = langRef.current;
      if (activeLang === 'pt') {
        pendingNodes.clear();
        pendingAttrs.clear();
        return;
      }
      const activeTranslate = translatorCache.get(activeLang);
      if (!activeTranslate) {
        pendingNodes.clear();
        pendingAttrs.clear();
        return;
      }
      observer.disconnect();
      try {
        pendingAttrs.forEach((el) => {
          if (el.isConnected) {
            applyTranslationToElementAttrs(el, activeLang, activeTranslate);
          }
        });
        pendingNodes.forEach((node) => {
          if (node.isConnected) {
            processSubtree(node, activeLang, activeTranslate);
          }
        });
      } finally {
        pendingNodes.clear();
        pendingAttrs.clear();
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: [...TRANSLATABLE_ATTRS],
          });
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => pendingNodes.add(n));
        } else if (m.type === 'characterData') {
          pendingNodes.add(m.target);
        } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
          pendingAttrs.add(m.target as Element);
        }
      }
      if ((pendingNodes.size > 0 || pendingAttrs.size > 0) && rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRS],
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingNodes.clear();
      pendingAttrs.clear();
    };
  }, [language, translatorReadyVersion, applyTranslationToElementAttrs, processSubtree]);

  const tr = useCallback(
    (ptText: string): string => {
      if (language === 'pt') return ptText;
      const translate = translatorCache.get(language);
      return translate ? translate(ptText) : ptText;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, translatorReadyVersion]
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
