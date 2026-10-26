import { useState, useEffect, useCallback } from 'react';
import { Itinerary, PlatanoPackage, PlatanoWalletData } from '../types';

const DEFAULT_PACKAGES: PlatanoPackage[] = [
  { id: 'pkg_15', platanos: 15, priceCents: 1590, priceBRL: 'R$ 15,90', badge: '', isBestValue: false, isActive: true, sortOrder: 1 },
  { id: 'pkg_30', platanos: 30, priceCents: 2290, priceBRL: 'R$ 22,90', badge: '', isBestValue: false, isActive: true, sortOrder: 2 },
  { id: 'pkg_60', platanos: 60, priceCents: 2990, priceBRL: 'R$ 29,90', badge: '', isBestValue: false, isActive: true, sortOrder: 3 },
  { id: 'pkg_100', platanos: 100, priceCents: 3490, priceBRL: 'R$ 34,90', badge: '', isBestValue: false, isActive: true, sortOrder: 4 },
  { id: 'pkg_200', platanos: 200, priceCents: 3990, priceBRL: 'R$ 39,90', badge: 'Melhor custo-benefício', isBestValue: true, isActive: true, sortOrder: 5 },
];

const INITIAL_WALLET_STATE: PlatanoWalletData = {
  userId: 0,
  userEmail: '',
  balance: 0,
  totalCredited: 0,
  totalSpent: 0,
  unlockedItineraryIds: [],
  transactions: [],
  orders: [],
  packages: DEFAULT_PACKAGES,
  itineraryPrices: {},
};

let memoryWalletSnapshot: PlatanoWalletData = INITIAL_WALLET_STATE;
let memoryWalletSerialized = '';
let inflightRefreshPromise: Promise<PlatanoWalletData> | null = null;

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token =
      localStorage.getItem('monvian_token') ||
      localStorage.getItem('monvian_auth_token') ||
      '';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const rawUser = localStorage.getItem('monvian_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const email = (parsed?.email || parsed?.whatsapp || '').trim().toLowerCase();
      if (email) {
        headers['x-user-email'] = email;
      }
    }
  } catch {}
  return headers;
}

export function broadcastPlatanosWalletUpdate(wallet?: PlatanoWalletData) {
  if (wallet) {
    memoryWalletSnapshot = wallet;
    try {
      memoryWalletSerialized = JSON.stringify(wallet);
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:platanos_updated', { detail: { wallet: memoryWalletSnapshot } })
    );
  }
}

export function usePlatanos() {
  const [wallet, setWallet] = useState<PlatanoWalletData>(() => memoryWalletSnapshot);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshWallet = useCallback(async () => {
    if (inflightRefreshPromise) {
      return inflightRefreshPromise;
    }

    inflightRefreshPromise = (async () => {
      try {
        const res = await fetch('/api/platanos/wallet', {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return memoryWalletSnapshot;
        const data = await res.json();
        if (data?.wallet) {
          const next: PlatanoWalletData = {
            ...INITIAL_WALLET_STATE,
            ...data.wallet,
            packages:
              Array.isArray(data.wallet.packages) && data.wallet.packages.length > 0
                ? data.wallet.packages
                : DEFAULT_PACKAGES,
            unlockedItineraryIds: Array.isArray(data.wallet.unlockedItineraryIds)
              ? data.wallet.unlockedItineraryIds
              : [],
            transactions: Array.isArray(data.wallet.transactions) ? data.wallet.transactions : [],
            orders: Array.isArray(data.wallet.orders) ? data.wallet.orders : [],
            itineraryPrices: data.wallet.itineraryPrices || {},
          };
          const serialized = JSON.stringify(next);
          if (serialized !== memoryWalletSerialized) {
            memoryWalletSerialized = serialized;
            memoryWalletSnapshot = next;
            setWallet(next);
          }
          return next;
        }
      } catch {
        // Preserve existing snapshot on transient network issue
      } finally {
        inflightRefreshPromise = null;
        setLoading(false);
      }
      return memoryWalletSnapshot;
    })();

    return inflightRefreshPromise;
  }, []);

  useEffect(() => {
    refreshWallet();

    const handleWalletEvent = (e: Event) => {
      const custom = e as CustomEvent<{ wallet?: PlatanoWalletData }>;
      if (custom.detail?.wallet) {
        setWallet(custom.detail.wallet);
      } else {
        refreshWallet();
      }
    };

    window.addEventListener('monvian:platanos_updated', handleWalletEvent);
    return () => {
      window.removeEventListener('monvian:platanos_updated', handleWalletEvent);
    };
  }, [refreshWallet]);

  const getItineraryPlatanoPrice = useCallback(
    (itinerary?: Itinerary | null): number => {
      if (!itinerary) return 0;
      const isPrem = Boolean(
        itinerary.isPremium ||
          (itinerary as any).isGold ||
          (itinerary as any).is_gold
      );
      if (!isPrem || itinerary.badgeText?.toLowerCase() === 'livre') {
        return 0;
      }
      const mapped = wallet.itineraryPrices?.[itinerary.id];
      if (typeof mapped === 'number' && mapped > 0) {
        return mapped;
      }
      if (typeof itinerary.platanosPrice === 'number' && itinerary.platanosPrice > 0) {
        return itinerary.platanosPrice;
      }
      return 15;
    },
    [wallet.itineraryPrices]
  );

  const isItineraryUnlocked = useCallback(
    (itineraryId?: string | null): boolean => {
      if (!itineraryId) return false;
      return wallet.unlockedItineraryIds.includes(itineraryId);
    },
    [wallet.unlockedItineraryIds]
  );

  const startTopUpCheckout = useCallback(async (packageId: string) => {
    const res = await fetch('/api/platanos/checkout', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.error || 'Não foi possível iniciar o pagamento no Stripe.');
    }
    window.location.href = data.url;
  }, []);

  const purchaseItinerary = useCallback(
    async (itineraryId: string, itineraryTitle: string) => {
      const res = await fetch('/api/platanos/purchase-itinerary', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ itineraryId, itineraryTitle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const err: any = new Error(data.error || 'Não foi possível concluir a compra.');
        err.code = data.code || 'PURCHASE_FAILED';
        err.balance = data.balance;
        err.required = data.required;
        err.missing = data.missing;
        throw err;
      }
      if (data.wallet) {
        broadcastPlatanosWalletUpdate(data.wallet);
      } else {
        await refreshWallet();
      }
      return data as {
        success: boolean;
        alreadyUnlocked: boolean;
        itineraryId: string;
        itineraryTitle: string;
        charged: number;
        balanceBefore: number;
        balanceAfter: number;
        transactionId: string;
        wallet: PlatanoWalletData;
      };
    },
    [refreshWallet]
  );

  return {
    wallet,
    loading,
    refreshWallet,
    getItineraryPlatanoPrice,
    isItineraryUnlocked,
    startTopUpCheckout,
    purchaseItinerary,
  };
}
