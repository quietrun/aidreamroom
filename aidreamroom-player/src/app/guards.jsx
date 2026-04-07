import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { RouteLoading } from '../components/common/RouteLoading';
import {
  ensureAuthState,
  ensureRoleExists,
  getCachedAuthState,
  getCachedRoleState,
} from '../utils/session';
import { isMobile } from '../utils';

function FullPageLoading({ mobile = false, tip = '页面加载中...' }) {
  return <RouteLoading mobile={mobile} tip={tip} />;
}

function useRouteAuth() {
  const [state, setState] = useState(getCachedAuthState);

  useEffect(() => {
    let mounted = true;

    async function syncAuth() {
      const next = await ensureAuthState();
      if (mounted) {
        setState(next);
      }
    }

    syncAuth();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export function LoginRoute({ mobile = false, children }) {
  const auth = useRouteAuth();
  const mobileDevice = !!isMobile();

  if (!auth.checked) {
    return <FullPageLoading mobile={mobile || mobileDevice} tip="身份校验中..." />;
  }

  if (!mobile && mobileDevice) {
    return <Navigate replace to="/mobile/login" />;
  }

  if (auth.token) {
    return <Navigate replace to={mobile || mobileDevice ? '/mobile/main' : '/main'} />;
  }

  return children;
}

export function ProtectedRoute({ children, requireRole = false }) {
  const auth = useRouteAuth();
  const mobileDevice = !!isMobile();
  const location = useLocation();
  const routeMobile = location.pathname.startsWith('/mobile');
  const [roleState, setRoleState] = useState(() => getCachedRoleState(auth.token));

  useEffect(() => {
    let mounted = true;

    async function syncRole() {
      if (!requireRole) {
        setRoleState({
          checked: true,
          hasRole: true,
        });
        return;
      }

      if (!auth.checked) {
        return;
      }

      if (!auth.token) {
        setRoleState({
          checked: true,
          hasRole: false,
        });
        return;
      }

      const next = await ensureRoleExists();
      if (mounted) {
        setRoleState(next);
      }
    }

    syncRole();

    return () => {
      mounted = false;
    };
  }, [auth.checked, auth.token, requireRole]);

  if (!auth.checked) {
    return <FullPageLoading mobile={routeMobile || mobileDevice} tip="身份校验中..." />;
  }

  if (mobileDevice && !routeMobile) {
    return <Navigate replace to="/mobile/login" />;
  }

  if (!auth.token) {
    return <Navigate replace to={mobileDevice ? '/mobile/login' : '/login'} />;
  }

  if (requireRole && !roleState.checked) {
    return <FullPageLoading mobile={routeMobile || mobileDevice} tip="角色信息加载中..." />;
  }

  if (requireRole && !roleState.hasRole) {
    return <Navigate replace to={mobileDevice ? '/mobile/role/create' : '/role/create'} />;
  }

  return children;
}
