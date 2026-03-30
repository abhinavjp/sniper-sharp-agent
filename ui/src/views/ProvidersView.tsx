import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Provider, ProviderType } from '../api/client';

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  'anthropic-api-key': 'Anthropic — API Key',
  'anthropic-setup-auth': 'Anthropic — CLI Auth',
  'openai-api-key': 'OpenAI — API Key',
  'openai-codex-oauth': 'OpenAI — Codex OAuth',
  'google-api-key': 'Google — API Key',
  'custom-url': 'Custom URL',
};

const ALL_TYPES = Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[];
const NEEDS_API_KEY: ProviderType[] = ['anthropic-api-key', 'openai-api-key', 'google-api-key'];
const NEEDS_URL: ProviderType[] = ['custom-url'];
const NO_CREDENTIALS: ProviderType[] = ['anthropic-setup-auth', 'openai-codex-oauth'];

interface FormState {
  name: string;
  type: ProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'anthropic-api-key',
  model: 'claude-opus-4-6',
  apiKey: '',
  baseUrl: '',
};

export default function ProvidersView() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => {
    void api.listProviders().then((list) => setProviders(list)).catch(() => setProviders([]));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (p: Provider) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      model: p.model,
      apiKey: p.credentials['api_key'] ?? '',
      baseUrl: p.credentials['base_url'] ?? '',
    });
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const credentials: Record<string, string> = {};
      if (NEEDS_API_KEY.includes(form.type)) credentials['api_key'] = form.apiKey;
      if (NEEDS_URL.includes(form.type)) credentials['base_url'] = form.baseUrl;
      if (editingId !== null) {
        await api.updateProvider(editingId, {
          name: form.name,
          type: form.type,
          model: form.model,
          credentials,
        });
        setEditingId(null);
      } else {
        await api.createProvider({ name: form.name, type: form.type, model: form.model, credentials });
      }
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider?')) return;
    setError(null);
    try {
      await api.deleteProvider(id);
      if (editingId === id) handleCancelEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-slate-200">Providers</h2>

      {/* List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {providers.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm text-center">No providers configured yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-slate-200">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {PROVIDER_TYPE_LABELS[p.type]} · {p.model}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { void handleDelete(p.id); }}
                    className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create form */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-5">
          {editingId !== null ? 'Edit Provider' : 'Add Provider'}
        </h3>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Display Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. My Anthropic"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Model</label>
              <input
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="claude-opus-4-6"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Provider Type</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as ProviderType, apiKey: '', baseUrl: '' })
              }
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {NEEDS_API_KEY.includes(form.type) && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">API Key</label>
              <input
                type="password"
                required
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          )}

          {NEEDS_URL.includes(form.type) && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Base URL</label>
              <input
                type="url"
                required
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          )}

          {NO_CREDENTIALS.includes(form.type) && (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No key required — credentials are read from your local environment.</span>
            </div>
          )}

          {error !== null && <p className="text-rose-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-blue-900/40 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Add Provider'}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-3 rounded-xl font-bold border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
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
