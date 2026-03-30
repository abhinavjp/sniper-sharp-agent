import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Agent, RoutingRule } from '../api/client';

interface FormState {
  supervisor_id: string;
  intent_label: string;
  target_agent_id: string;
  priority: string;
}

const EMPTY_FORM: FormState = {
  supervisor_id: '',
  intent_label: '',
  target_agent_id: '',
  priority: '0',
};

const INPUT_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm';

export default function RoutingRulesView() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void api
      .listRoutingRules()
      .then((list) => setRules([...list].sort((a, b) => a.priority - b.priority)))
      .catch(() => setRules([]));
  };

  useEffect(() => {
    load();
    void api.listAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  const supervisors = agents.filter((a) => a.is_supervisor);
  const specialists = agents.filter((a) => !a.is_supervisor);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  const handleEdit = (rule: RoutingRule) => {
    setEditingId(rule.id);
    setForm({
      supervisor_id: rule.supervisor_id,
      intent_label: rule.intent_label,
      target_agent_id: rule.target_agent_id,
      priority: String(rule.priority),
    });
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const priority = parseInt(form.priority, 10);
      if (isNaN(priority)) {
        setError('Priority must be a valid number');
        setSaving(false);
        return;
      }
      if (editingId !== null) {
        await api.updateRoutingRule(editingId, {
          intent_label: form.intent_label,
          target_agent_id: form.target_agent_id,
          priority,
        });
        setEditingId(null);
      } else {
        await api.createRoutingRule({
          supervisor_id: form.supervisor_id,
          intent_label: form.intent_label,
          target_agent_id: form.target_agent_id,
          priority,
        });
      }
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete routing rule "${label}"?`)) return;
    setError(null);
    try {
      await api.deleteRoutingRule(id);
      if (editingId === id) handleCancel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">
        Routing Rules
      </h2>

      {/* List */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        {rules.length === 0 ? (
          <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
            No routing rules yet. Run{' '}
            <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
              python seed.py
            </code>{' '}
            or create one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {rule.priority}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono text-sm">
                          {rule.intent_label}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600 text-xs">→</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {agentName(rule.target_agent_id)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5 truncate">
                        Supervisor: {agentName(rule.supervisor_id)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        void handleDelete(rule.id, rule.intent_label);
                      }}
                      className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error !== null && <p className="text-rose-500 text-sm">{error}</p>}

      {/* Create / Edit form */}
      <div
        className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-none animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-6">
          {isEditing ? 'Edit Rule' : 'Add Rule'}
        </h3>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          {/* Supervisor — select in create mode, read-only in edit mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Supervisor Agent
            </label>
            {isEditing ? (
              <div className={`${INPUT_CLS} opacity-60 cursor-not-allowed`}>
                {agentName(form.supervisor_id)}
              </div>
            ) : (
              <select
                required
                value={form.supervisor_id}
                onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="">— select a supervisor —</option>
                {supervisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            {isEditing && (
              <p className="text-xs text-slate-400 dark:text-slate-600">
                Supervisor cannot be changed after creation.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Intent Label
              </label>
              <input
                required
                value={form.intent_label}
                onChange={(e) => setForm({ ...form, intent_label: e.target.value })}
                placeholder="e.g. PAYROLL or FALLBACK"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Priority{' '}
                <span className="normal-case font-normal text-slate-400 dark:text-slate-600">
                  (lower = higher priority)
                </span>
              </label>
              <input
                required
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Target Agent
            </label>
            <select
              required
              value={form.target_agent_id}
              onChange={(e) => setForm({ ...form, target_agent_id: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">— select a target agent —</option>
              {(isEditing ? agents : specialists).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Rule'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
