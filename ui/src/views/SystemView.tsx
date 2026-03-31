import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { GraphStatusResponse, HealthResponse } from '../api/client';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export default function SystemView() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<GraphStatusResponse | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const addToast = (type: Toast['type'], message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const fetchHealth = useCallback(() => {
    void api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const fetchStatus = useCallback(() => {
    void api.graphStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchStatus();
    const interval = setInterval(fetchHealth, 10_000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchStatus]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await api.graphRebuild();
      addToast('success', 'Graph rebuilt successfully');
      fetchHealth();
      fetchStatus();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  const compiled = health?.graph_compiled ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-fade-in-up ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-900/40 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">System</h2>

      {/* Health status card */}
      <div
        className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-none animate-fade-in-up"
        style={{ animationDelay: '0.05s' }}
      >
        <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-6">
          Graph Health
        </h3>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12">
              <div
                className={`absolute inset-0 rounded-full opacity-20 ${
                  compiled === null
                    ? 'bg-slate-400'
                    : compiled
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-rose-500 animate-pulse'
                }`}
              />
              <div
                className={`w-4 h-4 rounded-full ${
                  compiled === null
                    ? 'bg-slate-400'
                    : compiled
                    ? 'bg-emerald-500 shadow-[0_0_10px_currentColor] text-emerald-500'
                    : 'bg-rose-500 shadow-[0_0_10px_currentColor] text-rose-500'
                }`}
              />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                {compiled === null ? 'Connecting…' : compiled ? 'Graph Compiled' : 'Graph Not Compiled'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {compiled === null
                  ? 'Waiting for health check'
                  : compiled
                  ? 'All agents and routing rules are active'
                  : 'Rebuild required to activate routing'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { void handleRebuild(); }}
            disabled={rebuilding}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            {rebuilding ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Rebuilding…
              </>
            ) : (
              'Rebuild Graph'
            )}
          </button>
        </div>
      </div>

      {/* Graph stats */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        {[
          { label: 'Agents', value: status?.agent_count, icon: '⬡' },
          { label: 'Skills', value: status?.skill_count, icon: '⚙' },
          { label: 'Routing Rules', value: status?.routing_rule_count, icon: '⇢' },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-5 shadow-sm dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                {label}
              </span>
              <span className="text-slate-300 dark:text-slate-700 text-lg select-none">{icon}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-200 tabular-nums">
              {value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Polling note */}
      <p
        className="text-xs text-slate-400 dark:text-slate-600 text-center animate-fade-in-up"
        style={{ animationDelay: '0.15s' }}
      >
        Health status refreshes automatically every 10 seconds.
      </p>
    </div>
  );
}
