import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Copy, ArrowRight, RefreshCw, Wand2, MessageSquare, Zap, Check, AlertCircle, Key } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type Mode = 'chat' | 'humanizer' | 'generator';
type Platform = 'vk' | 'ok' | 'telegram' | 'universal';
type Tone = 'friendly' | 'professional' | 'humorous' | 'emotional' | 'selling';

// ─── Humanizer System Prompt ──────────────────────────────────────────────────
const HUMANIZER_SYSTEM = `You are an expert writing editor. Your task is to rewrite text to make it sound completely natural and human-written, removing ALL signs of AI-generated content.

PATTERNS TO REMOVE:
- Filler openers: "In today's world", "In the realm of", "It's important to note", "Certainly!", "Absolutely!", "Of course!", "I'd be happy to"
- Hollow affirmations before answering
- "Delve into", "Navigate", "Tapestry", "Nuance/nuanced", "Multifaceted", "Embark", "Unleash", "Elevate", "Leverage", "Robust", "Streamline", "Revolutionize", "Game-changing", "Groundbreaking", "Cutting-edge", "State-of-the-art", "Dive deep"
- Excessive bullet points and headers for simple info
- Unnecessary synonyms where simple words work
- Overly formal or stiff sentence structure
- Passive voice overuse
- Repetitive sentence structure
- Emoji overuse
- Hedging phrases: "It's worth noting", "It's crucial to understand"
- List obsession (converting everything to bullets)
- Unnecessary preamble before getting to the point
- Vague generalities instead of specific details

RULES FOR REWRITING:
1. Use contractions naturally (it's, don't, we're)
2. Vary sentence length — mix short punchy sentences with longer ones
3. Be direct and get to the point fast
4. Use specific details instead of vague claims
5. Sound like a real person talking, not a document
6. Keep regional expressions and personality
7. Preserve the core meaning and all key information
8. Match the original tone (casual stays casual, serious stays serious)
9. If in Russian — rewrite in natural Russian, not translated-feeling text
10. Never explain what you changed — just output the rewritten text

Output ONLY the rewritten text. No explanations, no "Here is the rewritten version:", nothing extra.`;

// ─── Generator System Prompt ──────────────────────────────────────────────────
const getGeneratorSystem = (platform: Platform, tone: Tone) => {
  const platformRules: Record<Platform, string> = {
    vk: `Platform: VKontakte (ВКонтакте)
- Optimal length: 500-2000 characters
- Can use hashtags (3-7 max)
- Supports markdown-style formatting
- Russian-speaking audience primarily
- Community/group post style
- Can include calls to action`,
    ok: `Platform: Одноклассники (OK.ru)
- Optimal length: 300-1000 characters  
- Slightly older demographic (35-55)
- Warm, friendly tone works best
- Hashtags less important
- Family-friendly content preferred
- Simple, clear language`,
    telegram: `Platform: Telegram Channel
- Optimal length: 100-4000 characters
- Supports HTML formatting (bold, italic, links)
- Can use emojis strategically (not excessively)
- No algorithm — posts must be compelling on their own
- Subscribers chose to be there — respect their time
- Can be more niche/specific`,
    universal: `Platform: Universal (works for all platforms)
- Keep under 1000 characters for compatibility
- No platform-specific formatting
- Works for VK, OK, and Telegram
- Simple paragraph structure`,
  };

  const toneRules: Record<Tone, string> = {
    friendly: 'Write in a warm, conversational, approachable tone. Like talking to a friend.',
    professional: 'Write professionally but not stiffly. Authoritative yet accessible.',
    humorous: 'Be genuinely funny. Use wit, wordplay, relatable humor. Avoid forced jokes.',
    emotional: 'Write with heart. Evoke emotion, tell stories, make readers feel something.',
    selling: 'Write persuasively. Focus on benefits not features. Clear CTA. No pushy salesy clichés.',
  };

  return `You are an expert social media copywriter who writes engaging, human posts.

${platformRules[platform]}

Tone: ${toneRules[tone]}

CRITICAL RULES:
1. NO AI clichés: no "delve", "unleash", "revolutionize", "game-changing", "tapestry", etc.
2. NO hollow openers — start with something that immediately grabs attention
3. Write like a real person, not a marketing bot
4. Be specific — vague generalities kill engagement
5. Use the HUMANIZER principles — natural rhythm, varied sentences, direct language
6. If topic is in Russian, write in natural Russian
7. Output ONLY the post text. No "Here's your post:", no quotes around it, nothing extra.`;
};

