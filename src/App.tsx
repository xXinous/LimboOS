import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Player from './Player';
import AdminApp from './admin/AdminApp';
import TerminalApp from './terminal/TerminalApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Player />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/terminal/*" element={<TerminalApp />} />
      </Routes>
    </BrowserRouter>
  );
}
