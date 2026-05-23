import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

import Login      from '@/routes/Login';
import PendingApproval from '@/routes/PendingApproval';
import Main       from '@/routes/Main';
import Habits     from '@/routes/Habits';
import Reflection from '@/routes/Reflection';
import Garden     from '@/routes/Garden';
import Progress   from '@/routes/Progress';
import Condition  from '@/routes/Condition';
import Planner    from '@/routes/Planner';
import Devotion   from '@/routes/Devotion';
import Prayers    from '@/routes/Prayers';
import Admin      from '@/routes/Admin';
import More       from '@/routes/More';
import Tutorial   from '@/routes/Tutorial';
import PastDay    from '@/routes/PastDay';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function AuthInit({ children }: { children: React.ReactNode }) {
  useAuth(); // triggers onAuthStateChanged → store
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthInit>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pending" element={<PendingApproval />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/"          element={<Main />} />
                <Route path="/habits"    element={<Habits />} />
                <Route path="/reflection" element={<Reflection />} />
                <Route path="/garden"    element={<Garden />} />
                <Route path="/prayers"   element={<Prayers />} />
                <Route path="/progress"  element={<Progress />} />
                <Route path="/condition" element={<Condition />} />
                <Route path="/planner"   element={<Planner />} />
                <Route path="/devotion"  element={<Devotion />} />
                <Route path="/more"      element={<More />} />
                <Route path="/tutorial"  element={<Tutorial />} />
                <Route path="/day/:date" element={<PastDay />} />
              </Route>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </AuthInit>
      </HashRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
