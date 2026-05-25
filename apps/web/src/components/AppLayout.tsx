import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';
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
      <CelebrationOverlay />
    </div>
  );
}
