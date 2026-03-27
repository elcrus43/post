import { PenSquare, Clock, Users, History, Settings, Zap, BookOpen, Sparkles, RefreshCw, BarChart2 } from 'lucide-react'; // eslint-disable-line
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

const navItems = [
  { id: 'composer', label: 'Создать пост', icon: PenSquare },
  { id: 'ai', label: 'AI Ассистент', icon: Sparkles, badge: 'AI' },
  { id: 'reposter', label: 'Репостер', icon: RefreshCw },
  { id: 'analytics', label: 'UTM & Аналитика', icon: BarChart2 },
  { id: 'scheduler', label: 'Планировщик', icon: Clock },
  { id: 'accounts', label: 'Аккаунты', icon: Users },
  { id: 'history', label: 'История', icon: History },
  { id: 'settings', label: 'Настройки', icon: Settings },
  { id: 'deploy', label: 'Деплой & Бэкап', icon: BookOpen },
];

export default function Sidebar() {
  const { activeTab, setActiveTab, accounts, posts } = useStore();
  const activeAccounts = accounts.filter((a) => a.isActive).length;
  const scheduledPosts = posts.filter((p) => p.status === 'scheduled').length;

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">AutoPost</div>
            <div className="text-gray-400 text-xs">Умный автопостинг</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-gray-700/60">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-violet-400 font-bold text-lg leading-tight">{activeAccounts}</div>
            <div className="text-gray-400 text-xs">Аккаунтов</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center">
            <div className="text-emerald-400 font-bold text-lg leading-tight">{scheduledPosts}</div>
            <div className="text-gray-400 text-xs">В очереди</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon, badge }: any) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon size={18} />
            <span className="flex-1 text-left">{label}</span>
            {badge && (
              <span className="text-[9px] font-bold bg-fuchsia-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-700/60 space-y-2">
        <div className="text-xs text-gray-500 text-center">
          VK · Одноклассники · Telegram
        </div>
        <div className="bg-violet-900/40 rounded-lg px-3 py-2 text-center">
          <div className="text-xs text-violet-300 font-medium">Antigravity</div>
          <div className="text-xs text-gray-500">AutoPost v1.0</div>
        </div>
      </div>
    </aside>
  );
}
