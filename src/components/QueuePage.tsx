import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import EmojiPicker from 'emoji-picker-react';
import { Smile, Send, SkipForward, MessageCircle, Globe } from 'lucide-react';

export default function QueuePage() {
  const { api, accounts } = useStore();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState({});
  const [publishing, setPublishing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const items = await api.get('/api/reposter/queue');
      setQueue(items);
      const targets = {};
      items.forEach(item => {
        targets[item.id] = item.target_account_ids || [];
      });
      setSelectedTargets(targets);
    } catch (e) {
      console.error('Failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchQueue(); 
    const i = setInterval(fetchQueue, 30000); 
    return () => clearInterval(i); 
  }, []);

  const onEmojiClick = (emojiObject) => {
    setEditText(prev => prev + emojiObject.emoji);
  };

  const approve = async (item) => {
    try {
      setPublishing(true);
      const targetIds = selectedTargets[item.id] || item.target_account_ids || [];
      await api.post('/api/reposter/queue/' + item.id + '/approve', { 
        text: editText || item.original_text,
        target_account_ids: targetIds
      });
      setQueue((q) => q.filter((x) => x.id !== item.id));
      setEditingId(null);
      setEditText('');
    } catch (e) { 
      alert('Error: ' + e.message); 
    } finally {
      setPublishing(false);
    }
  };

  const reject = async (id) => {
    try {
      await api.post('/api/reposter/queue/' + id + '/reject');
      setQueue((q) => q.filter((x) => x.id !== id));
    } catch (e) { 
      alert('Error: ' + e.message); 
    }
  };

  const toggleTarget = (itemId, accountId) => {
    setSelectedTargets(prev => {
      const current = prev[itemId] || [];
      const updated = current.includes(accountId)
        ? current.filter(id => id !== accountId)
        : [...current, accountId];
      return { ...prev, [itemId]: updated };
    });
  };

  const getPlatformIcon = (platform) => {
    if (platform === 'telegram') return <MessageCircle size={16} />;
    if (platform === 'vk') return <Globe size={16} />;
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Очередь публикаций: {queue.length}</h1>
        <button 
          onClick={fetchQueue}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : queue.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500">Очередь пуста</p>
          <p className="text-sm text-gray-400 mt-2">Новые посты появятся здесь автоматически</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Публиковать в:</p>
                <div className="flex flex-wrap gap-2">
                  {accounts
                    .filter(acc => acc.isActive)
                    .map(acc => {
                      const isSelected = (selectedTargets[item.id] || item.target_account_ids || []).includes(acc.id);
                      return (
                        <button
                          key={acc.id}
                          onClick={() => toggleTarget(item.id, acc.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            isSelected 
                              ? 'bg-blue-100 border-blue-500 text-blue-700' 
                              : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {getPlatformIcon(acc.platform)}
                          <span className="text-sm">{acc.name || acc.platform}</span>
                          {isSelected && <span className="text-blue-600">✓</span>}
                        </button>
                      );
                    })}
                </div>
              </div>

              {editingId === item.id ? (
                <div className="relative">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-4 border rounded-lg min-h-[200px] font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Добавить эмодзи"
                  >
                    <Smile size={20} className="text-gray-600" />
                  </button>
                  {showEmoji && (
                    <div className="absolute top-12 right-2 z-10 shadow-xl rounded-lg">
                      <EmojiPicker onEmojiClick={onEmojiClick} width={320} height={400} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm">
                  {item.original_text}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                {editingId === item.id ? (
                  <>
                    <button
                      onClick={() => approve(item)}
                      disabled={publishing}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Send size={16} />
                      {publishing ? 'Публикация...' : 'Опубликовать'}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditText(''); setShowEmoji(false); }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(item.id); setEditText(item.original_text); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Р<button onClick={() => humanizeText(item)} disabled={humanizing} className='px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50'>{humanizing ? 'AI...' : 'AI'}</button>
                      едактировать
                    </button>
                    <button
                      onClick={() => reject(item.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <SkipForward size={16} />
                      Пропустить
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



