import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Agent, Session } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  intent?: string | null;
}

export default function ChatView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api
      .listAgents()
      .then((list) => {
        setAgents(list);
        const first = list[0];
        if (first !== undefined) setSelectedAgentId(first.id);
      })
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async () => {
    if (!selectedAgentId) return;
    setError(null);
    try {
      const s = await api.createSession({ user_id: 'local-user', agent_id: selectedAgentId });
      setSession(s);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    const currentSession = session;
    if (!text || currentSession === null || sending) return;
    setInput('');
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user' as const, content: text }]);
    try {
      const res = await api.chat({ session_id: currentSession.id, message: text });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: res.response, intent: res.intent },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed');
      setMessages((prev) => prev.slice(0, -1)); // remove optimistic user message
    } finally {
      setSending(false);
    }
  };

  const turnCount = messages.filter((m) => m.role === 'user').length;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {agents.length === 0 && (
              <option value="">No agents — run python seed.py first</option>
            )}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.is_supervisor ? ' ★' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => { void handleNewSession(); }}
            disabled={!selectedAgentId}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            New Session
          </button>
        </div>
        {session !== null && (
          <span className="text-xs text-slate-500">
            {turnCount} turn{turnCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 min-h-0">
        {session === null && (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm text-center p-8">
            Select an agent and press{' '}
            <span className="mx-1 px-2 py-0.5 bg-white/10 rounded text-slate-400 font-mono text-xs">
              New Session
            </span>{' '}
            to start chatting.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 border ${
                msg.role === 'user'
                  ? 'bg-indigo-600/40 border-indigo-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </p>
              {msg.role === 'assistant' && msg.intent != null && msg.intent !== '' && (
                <span className="mt-2 inline-block text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {msg.intent}
                </span>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <span className="text-slate-500 text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error !== null && (
        <p className="text-rose-400 text-xs mt-2 shrink-0">{error}</p>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={session === null || sending}
          placeholder={session !== null ? 'Type a message… (Enter to send)' : 'Create a session first'}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-40 transition-all"
        />
        <button
          onClick={() => { void handleSend(); }}
          disabled={session === null || !input.trim() || sending}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium transition-all disabled:opacity-40 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
