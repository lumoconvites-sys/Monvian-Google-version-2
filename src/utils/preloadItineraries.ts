export function startPreloadResources() {
  if (typeof window === 'undefined') return;
  // Preload critical assets in idle time
  const preload = () => {
    const imagesToPreload = [
      '/logocarregamento.png',
      '/logomodoescuro.png',
      '/loogo.png',
      '/hotel.png',
      '/restaurante.png',
      '/cafe.png'
    ];
    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preload);
  } else {
    setTimeout(preload, 1200);
  }
}
