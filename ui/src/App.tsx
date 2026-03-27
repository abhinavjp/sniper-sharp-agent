import { useState } from 'react';

type ProviderType = 'anthropic' | 'openai' | 'google' | 'local';
type AuthMethodType = 'api_key' | 'claude_token' | 'codex_oauth';

interface AIConfig {
  provider: ProviderType;
  authMethod: AuthMethodType;
  apiKey?: string;
  baseUrl?: string;
}

function App() {
  const [config, setConfig] = useState<AIConfig>({ provider: 'anthropic', authMethod: 'api_key' });
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Connect to the backend
      const res = await fetch('http://localhost:8000/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider,
          credentials: {
            authMethod: config.authMethod,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
          }
        }),
      });
      if (res.ok) setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save config. Is the backend running?');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-black text-slate-200 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden shadow-indigo-500/10">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/10 bg-white/5">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex justify-center items-center gap-2">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Sniper Sharp Agent
          </h1>
          <p className="text-slate-400 text-sm mt-2 text-center">Configure your Artificial Intelligence Engine</p>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="p-8 space-y-8">
          
          {/* Provider Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-indigo-300 uppercase tracking-wider">Target Provider</label>
            <div className="grid grid-cols-2 gap-4">
              {(['anthropic', 'openai', 'google', 'local'] as ProviderType[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setConfig({ provider: p, authMethod: 'api_key' })}
                  className={`p-4 rounded-xl border flex items-center justify-center font-medium transition-all duration-300 ${
                    config.provider === p 
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/10 w-full rounded-full"></div>

          {/* Authentication Options (Dynamic) */}
          <div className="space-y-6">
            <label className="text-sm font-medium text-indigo-300 uppercase tracking-wider block">Authentication Details</label>
            
            {/* Method Selectors (if needed) */}
            {config.provider === 'anthropic' && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={config.authMethod === 'api_key'} onChange={() => setConfig({...config, authMethod: 'api_key'})} className="text-indigo-500 bg-transparent border-white/20" />
                  API Key
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={config.authMethod === 'claude_token'} onChange={() => setConfig({...config, authMethod: 'claude_token'})} className="text-indigo-500 bg-transparent border-white/20" />
                  Claude Code Token
                </label>
              </div>
            )}

            {config.provider === 'openai' && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={config.authMethod === 'api_key'} onChange={() => setConfig({...config, authMethod: 'api_key'})} className="text-indigo-500 bg-transparent border-white/20" />
                  API Key
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={config.authMethod === 'codex_oauth'} onChange={() => setConfig({...config, authMethod: 'codex_oauth'})} className="text-indigo-500 bg-transparent border-white/20" />
                  Codex OAuth
                </label>
              </div>
            )}

            {/* Credential Inputs */}
            {config.authMethod === 'api_key' || config.provider === 'google' ? (
              <div className="space-y-2">
                <label className="text-xs text-slate-400">API Key</label>
                <input 
                  type="password" 
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder={`Enter your ${config.provider} API key`}
                />
              </div>
            ) : null}

            {config.provider === 'local' && (
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Base URL (e.g. Ollama, LMStudio)</label>
                <input 
                  type="url" 
                  value={config.baseUrl || ''}
                  onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="http://localhost:11434/v1"
                />
              </div>
            )}
            
            {/* Tokens/OAuth Info display */}
            {['claude_token', 'codex_oauth'].includes(config.authMethod) && (
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>
                  You've selected an automated authentication method. Ensure your CLI or local environment has the required tokens cached. No manual key entry required here.
                </p>
              </div>
            )}

          </div>

          {/* Action Footer */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-all duration-300 ${
                saved 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-blue-900/40'
              }`}
            >
              {isSaving ? 'Connecting...' : saved ? '✓ Settings Saved' : 'Connect Agent'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default App;
