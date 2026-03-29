import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { HealthResponse } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Chat', icon: '💬' },
  { to: '/providers', label: 'Providers', icon: '🔌' },
  { to: '/agents', label: 'Agents', icon: '🤖' },
  { to: '/skills', label: 'Skills', icon: '🛠' },
  { to: '/routing-rules', label: 'Routing Rules', icon: '📐' },
  { to: '/system', label: 'System', icon: '⚙️' },
] as const;

export default function Sidebar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const check = () => {
      void api.health().then((h) => setHealth(h)).catch(() => setHealth(null));
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="w-56 flex flex-col bg-white/5 backdrop-blur-xl border-r border-white/10 shrink-0">
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Sniper Sharp
        </h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              health?.graph_compiled ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-slate-500 truncate">
            {health === null
              ? 'Connecting…'
              : health.graph_compiled
              ? 'Graph ready'
              : 'Graph not compiled'}
          </span>
        </div>
      </div>
    </aside>
  );
}
