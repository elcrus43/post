import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import { useScheduler } from './hooks/useScheduler';
import { useReposter } from './hooks/useReposter';
import { useNotifications } from './hooks/useNotifications';
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import ComposerPage from './components/ComposerPage';
import SchedulerPage from './components/SchedulerPage';
import AccountsPage from './components/AccountsPage';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import DeployGuidePage from './components/DeployGuidePage';
import AiAssistantPage from './components/AiAssistantPage';
import ReposterPage from './components/ReposterPage';
import AnalyticsPage from './components/AnalyticsPage';

export default function App() {
  const { activeTab, isAuthorized, syncAccounts } = useStore();
  useScheduler();      // ⏰ Автоматический планировщик публикаций
  useReposter();       // 🔄 Автоматический репостер
  useNotifications();  // 🔔 Push-уведомления + авто-удаление

  useEffect(() => {
    if (isAuthorized) {
      syncAccounts();
    }
  }, [isAuthorized, syncAccounts]);

  if (!isAuthorized) {
    return (
      <>
        <Toaster position="top-right" />
        <Login />
      </>
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'composer':   return <ComposerPage />;
      case 'ai':         return <AiAssistantPage />;
      case 'reposter':   return <ReposterPage />;
      case 'analytics':  return <AnalyticsPage />;
      case 'scheduler':  return <SchedulerPage />;
      case 'accounts':   return <AccountsPage />;
      case 'history':    return <HistoryPage />;
      case 'settings':   return <SettingsPage />;
      case 'deploy':     return <DeployGuidePage />;
      default:           return <ComposerPage />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}
