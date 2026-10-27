import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { usePlannerDaySync } from '@/lib/usePlannerDaySync';

import ProtectedRoute from '@/components/ProtectedRoute';
import OwnerRoute from '@/components/OwnerRoute';
import AppLayout from '@/components/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import SandboxBanner from '@/components/SandboxBanner';
import OwnerAlertBanner from '@/components/OwnerAlertBanner';
import ReminderActionHandler from '@/features/habits/ReminderActionHandler';

import Login      from '@/routes/Login';
import PendingApproval from '@/routes/PendingApproval';
import Main       from '@/routes/Main';
import Habits     from '@/routes/Habits';
import Reflection from '@/routes/Reflection';
import Progress   from '@/routes/Progress';
import Condition  from '@/routes/Condition';
import Planner    from '@/routes/Planner';
import Devotion   from '@/routes/Devotion';
import Prayers    from '@/routes/Prayers';
import Admin      from '@/routes/Admin';
import More       from '@/routes/More';
import NotificationSettings from '@/routes/NotificationSettings';
import TelegramSettings from '@/routes/TelegramSettings';
import Tutorial   from '@/routes/Tutorial';
import PastDay    from '@/routes/PastDay';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function AuthInit({ children }: { children: React.ReactNode }) {
  useAuth(); // triggers onAuthStateChanged → store
  usePlannerDaySync(); // 04:00 KST / PWA 복귀 시 오늘 날짜 자동 갱신
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthInit>
          <SandboxBanner />
          <OwnerAlertBanner />
          <ReminderActionHandler />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pending" element={<PendingApproval />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/"          element={<Main />} />
                <Route path="/habits"    element={<Habits />} />
                <Route path="/reflection" element={<Reflection />} />
                <Route path="/prayers"   element={<Prayers />} />
                {/* 말씀 적용은 신앙 탭에 통합됨 — 옛 경로·딥링크는 신앙 탭으로 보낸다 */}
                <Route path="/applications" element={<Navigate to="/prayers?view=application" replace />} />
                <Route path="/progress"  element={<Progress />} />
                <Route path="/condition" element={<Condition />} />
                <Route path="/planner"   element={<Planner />} />
                <Route path="/devotion"  element={<Devotion />} />
                <Route path="/more"      element={<More />} />
                <Route path="/tutorial"  element={<Tutorial />} />
                <Route path="/day/:date" element={<PastDay />} />
              </Route>
              <Route element={<OwnerRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
              <Route path="/settings/notifications" element={<NotificationSettings />} />
              <Route path="/settings/telegram" element={<TelegramSettings />} />
            </Route>
          </Routes>
        </AuthInit>
      </HashRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
