import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { isOwner } from '@/lib/auth';

/**
 * 운영자(owner) 전용 라우트 가드.
 * owner 가 아니면 메인으로 돌려보낸다. 승인된 일반 사용자도 /admin 에 진입할 수 없다.
 * (서버 측 권한은 firestore.rules 의 isOwner() 로 별도 강제된다.)
 */
export default function OwnerRoute() {
  const realUid = useAppStore((s) => s.realUid);
  if (!isOwner(realUid)) return <Navigate to="/" replace />;
  return <Outlet />;
}
