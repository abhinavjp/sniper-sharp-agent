import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Agent, Provider, Skill } from '../api/client';

interface FormState {
  name: string;
  persona: string;
  rules: string;
  provider_id: string;
  is_supervisor: boolean;
  memory_enabled: boolean;
  config_hook_url: string;
  config_hook_secret: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  persona: '',
  rules: '',
  provider_id: '',
  is_supervisor: false,
  memory_enabled: false,
  config_hook_url: '',
  config_hook_secret: '',
};

const INPUT_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm';

const TEXTAREA_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm resize-y shadow-sm';

export default function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [skillBusy, setSkillBusy] = useState(false);

  const load = () => {
    void api.listAgents().then(setAgents).catch(() => setAgents([]));
  };

  useEffect(() => {
    load();
    void api.listProviders().then(setProviders).catch(() => setProviders([]));
    void api.listSkills().then(setAllSkills).catch(() => setAllSkills([]));
  }, []);

  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      persona: agent.persona,
      rules: agent.rules ?? '',
      provider_id: agent.provider_id,
      is_supervisor: agent.is_supervisor,
      memory_enabled: agent.memory_enabled,
      config_hook_url: agent.config_hook_url ?? '',
      config_hook_secret: agent.config_hook_secret ?? '',
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

    const body = {
      name: form.name,
      persona: form.persona,
      rules: form.rules || undefined,
      provider_id: form.provider_id,
      is_supervisor: form.is_supervisor,
      memory_enabled: form.memory_enabled,
      config_hook_url: form.config_hook_url || undefined,
      config_hook_secret: form.config_hook_secret || undefined,
    };

    try {
      if (editingId !== null) {
        await api.updateAgent(editingId, body);
        setEditingId(null);
      } else {
        await api.createAgent(body);
      }
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAttach = async (agentId: string, skillId: string) => {
    if (!skillId) return;
    setSkillBusy(true);
    try {
      await api.attachSkill(agentId, skillId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attach failed');
    } finally {
      setSkillBusy(false);
    }
  };

  const handleDetach = async (agentId: string, skillId: string) => {
    setSkillBusy(true);
    try {
      await api.detachSkill(agentId, skillId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detach failed');
    } finally {
      setSkillBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"?`)) return;
    setError(null);
    try {
      await api.deleteAgent(id);
      if (editingId === id) handleCancel();
      setExpandedAgentId((prev) => (prev === id ? null : prev));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const providerName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id;

  const isEditing = editingId !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">Agents</h2>

      {/* Agent list */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        {agents.length === 0 ? (
          <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
            No agents yet. Run <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">python seed.py</code> or create one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {agents.map((agent) => (
              <li key={agent.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 dark:text-slate-200 truncate">{agent.name}</p>
                      {agent.is_supervisor && (
                        <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded-full">
                          Supervisor
                        </span>
                      )}
                      {agent.memory_enabled && (
                        <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                          Memory
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
                      Provider: <span className="text-slate-700 dark:text-slate-300">{providerName(agent.provider_id)}</span> <span className="mx-1.5 opacity-50">·</span> {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{agent.persona}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(agent)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { void handleDelete(agent.id, agent.name); }}
                      className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button
                    onClick={() =>
                      setExpandedAgentId((prev) => (prev === agent.id ? null : agent.id))
                    }
                    className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5"
                  >
                    {expandedAgentId === agent.id ? 
                      <><span className="text-[10px]">▲</span> Hide skills</> : 
                      <><span className="text-[10px]">▼</span> Show skills</>}
                  </button>

                  {expandedAgentId === agent.id && (
                    <div className="mt-3 space-y-2 animate-fade-in-up" style={{ animationDelay: '0s' }}>
                      {/* Attached skills */}
                      {agent.skills.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-2">No skills attached.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {agent.skills.map((sk) => (
                            <li key={sk.id} className="flex items-center justify-between bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg px-3 py-2">
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{sk.name}</span>
                              <button
                                disabled={skillBusy}
                                onClick={() => { void handleDetach(agent.id, sk.id); }}
                                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                              >
                                Detach
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Attach dropdown */}
                      {(() => {
                        const attachable = allSkills.filter(
                          (sk) => !agent.skills.some((as) => as.id === sk.id),
                        );
                        if (attachable.length === 0) return null;
                        return (
                          <div className="pt-2">
                            <select
                              disabled={skillBusy}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) void handleAttach(agent.id, e.target.value);
                                e.target.value = '';
                              }}
                              className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-40 transition-all shadow-sm"
                            >
                              <option value="">+ Attach a skill…</option>
                              {attachable.map((sk) => (
                                <option key={sk.id} value={sk.id}>{sk.name}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error !== null && <p className="text-rose-400 text-sm">{error}</p>}

      {/* Create / Edit form */}
      <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-none animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-6">
          {isEditing ? 'Edit Agent' : 'Add Agent'}
        </h3>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. EmailClassifier"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Provider</label>
              <select
                required
                value={form.provider_id}
                onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="">— select a provider —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Persona</label>
            <textarea
              required
              rows={4}
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
              placeholder="You are a helpful assistant that..."
              className={TEXTAREA_CLS}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Rules <span className="text-slate-600">(optional)</span></label>
            <textarea
              rows={3}
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              placeholder="Operating rules, constraints, and guidelines..."
              className={TEXTAREA_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Config Hook URL <span className="text-slate-600">(optional)</span></label>
              <input
                type="url"
                value={form.config_hook_url}
                onChange={(e) => setForm({ ...form, config_hook_url: e.target.value })}
                placeholder="https://example.com/persona-hook"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Hook Secret <span className="text-slate-600">(optional)</span></label>
              <input
                type="password"
                value={form.config_hook_secret}
                onChange={(e) => setForm({ ...form, config_hook_secret: e.target.value })}
                placeholder="HMAC signing secret"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_supervisor}
                onChange={(e) => setForm({ ...form, is_supervisor: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <span className="text-sm text-slate-300">Supervisor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.memory_enabled}
                onChange={(e) => setForm({ ...form, memory_enabled: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <span className="text-sm text-slate-300">Memory enabled</span>
            </label>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Agent'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-8 py-3.5 rounded-xl font-bold border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm dark:shadow-none"
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
