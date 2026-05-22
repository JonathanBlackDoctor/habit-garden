import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true;
  return false;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () => window.__deferredInstallPrompt ?? null
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const isIOS = detectIOS();

  useEffect(() => {
    const syncFromWindow = () => {
      setDeferred(window.__deferredInstallPrompt ?? null);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    // index.html에서 미리 캡처해둔 이벤트가 있을 수 있으므로 즉시 동기화
    syncFromWindow();
    window.addEventListener('pwa-install-available', syncFromWindow);
    window.addEventListener('pwa-installed', onInstalled);
    // 안전망: 훅 마운트 이후에 발화되는 경우 직접 수신
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__deferredInstallPrompt = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('pwa-install-available', syncFromWindow);
      window.removeEventListener('pwa-installed', onInstalled);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    const evt = deferred ?? window.__deferredInstallPrompt ?? null;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    window.__deferredInstallPrompt = null;
    setDeferred(null);
  };

  return {
    canInstall: deferred !== null,
    isStandalone,
    isIOS,
    promptInstall,
  };
}
