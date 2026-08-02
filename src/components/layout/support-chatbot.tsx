'use client';

import * as React from 'react';
import { Bot, X, Send, Loader2, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getKnowledgeBaseArticles,
  initializeKnowledgeBaseArticles,
  subscribeToKnowledgeBaseArticles,
} from '@/lib/data-store';
import type { KnowledgeBaseArticle } from '@/app/(dashboard)/admin/knowledge-base/knowledge-base-types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function findAnswer(query: string, articles: KnowledgeBaseArticle[]): string {
  if (articles.length === 0) {
    return "I don't have any knowledge base articles loaded yet. Please check back later or contact your system administrator.";
  }

  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);

  // Score each article by keyword / content overlap
  const scored = articles.map((article) => {
    const haystack = [
      article.title,
      article.content,
      article.category ?? '',
      ...(article.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
    // Boost if the token appears in the title
    for (const token of tokens) {
      if (article.title.toLowerCase().includes(token)) score += 2;
    }
    return { article, score };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];

  if (!best || best.score === 0) {
    return (
      "I couldn't find a specific answer to your question in the knowledge base. " +
      "You can try rephrasing, or contact an administrator for help."
    );
  }

  // Build a readable response
  const { article } = best;
  let response = `**${article.title}**\n\n${article.content}`;
  if (article.category) {
    response += `\n\n*Category: ${article.category}*`;
  }
  return response;
}

/** Minimal markdown-ish renderer: bold (**text**), newlines → <br /> */
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function SupportChatbot() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m the AAWSA Support Bot. Ask me anything about the billing portal.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = React.useState('');
  const [isThinking, setIsThinking] = React.useState(false);
  const [articles, setArticles] = React.useState<KnowledgeBaseArticle[]>([]);
  const [isMinimized, setIsMinimized] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load knowledge base articles
  React.useEffect(() => {
    initializeKnowledgeBaseArticles().then(() => {
      setArticles(getKnowledgeBaseArticles());
    });
    const unsub = subscribeToKnowledgeBaseArticles((updated) => setArticles(updated));
    return () => unsub();
  }, []);

  // Scroll to bottom on new message
  React.useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSend = React.useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate a brief thinking delay for UX
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

    const answer = findAnswer(text, articles);
    const botMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMsg]);
    setIsThinking(false);
  }, [input, isThinking, articles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        id="support-chatbot-toggle"
        onClick={toggleOpen}
        aria-label="Toggle AAWSA Support Bot"
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 no-print',
          'bg-gradient-to-br from-blue-600 to-blue-800 text-white hover:scale-110 active:scale-95',
          isOpen && 'rotate-12',
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <Bot className="h-6 w-6" />
            {/* Unread pulse indicator when closed */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          </>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          id="support-chatbot-panel"
          className={cn(
            'fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-blue-100 overflow-hidden no-print',
            'bg-white transition-all duration-300',
            isMinimized ? 'h-14 w-80' : 'h-[500px] w-80 sm:w-96',
          )}
          style={{ maxHeight: 'calc(100vh - 110px)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 flex-shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">AAWSA Support Bot</p>
              <p className="text-xs text-blue-200 leading-tight">Ask me questions about the portal.</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized((p) => !p)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', isMinimized && 'rotate-180')}
                />
              </button>
              <button
                onClick={toggleOpen}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-start gap-2',
                      msg.role === 'user' && 'flex-row-reverse',
                    )}
                  >
                    {/* Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow">
                        A
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm',
                      )}
                    >
                      {msg.role === 'assistant'
                        ? renderMarkdown(msg.content)
                        : msg.content}
                    </div>
                  </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow">
                      A
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  id="support-chatbot-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  disabled={isThinking}
                  className={cn(
                    'flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none',
                    'focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                />
                <button
                  id="support-chatbot-send"
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  aria-label="Send message"
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all',
                    'bg-blue-600 text-white hover:bg-blue-700 active:scale-90 shadow',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
