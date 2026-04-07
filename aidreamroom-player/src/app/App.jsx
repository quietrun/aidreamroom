import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import '../styles/index.scss';
import { AppRoutes } from './routes';
import setRem from '../function/windowResize';

export function App() {
  useEffect(() => {
    setRem();
  }, []);

  return (
    <ConfigProvider>
      <AppRoutes />
    </ConfigProvider>
  );
}
