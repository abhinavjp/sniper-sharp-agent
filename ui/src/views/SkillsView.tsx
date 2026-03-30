import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Skill } from '../api/client';

interface FormState {
  name: string;
  description: string;
  implementation: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  implementation: '',
};

const INPUT_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm';

const TEXTAREA_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm resize-y shadow-sm';

export default function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void api.listSkills().then(setSkills).catch(() => setSkills([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleEdit = (skill: Skill) => {
    setEditingId(skill.id);
    setForm({
      name: skill.name,
      description: skill.description,
      implementation: skill.implementation,
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
      if (editingId !== null) {
        await api.updateSkill(editingId, {
          name: form.name,
          description: form.description,
          implementation: form.implementation,
        });
        setEditingId(null);
      } else {
        await api.createSkill({
          name: form.name,
          description: form.description,
          implementation: form.implementation,
          input_schema: {},
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete skill "${name}"?`)) return;
    setError(null);
    try {
      await api.deleteSkill(id);
      if (editingId === id) handleCancel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">Skills</h2>

      {/* List */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        {skills.length === 0 ? (
          <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
            No skills yet. Run{' '}
            <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
              python seed.py
            </code>{' '}
            or create one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {skills.map((skill) => (
              <li
                key={skill.id}
                className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-200 truncate">
                      {skill.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {skill.description}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 font-mono truncate">
                      {skill.implementation.slice(0, 80)}
                      {skill.implementation.length > 80 ? '…' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(skill)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        void handleDelete(skill.id, skill.name);
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
          {isEditing ? 'Edit Skill' : 'Add Skill'}
        </h3>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. classify_email"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Description
              </label>
              <input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this skill does"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Implementation{' '}
              <span className="normal-case font-normal text-slate-400 dark:text-slate-600">
                — Python body; receives{' '}
                <code className="bg-slate-100 dark:bg-white/10 px-1 rounded">input: dict</code>,
                must return a value
              </span>
            </label>
            <textarea
              required
              rows={10}
              value={form.implementation}
              onChange={(e) => setForm({ ...form, implementation: e.target.value })}
              placeholder={'# input is a dict passed by the agent\ntext = input.get("text", "")\nreturn {"output": text.upper()}'}
              className={TEXTAREA_CLS}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Skill'}
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
