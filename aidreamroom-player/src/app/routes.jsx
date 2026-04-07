import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoginRoute, ProtectedRoute } from './guards';
import { LoginPage } from '../pages/loginPage';
import { MainPage } from '../pages/mainPage';
import { MePage } from '../pages/mePage';
import { RoleCreatePage } from '../pages/roleCreatePage';
import { SkillPage } from '../pages/skillPage';
import { ItemPage } from '../pages/itemPage';
import { WarehousePage } from '../pages/warehousePage';
import { EntryDreamPage } from '../pages/enrtyDreamEntryPage';
import { PlaySelectPage } from '../pages/play/select';
import { PlayHistoryPage } from '../pages/play/history';
import { PlayMainPage } from '../pages/play/main';
import { ComingSoonPage } from '../components/common/ComingSoonPage';
import { RouteLoading } from '../components/common/RouteLoading';

const MobileLoginPage = lazy(() => import('../mobile/pages/loginPage').then((module) => ({ default: module.MobileLoginPage })));
const MobileMainPage = lazy(() => import('../mobile/pages/mainPage').then((module) => ({ default: module.MobileMainPage })));
const MobileMePage = lazy(() => import('../mobile/pages/mePage').then((module) => ({ default: module.MobileMePage })));
const MobileRoleCreatePage = lazy(() => import('../mobile/pages/roleCreatePage').then((module) => ({ default: module.MobileRoleCreatePage })));
const MobileSkillPage = lazy(() => import('../mobile/pages/skillPage').then((module) => ({ default: module.MobileSkillPage })));
const MobileItemPage = lazy(() => import('../mobile/pages/itemPage').then((module) => ({ default: module.MobileItemPage })));
const MobileWarehousePage = lazy(() => import('../mobile/pages/warehousePage').then((module) => ({ default: module.MobileWarehousePage })));
const MobilePlaySelectPage = lazy(() => import('../mobile/pages/play/select').then((module) => ({ default: module.MobilePlaySelectPage })));
const MobilePlayMainPage = lazy(() => import('../mobile/pages/play/main').then((module) => ({ default: module.MobilePlayMainPage })));

export function AppRoutes() {
  const location = useLocation();
  const mobile = location.pathname.startsWith('/mobile');

  return (
    <Suspense fallback={<RouteLoading mobile={mobile} tip="页面切换中..." />}>
      <Routes>
        <Route path="/" element={<Navigate replace to="/login" />} />
        <Route path="/login" element={<LoginRoute><LoginPage /></LoginRoute>} />
        <Route path="/main" element={<ProtectedRoute requireRole><MainPage /></ProtectedRoute>} />
        <Route path="/mepage" element={<ProtectedRoute><MePage /></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute requireRole><SkillPage /></ProtectedRoute>} />
        <Route path="/items" element={<ProtectedRoute requireRole><ItemPage /></ProtectedRoute>} />
        <Route path="/warehouse" element={<ProtectedRoute requireRole><WarehousePage /></ProtectedRoute>} />
        <Route path="/role/create" element={<ProtectedRoute><RoleCreatePage /></ProtectedRoute>} />
        <Route path="/entrydream" element={<ProtectedRoute requireRole><EntryDreamPage /></ProtectedRoute>} />
        <Route path="/play/select" element={<ProtectedRoute requireRole><PlaySelectPage /></ProtectedRoute>} />
        <Route path="/play/history" element={<ProtectedRoute requireRole><PlayHistoryPage /></ProtectedRoute>} />
        <Route path="/play/main/:id" element={<ProtectedRoute requireRole><PlayMainPage /></ProtectedRoute>} />
        <Route path="/mobile/login" element={<LoginRoute mobile><MobileLoginPage /></LoginRoute>} />
        <Route path="/mobile/main" element={<ProtectedRoute requireRole><MobileMainPage /></ProtectedRoute>} />
        <Route path="/mobile/mepage" element={<ProtectedRoute><MobileMePage /></ProtectedRoute>} />
        <Route path="/mobile/skills" element={<ProtectedRoute requireRole><MobileSkillPage /></ProtectedRoute>} />
        <Route path="/mobile/items" element={<ProtectedRoute requireRole><MobileItemPage /></ProtectedRoute>} />
        <Route path="/mobile/warehouse" element={<ProtectedRoute requireRole><MobileWarehousePage /></ProtectedRoute>} />
        <Route path="/mobile/role/create" element={<ProtectedRoute><MobileRoleCreatePage /></ProtectedRoute>} />
        <Route path="/mobile/play/select" element={<ProtectedRoute requireRole><MobilePlaySelectPage /></ProtectedRoute>} />
        <Route path="/mobile/play/main/:id" element={<ProtectedRoute requireRole><MobilePlayMainPage /></ProtectedRoute>} />
        <Route path="/createdream" element={<ProtectedRoute><ComingSoonPage title="造梦入口" /></ProtectedRoute>} />
        <Route path="/outlook/list" element={<ProtectedRoute><ComingSoonPage title="世界观列表" /></ProtectedRoute>} />
        <Route path="/outlook/create/:id" element={<ProtectedRoute><ComingSoonPage title="世界观编辑" /></ProtectedRoute>} />
        <Route path="/plot/list" element={<ProtectedRoute><ComingSoonPage title="剧情列表" /></ProtectedRoute>} />
        <Route path="/plot/create/:id" element={<ProtectedRoute><ComingSoonPage title="剧情编辑" /></ProtectedRoute>} />
        <Route path="/userPage/:id" element={<ProtectedRoute><ComingSoonPage title="用户主页" /></ProtectedRoute>} />
        <Route path="/sharedPage/:id" element={<ProtectedRoute><ComingSoonPage title="共享页" /></ProtectedRoute>} />
        <Route path="/test" element={<ProtectedRoute><ComingSoonPage title="测试页" /></ProtectedRoute>} />
        <Route path="/character" element={<ProtectedRoute><ComingSoonPage title="角色编辑" /></ProtectedRoute>} />
        <Route path="/viewDreamPage" element={<ProtectedRoute><ComingSoonPage title="观梦页" /></ProtectedRoute>} />
        <Route path="/material" element={<ProtectedRoute><ComingSoonPage title="素材库" /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  );
}
