import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account, Post, PostResult, RepostRule, RepostHistoryItem, UtmPreset, AnalyticsEntry } from '../types';

interface AppStore {
  accounts: Account[];
  posts: Post[];
  activeTab: string;

  // Reposter
  repostRules: RepostRule[];
  repostHistory: RepostHistoryItem[];

  // UTM & Analytics
  utmPresets: UtmPreset[];
  analyticsEntries: AnalyticsEntry[];
  
  // Backend Proxy Configuration
  backendUrl: string | null;
  useBackend: boolean;
  isAuthorized: boolean;
  
  // AI Assistant Config
  aiBaseUrl: string;
  aiModel: string;
  setAiBaseUrl: (url: string) => void;
  setAiModel: (model: string) => void;

  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  toggleAccount: (id: string) => void;

  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'results'>) => void;
  updatePost: (id: string, updates: Partial<Post>) => void;
  removePost: (id: string) => void;
  updatePostResult: (postId: string, result: PostResult) => void;

  // Reposter actions
  addRepostRule: (rule: Omit<RepostRule, 'id' | 'createdAt'>) => void;
  updateRepostRule: (id: string, updates: Partial<RepostRule>) => void;
  removeRepostRule: (id: string) => void;
  toggleRepostRule: (id: string) => void;
  addRepostHistory: (item: Omit<RepostHistoryItem, 'id'>) => void;
  clearRepostHistory: () => void;

  // UTM Presets
  addUtmPreset: (preset: Omit<UtmPreset, 'id' | 'createdAt'>) => void;
  updateUtmPreset: (id: string, updates: Partial<UtmPreset>) => void;
  removeUtmPreset: (id: string) => void;

  // Analytics
  addAnalyticsEntry: (entry: Omit<AnalyticsEntry, 'id' | 'createdAt' | 'lastUpdatedAt'>) => void;
  updateAnalyticsEntry: (id: string, updates: Partial<AnalyticsEntry>) => void;
  incrementClicks: (id: string, count?: number) => void;
  incrementConversions: (id: string, count?: number) => void;
  clearAnalytics: () => void;

  setAuthorized: (status: boolean) => void;
  setActiveTab: (tab: string) => void;
  syncData: () => Promise<void>;
  setBackendConfig: (url: string | null, enabled: boolean) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      posts: [],
      activeTab: 'composer',
      repostRules: [],
      repostHistory: [],
      utmPresets: [],
      analyticsEntries: [],
      backendUrl: typeof window !== 'undefined' ? window.location.origin : 'https://post-production-01fa.up.railway.app',
      useBackend: true,
      isAuthorized: typeof document !== 'undefined' ? document.cookie.includes('app_token=') : false,
      aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      aiModel: 'gemini-1.5-flash',

      setAiBaseUrl: (url) => set({ aiBaseUrl: url }),
      setAiModel: (model) => set({ aiModel: model }),

      syncData: async () => {
        const { useBackend, backendUrl } = get();
        if (!useBackend || !backendUrl) return;

        try {
          const [accRes, postRes, ruleRes, historyRes] = await Promise.all([
            fetch(`${backendUrl}/api/accounts`),
            fetch(`${backendUrl}/api/posts`),
            fetch(`${backendUrl}/api/reposter/rules`),
            fetch(`${backendUrl}/api/reposter/history`),
          ]);

          if (accRes.ok) set({ accounts: await accRes.json() });
          if (postRes.ok) set({ posts: await postRes.json() });
          if (ruleRes.ok) set({ repostRules: await ruleRes.json() });
          if (historyRes.ok) set({ repostHistory: await historyRes.json() });
        } catch (e) {
          console.error('Failed to sync data:', e);
        }
      },

      addAccount: async (account) => {
        const { useBackend, backendUrl } = get();

        if (useBackend && backendUrl) {
          try {
            const res = await fetch(`${backendUrl}/api/accounts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                platform: account.platform,
                name: account.name,
                ownerId: account.vkOwnerId || account.tgChatId || account.okGroupId,
                token: account.vkToken || account.tgBotToken || account.okToken,
                okAppKey: account.okAppKey,
                okAppSecretKey: account.okAppSecretKey,
                okGroupId: account.okGroupId,
              }),
            });
            if (res.ok) {
              const newAcc = await res.json();
              set((s) => ({ accounts: [...s.accounts, newAcc] }));
              return;
            }
          } catch (e) {
            console.error('Backend save failed:', e);
          }
        }

        // Fallback to local if backend fails or disabled
        const newAccount: Account = {
          ...account,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ accounts: [...s.accounts, newAccount] }));
      },

      updateAccount: (id, updates) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        }));
      },

      removeAccount: async (id) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl) {
          try {
            await fetch(`${backendUrl}/api/accounts/${id}`, { method: 'DELETE' });
          } catch (e) {
            console.error('Backend delete failed:', e);
          }
        }
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
      },

      toggleAccount: async (id) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl) {
          try {
            await fetch(`${backendUrl}/api/accounts/${id}/toggle`, { method: 'PATCH' });
          } catch (e) {
            console.error('Backend toggle failed:', e);
          }
        }
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        }));
      },

      addPost: async (post) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl) {
          try {
            const res = await fetch(`${backendUrl}/api/posts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(post),
            });
            if (res.ok) {
              const newPost = await res.json();
              set((s) => ({ posts: [...s.posts, newPost] }));
              return;
            }
          } catch (e) {
            console.error('Backend addPost failed:', e);
          }
        }
        const newPost: Post = { ...post, id: crypto.randomUUID(), createdAt: new Date().toISOString(), results: [] };
        set((s) => ({ posts: [...s.posts, newPost] }));
      },

      updatePost: async (id, updates) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl && id.length > 20) { // Check if it's a MongoDB ID
          try {
            await fetch(`${backendUrl}/api/posts/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
          } catch (e) {
            console.error('Backend updatePost failed:', e);
          }
        }
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      removePost: async (id) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl && id.length > 20) {
          try {
            await fetch(`${backendUrl}/api/posts/${id}`, { method: 'DELETE' });
          } catch (e) {
            console.error('Backend removePost failed:', e);
          }
        }
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
      },

      updatePostResult: (postId, result) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  results: [
                    ...p.results.filter((r) => r.accountId !== result.accountId),
                    result,
                  ],
                }
              : p
          ),
        }));
      },

      addRepostRule: async (rule) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl) {
          try {
            const res = await fetch(`${backendUrl}/api/reposter/rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rule),
            });
            if (res.ok) {
              const newRule = await res.json();
              set((s) => ({ repostRules: [...s.repostRules, newRule] }));
              return;
            }
          } catch (e) {
            console.error('Backend addRepostRule failed:', e);
          }
        }
        const newRule: RepostRule = { ...rule, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        set((s) => ({ repostRules: [...s.repostRules, newRule] }));
      },

      updateRepostRule: async (id, updates) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl && id.length > 20) {
          try {
            await fetch(`${backendUrl}/api/reposter/rules/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
          } catch (e) {
            console.error('Backend updateRepostRule failed:', e);
          }
        }
        set((s) => ({
          repostRules: s.repostRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }));
      },

      removeRepostRule: async (id) => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl && id.length > 20) {
          try {
            await fetch(`${backendUrl}/api/reposter/rules/${id}`, { method: 'DELETE' });
          } catch (e) {
            console.error('Backend removeRepostRule failed:', e);
          }
        }
        set((s) => ({ repostRules: s.repostRules.filter((r) => r.id !== id) }));
      },

      toggleRepostRule: async (id) => {
        const { repostRules } = get();
        const rule = repostRules.find(r => r.id === id);
        if (!rule) return;
        const newStatus = rule.status === 'active' ? 'paused' : 'active';
        get().updateRepostRule(id, { status: newStatus });
      },

      addRepostHistory: (item) => {
        // We let the backend handle history creation, but we can optimistically add it locally
        const newItem: RepostHistoryItem = { ...item, id: crypto.randomUUID() };
        set((s) => ({ repostHistory: [newItem, ...s.repostHistory].slice(0, 500) }));
      },

      clearRepostHistory: async () => {
        const { useBackend, backendUrl } = get();
        if (useBackend && backendUrl) {
          try {
            await fetch(`${backendUrl}/api/reposter/history`, { method: 'DELETE' });
          } catch (e) {
            console.error('Backend clearRepostHistory failed:', e);
          }
        }
        set({ repostHistory: [] });
      },

      // ── UTM Presets ──────────────────────────────────────────────────────────
      addUtmPreset: (preset) => {
        const newPreset: UtmPreset = {
          ...preset,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ utmPresets: [...s.utmPresets, newPreset] }));
      },

      updateUtmPreset: (id, updates) => {
        set((s) => ({
          utmPresets: s.utmPresets.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      removeUtmPreset: (id) => {
        set((s) => ({ utmPresets: s.utmPresets.filter((p) => p.id !== id) }));
      },

      // ── Analytics ────────────────────────────────────────────────────────────
      addAnalyticsEntry: (entry) => {
        const now = new Date().toISOString();
        const newEntry: AnalyticsEntry = {
          ...entry,
          id: crypto.randomUUID(),
          createdAt: now,
          lastUpdatedAt: now,
          ctr: 0,
        };
        set((s) => ({ analyticsEntries: [newEntry, ...s.analyticsEntries] }));
      },

      updateAnalyticsEntry: (id, updates) => {
        set((s) => ({
          analyticsEntries: s.analyticsEntries.map((e) =>
            e.id === id ? { ...e, ...updates, lastUpdatedAt: new Date().toISOString() } : e
          ),
        }));
      },

      incrementClicks: (id, count = 1) => {
        set((s) => ({
          analyticsEntries: s.analyticsEntries.map((e) =>
            e.id === id
              ? { ...e, clicks: e.clicks + count, lastUpdatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      incrementConversions: (id, count = 1) => {
        set((s) => ({
          analyticsEntries: s.analyticsEntries.map((e) =>
            e.id === id
              ? { ...e, conversions: e.conversions + count, lastUpdatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      clearAnalytics: () => set({ analyticsEntries: [] }),

      setBackendConfig: (url: string | null, enabled: boolean) => {
        set({ backendUrl: url, useBackend: enabled });
        if (enabled) {
          get().syncData();
        }
      },

      setAuthorized: (status: boolean) => set({ isAuthorized: status }),

      setActiveTab: (tab: string) => set({ activeTab: tab }),
    }),
    { 
      name: 'autopost-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2 && persistedState) {
          const oldUrl = 'https://post-production-01fa.up.railway.app';
          if (persistedState.backendUrl === oldUrl) {
            console.log('🚀 Migrating stale backend URL');
            return {
              ...persistedState,
              backendUrl: typeof window !== 'undefined' ? window.location.origin : oldUrl
            };
          }
        }
        return persistedState;
      }
    }
  )
);
