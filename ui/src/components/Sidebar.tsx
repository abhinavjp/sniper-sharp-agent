import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { HealthResponse } from '../api/client';
import { useTheme } from './ThemeProvider';

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
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const check = () => {
      void api.health().then((h) => setHealth(h)).catch(() => setHealth(null));
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark');
  };

  return (
    <aside className="w-64 flex flex-col bg-white/70 dark:bg-white/[0.02] backdrop-blur-2xl border-r border-slate-200/50 dark:border-white/10 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative z-20">
      <div className="px-6 py-6 border-b border-slate-200/50 dark:border-white/10 shrink-0">
        <h1 className="text-xl font-bold bg-gradient-to-br from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400 bg-clip-text text-transparent flex items-center gap-2 tracking-tight">
          <svg className="w-6 h-6 text-indigo-500 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Sniper Sharp
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200 hover:shadow-sm'
              }`
            }
          >
            <span className="text-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200/50 dark:border-white/10 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs">
          <span
            className={`w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor] ${
              health?.graph_compiled ? 'bg-emerald-500 text-emerald-500' : 'bg-amber-500 text-amber-500'
            }`}
          />
          <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
            {health === null
              ? 'Connecting…'
              : health.graph_compiled
              ? 'Graph ready'
              : 'Compiling…'}
          </span>
        </div>
        
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 dark:text-slate-400 transition-colors"
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </aside>
  );
}
