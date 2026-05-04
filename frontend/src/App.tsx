import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Prompts from './pages/Prompts';
import Datasets from './pages/Datasets';
import Evaluations from './pages/Evaluations';
import './app.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <div>
              <div className="logo-title">LogiEval</div>
              <div className="logo-sub">LLM Bewertung</div>
            </div>
          </div>
          <nav>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span>📊</span> Dashboard
            </NavLink>
            <NavLink to="/prompts" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span>📝</span> Prompts
            </NavLink>
            <NavLink to="/datasets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span>🗂️</span> Datensätze
            </NavLink>
            <NavLink to="/evaluations" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span>🧪</span> Evaluierungen
            </NavLink>
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prompts" element={<Prompts />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/evaluations" element={<Evaluations />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
