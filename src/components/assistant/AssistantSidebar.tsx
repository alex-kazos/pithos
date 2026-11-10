import { useEffect, useRef, useState } from 'react';
import { Brain, History, Loader2, MessageSquarePlus, PanelRightClose, Send, Trash2 } from 'lucide-react';
import { useAIAssistant } from '../../contexts/AIAssistantContext';

const SUGGESTED_QUESTIONS = [
  'What are my top-selling products?',
  'Which products need restocking?',
  'Summarize my sell-through',
  'How much capital is idle?',
];

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The assistant as a collapsible right-hand sidebar rather than an overlay:
 * it sits in DashboardShell's flex row, so opening it narrows the dashboard
 * instead of covering it. Collapsed, it leaves only a slim toggle rail.
 */
export function AssistantSidebar() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    startNewChat,
    sessions,
    activeSessionId,
    selectSession,
    deleteSession,
    isOpen,
    toggleAssistant,
  } = useAIAssistant();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const visibleMessages = messages.filter(m => m.role !== 'system');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  if (!isOpen) {
    return (
      <aside className="w-12 flex-none border-l border-white/[0.06] bg-canvas-2 flex flex-col items-center py-3.5 gap-2">
        <button
          type="button"
          onClick={toggleAssistant}
          title="Open Ask Pithos"
          aria-label="Open Ask Pithos"
          className="w-8 h-8 rounded-lg bg-accent/[0.14] text-accent-soft hover:bg-accent/25 flex items-center justify-center"
        >
          <Brain className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[380px] flex-none border-l border-white/[0.06] bg-canvas-2 flex flex-col min-h-0">
      <div className="flex-none flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-[18px] h-[18px] text-accent flex-none" />
          <div className="min-w-0">
            <div className="font-semibold text-[13.5px] text-white leading-tight">Ask Pithos</div>
            <div className="text-[11px] text-white/40 truncate">
              {showHistory ? `${sessions.length} conversation${sessions.length === 1 ? '' : 's'}` : 'Your inventory expert'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-none">
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            title="Chat history"
            aria-label="Chat history"
            aria-pressed={showHistory}
            className={`w-7 h-7 rounded-md flex items-center justify-center ${
              showHistory ? 'bg-accent/[0.14] text-accent-soft' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              startNewChat();
              setShowHistory(false);
            }}
            title="New chat"
            aria-label="New chat"
            className="w-7 h-7 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] flex items-center justify-center"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleAssistant}
            title="Collapse assistant"
            aria-label="Collapse assistant"
            className="w-7 h-7 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] flex items-center justify-center"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-1">
          {sessions.every(s => s.messages.length === 0) && (
            <p className="px-2 py-3 text-[11.5px] text-white/40">No past conversations yet.</p>
          )}
          {sessions
            .filter(s => s.messages.length > 0)
            .map(session => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 ${
                  session.id === activeSessionId ? 'bg-accent/[0.14]' : 'hover:bg-white/[0.05]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    selectSession(session.id);
                    setShowHistory(false);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div
                    className={`truncate text-xs ${
                      session.id === activeSessionId ? 'text-accent-soft font-medium' : 'text-white/80'
                    }`}
                  >
                    {session.title || 'New chat'}
                  </div>
                  <div className="font-mono-ibm text-[10px] text-white/35">{relativeTime(session.updatedAt)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(session.id)}
                  title="Delete conversation"
                  aria-label={`Delete conversation ${session.title || 'New chat'}`}
                  className="flex-none w-6 h-6 rounded-md text-white/30 opacity-0 group-hover:opacity-100 hover:text-band-red hover:bg-white/[0.06] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
            {visibleMessages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11.5px] text-white/40">Ask anything about your inventory.</p>
                {SUGGESTED_QUESTIONS.map(question => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] text-left text-[11.5px] text-white/70 hover:border-accent/50 hover:text-white disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {visibleMessages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === 'user'
                    ? 'self-end max-w-[85%] px-3 py-2.5 rounded-xl rounded-br-sm bg-accent text-canvas text-[12.5px] font-medium leading-relaxed whitespace-pre-wrap'
                    : 'self-start max-w-[90%] px-3 py-2.5 rounded-xl rounded-bl-sm bg-white/[0.05] border border-white/[0.07] text-white/80 text-[12.5px] leading-relaxed whitespace-pre-wrap'
                }
              >
                {message.content}
              </div>
            ))}

            {isLoading && (
              <div className="self-start flex items-center gap-2 text-[11.5px] text-white/40">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red text-[11.5px]">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex-none p-3.5 border-t border-white/[0.07]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] focus-within:border-accent/50">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything about your inventory…"
                disabled={isLoading}
                className="flex-1 min-w-0 bg-transparent text-white text-xs outline-none placeholder:text-white/35 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                title="Send"
                aria-label="Send message"
                className="flex-none text-accent hover:text-accent-hover disabled:opacity-30"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
