import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RetroLoading from './components/player/RetroLoading';

const Player = lazy(() => import('./Player'));

const AdminApp = lazy(() => import('./admin/AdminApp'));
const TerminalApp = lazy(() => import('./terminal/TerminalApp'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RetroLoading fullScreen message="SISTEMA CARREGANDO..." subMessage="Inicializando protocolos de acesso" />}>
        <Routes>
          <Route path="/*" element={<Player />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/terminal/*" element={<TerminalApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