// ─── Chat System Prompt ───────────────────────────────────────────────────────
const CHAT_SYSTEM = `You are an expert social media strategist and copywriter assistant for AutoPost — a multi-platform posting tool for VKontakte, Odnoklassniki, and Telegram.

You help users:
- Write compelling social media posts
- Improve existing content
- Develop content strategies
- Suggest post ideas
- Analyze what works on each platform

You apply the Humanizer principle in all your writing: no AI clichés, natural language, direct and specific.

When suggesting post text, always output it clearly so the user can easily copy it.
Respond in the same language the user writes in (Russian or English).
Be concise and practical — give actionable advice, not long essays.`;

// ─── API Call ─────────────────────────────────────────────────────────────────
async function callQwen(
  messages: { role: string; content: string }[],
  apiKey: string,
  model = 'qwen-plus' // Qwen 3.5 Plus
): Promise<string> {
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Qwen API Error ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const platformLabels: Record<Platform, string> = {
  vk: 'ВКонтакте',
  ok: 'Одноклассники',
  telegram: 'Telegram',
  universal: 'Универсальный',
};

const toneLabels: Record<Tone, string> = {
  friendly: '😊 Дружелюбный',
  professional: '💼 Профессиональный',
  humorous: '😄 С юмором',
  emotional: '❤️ Эмоциональный',
  selling: '🎯 Продающий',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function AiAssistantPage() {
  const { setActiveTab } = useStore();

  // API Key state
  const [apiKey, setApiKey] = useState(() => {
    // Migration: copy from openai if found (optional)
    const oldKey = localStorage.getItem('openai_api_key');
    const newKey = localStorage.getItem('dashscope_api_key') || (oldKey && oldKey.startsWith('sk-') ? oldKey : '');
    return newKey;
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeySetup, setShowKeySetup] = useState(() => !localStorage.getItem('dashscope_api_key'));

  // Mode
  const [mode, setMode] = useState<Mode>('chat');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Привет! Я AI-ассистент для создания постов. Могу помочь написать контент для ВКонтакте, Одноклассников и Telegram, улучшить существующий текст или подсказать идеи. Что создаём?',
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Humanizer state
  const [humanizerInput, setHumanizerInput] = useState('');
  const [humanizerOutput, setHumanizerOutput] = useState('');
  const [humanizerLoading, setHumanizerLoading] = useState(false);

  // Generator state
  const [genTopic, setGenTopic] = useState('');
  const [genPlatform, setGenPlatform] = useState<Platform>('vk');
  const [genTone, setGenTone] = useState<Tone>('friendly');
  const [genOutput, setGenOutput] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genExtraContext, setGenExtraContext] = useState('');

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Save API Key ────────────────────────────────────────────────────────────
  const saveApiKey = () => {
    if (!apiKeyInput.trim()) {
      toast.error('Введите API ключ');
      return;
    }
    localStorage.setItem('dashscope_api_key', apiKeyInput);
    setApiKey(apiKeyInput);
    setShowKeySetup(false);
    toast.success('DashScope API ключ сохранён!');
  };

  const clearApiKey = () => {
    localStorage.removeItem('dashscope_api_key');
    localStorage.removeItem('openai_api_key'); // clear both for security
    setApiKey('');
    setApiKeyInput('');
    setShowKeySetup(true);
  };

  // ── Copy helper ─────────────────────────────────────────────────────────────
  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Скопировано!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Send to Composer ────────────────────────────────────────────────────────
  const sendToComposer = (text: string) => {
    sessionStorage.setItem('composer_prefill', text);
    setActiveTab('composer');
    toast.success('Текст отправлен в Composer!');
  };

  // ── Chat ────────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;
    if (!apiKey) { toast.error('Сначала добавьте DashScope API ключ'); return; }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await callQwen(
        [{ role: 'system', content: CHAT_SYSTEM }, ...history],
        apiKey
      );

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() },
      ]);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка Qwen');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Humanize ────────────────────────────────────────────────────────────────
  const humanize = async () => {
    if (!humanizerInput.trim()) return;
    if (!apiKey) { toast.error('Сначала добавьте DashScope API ключ'); return; }

    setHumanizerLoading(true);
    setHumanizerOutput('');

    try {
      const result = await callQwen(
        [
          { role: 'system', content: HUMANIZER_SYSTEM },
          { role: 'user', content: humanizerInput },
        ],
        apiKey
      );
      setHumanizerOutput(result);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка Qwen');
    } finally {
      setHumanizerLoading(false);
    }
  };

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = async () => {
    if (!genTopic.trim()) return;
    if (!apiKey) { toast.error('Сначала добавьте DashScope API ключ'); return; }

    setGenLoading(true);
    setGenOutput('');

    try {
      const userPrompt = `Write a social media post about: ${genTopic}${genExtraContext ? `\n\nAdditional context: ${genExtraContext}` : ''}`;

      const result = await callQwen(
        [
          { role: 'system', content: getGeneratorSystem(genPlatform, genTone) },
          { role: 'user', content: userPrompt },
        ],
        apiKey,
        'qwen-max'
      );
      setGenOutput(result);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка Qwen');
    } finally {
      setGenLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI Ассистент</h1>
              <p className="text-xs text-gray-500">Qwen 3.5 · Humanizer · Генератор постов</p>
            </div>
          </div>

          {/* API Key indicator */}
          <button
            onClick={() => setShowKeySetup(!showKeySetup)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              apiKey
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            )}
          >
            <Key size={12} />
            {apiKey ? 'API ключ настроен' : 'Добавить API ключ'}
          </button>
        </div>

        {/* API Key Setup Panel */}
        {showKeySetup && (
          <div className="mt-4 p-4 bg-violet-50 rounded-xl border border-violet-100">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-violet-800">
                <p className="font-semibold mb-1">Нужен DashScope API ключ</p>
                <p className="text-xs text-violet-600">
                  Получите на{' '}
                  <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    dashscope.console.aliyun.com
                  </a>
                  {' '} или через {' '}
                  <a href="https://chat.qwen.ai/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    chat.qwen.ai
                  </a>
                  {' '}· Ключ хранится только в вашем браузере
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
                placeholder="Ключ DashScope (sk-...)"
                className="flex-1 px-3 py-2 text-sm border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              />
              <button
                onClick={saveApiKey}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
              >
                Сохранить
              </button>
              {apiKey && (
                <button
                  onClick={clearApiKey}
                  className="px-3 py-2 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200 transition-colors"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex gap-1 mt-4 bg-gray-100 rounded-xl p-1">
          {([
            { id: 'chat', label: 'Чат с AI', icon: MessageSquare },
            { id: 'humanizer', label: 'Humanizer', icon: Wand2 },
            { id: 'generator', label: 'Генератор', icon: Zap },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                mode === id
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHAT MODE ──────────────────────────────────────────────────────── */}
      {mode === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm',
                    msg.role === 'assistant'
                      ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {msg.role === 'assistant' ? <Sparkles size={14} /> : '👤'}
                </div>

                {/* Bubble */}
                <div className={cn('max-w-[75%] group', msg.role === 'user' ? 'items-end' : 'items-start', 'flex flex-col')}>
                  <div
                    className={cn(
                      'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'assistant'
                        ? 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                        : 'bg-violet-600 text-white'
                    )}
                  >
                    {msg.content}
                  </div>

                  {/* Actions for assistant messages */}
                  {msg.role === 'assistant' && msg.id !== '1' && (
                    <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyText(msg.content, msg.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-100"
                      >
                        {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                        Копировать
                      </button>
                      <button
                        onClick={() => sendToComposer(msg.content)}
                        className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 px-2 py-1 rounded-md hover:bg-violet-50"
                      >
                        <ArrowRight size={11} />
                        В Composer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-6 pb-2 flex gap-2 flex-wrap flex-shrink-0">
            {[
              'Напиши пост для ВК о новом продукте',
              'Идеи для контент-плана на неделю',
              'Как увеличить охваты в Telegram?',
              'Перепиши этот текст живее',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setChatInput(prompt)}
                className="text-xs px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full hover:bg-violet-100 transition-colors border border-violet-100"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
            <div className="flex gap-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Спросите что-нибудь... (Enter — отправить, Shift+Enter — новая строка)"
                rows={2}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !chatInput.trim()}
                className="w-11 h-11 self-end bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HUMANIZER MODE ─────────────────────────────────────────────────── */}
      {mode === 'humanizer' && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Info banner */}
            <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Wand2 size={20} className="text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Humanizer — убирает AI-признаки из текста</h3>
                  <p className="text-sm text-gray-600">
                    Удаляет клише, роботизированные фразы и шаблонные обороты. Делает текст живым и естественным.
                    Основан на Wikipedia "Signs of AI writing".
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['❌ "В мире современных технологий"', '❌ "Безусловно, стоит отметить"', '❌ "Революционный подход"'].map((ex) => (
                      <span key={ex} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">📄 Исходный текст</span>
                  <span className="text-xs text-gray-400">{humanizerInput.length} символов</span>
                </div>
                <textarea
                  value={humanizerInput}
                  onChange={(e) => setHumanizerInput(e.target.value)}
                  placeholder="Вставьте текст сюда — пост, статью, описание продукта или любой другой контент который нужно сделать живее..."
                  className="w-full h-64 px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none placeholder-gray-400"
                />
                <div className="px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={humanize}
                    disabled={humanizerLoading || !humanizerInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    {humanizerLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Обрабатываю...
                      </>
                    ) : (
                      <>
                        <Wand2 size={14} />
                        Humanize текст
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Output */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">✨ Живой текст</span>
                  {humanizerOutput && (
                    <span className="text-xs text-emerald-500 font-medium">Готово!</span>
                  )}
                </div>
                <div className="h-64 px-4 py-3 text-sm text-gray-800 overflow-y-auto whitespace-pre-wrap">
                  {humanizerLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs">Qwen убирает лишнее...</span>
                    </div>
                  ) : humanizerOutput ? (
                    humanizerOutput
                  ) : (
                    <span className="text-gray-400">Результат появится здесь...</span>
                  )}
                </div>
                {humanizerOutput && (
                  <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => copyText(humanizerOutput, 'humanizer-out')}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                      {copiedId === 'humanizer-out' ? <Check size={14} /> : <Copy size={14} />}
                      Копировать
                    </button>
                    <button
                      onClick={() => sendToComposer(humanizerOutput)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <ArrowRight size={14} />
                      В Composer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* What it removes */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">🔍 Что Humanizer убирает:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { icon: '🚫', title: 'Клише-открытия', desc: '"В мире...", "Сегодня...", "Безусловно..."' },
                  { icon: '✂️', title: 'Buzz-words', desc: '"Революционный", "Инновационный", "Геймченджер"' },
                  { icon: '📋', title: 'Лишние списки', desc: 'Конвертирует всё в буллеты без причины' },
                  { icon: '🎭', title: 'Пустые фразы', desc: '"Стоит отметить", "Важно понимать"' },
                  { icon: '📝', title: 'Пассивный залог', desc: 'Был создан, было использовано' },
                  { icon: '🔄', title: 'Повторы структуры', desc: 'Одинаковые предложения подряд' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-lg mb-1">{icon}</div>
                    <div className="text-xs font-semibold text-gray-700">{title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GENERATOR MODE ─────────────────────────────────────────────────── */}
      {mode === 'generator' && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Settings card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">⚙️ Параметры генерации</h3>

              {/* Topic */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Тема поста <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="Например: скидка 30% на все товары до конца недели"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Extra context */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Дополнительный контекст (необязательно)
                </label>
                <textarea
                  value={genExtraContext}
                  onChange={(e) => setGenExtraContext(e.target.value)}
                  placeholder="Целевая аудитория, детали, что нужно упомянуть, ссылки..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Platform */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Платформа</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(platformLabels) as Platform[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setGenPlatform(p)}
                      className={cn(
                        'py-2.5 px-3 rounded-xl text-xs font-medium border transition-all',
                        genPlatform === p
                          ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                          : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                      )}
                    >
                      {platformLabels[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Тон</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(toneLabels) as Tone[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setGenTone(t)}
                      className={cn(
                        'py-2.5 px-3 rounded-xl text-xs font-medium border transition-all text-left',
                        genTone === t
                          ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                          : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                      )}
                    >
                      {toneLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generate}
                disabled={genLoading || !genTopic.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-200"
              >
                {genLoading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Генерирую пост...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Сгенерировать пост
                  </>
                )}
              </button>
            </div>

            {/* Output */}
            {(genOutput || genLoading) && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    ✨ Пост для {platformLabels[genPlatform]}
                  </span>
                  {genOutput && (
                    <span className="text-xs text-gray-400">{genOutput.length} символов</span>
                  )}
                </div>

                <div className="px-5 py-4 min-h-32">
                  {genLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-400">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs">Qwen 3.5 пишет пост...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{genOutput}</p>
                  )}
                </div>

                {genOutput && (
                  <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={generate}
                      className="flex items-center gap-1.5 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                      <RefreshCw size={13} />
                      Ещё вариант
                    </button>
                    <button
                      onClick={() => {
                        setHumanizerInput(genOutput);
                        setMode('humanizer');
                      }}
                      className="flex items-center gap-1.5 py-2 px-4 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 rounded-xl text-sm font-medium transition-colors border border-fuchsia-100"
                    >
                      <Wand2 size={13} />
                      Humanize
                    </button>
                    <button
                      onClick={() => copyText(genOutput, 'gen-out')}
                      className="flex items-center gap-1.5 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                      {copiedId === 'gen-out' ? <Check size={13} /> : <Copy size={13} />}
                      Копировать
                    </button>
                    <button
                      onClick={() => sendToComposer(genOutput)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <ArrowRight size={13} />
                      В Composer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tips */}
            {!genOutput && !genLoading && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">💡 Быстрые примеры тем</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Акция: скидка 30% на весь ассортимент',
                    'Открытие нового магазина в Москве',
                    'Отзыв довольного клиента',
                    'Лайфхак по использованию продукта',
                    'За кулисами: как мы работаем',
                    'Анонс нового продукта/услуги',
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setGenTopic(example)}
                      className="text-left text-xs px-3 py-2.5 bg-gray-50 hover:bg-violet-50 hover:text-violet-700 text-gray-600 rounded-xl border border-gray-100 hover:border-violet-200 transition-all"
                    >
                      → {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
