import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
import { Toaster } from 'sonner';
import CelebrationOverlay from '@/features/habits/CelebrationOverlay';

export default function AppLayout() {
  return (
    <div
      className="mx-auto flex max-w-[480px] flex-col bg-[var(--bg-base)]"
      style={{ minHeight: '100dvh', paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </div>
      <TabBar />
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        offset="calc(72px + env(safe-area-inset-bottom))"
        toastOptions={{
          style: { background: 'var(--bloom-soft)', border: '1px solid var(--bloom)', color: 'var(--bloom)' },
        }}
      />
      <CelebrationOverlay />
    </div>
  );
}
