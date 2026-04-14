import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Player from './Player';
const AdminApp = lazy(() => import('./admin/AdminApp'));
const TerminalApp = lazy(() => import('./terminal/TerminalApp'));
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-mono">Carregando...</div>}>
        <Routes>
          <Route path="/*" element={<Player />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/terminal/*" element={<TerminalApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
