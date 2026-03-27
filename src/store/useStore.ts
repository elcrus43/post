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

  setActiveTab: (tab: string) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      accounts: [],
      posts: [],
      activeTab: 'composer',
      repostRules: [],
      repostHistory: [],
      utmPresets: [],
      analyticsEntries: [],
      backendUrl: null,
      useBackend: false,

      addAccount: (account) => {
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

      removeAccount: (id) => {
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
      },

      toggleAccount: (id) => {
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        }));
      },

      addPost: (post) => {
        const newPost: Post = {
          ...post,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          results: [],
        };
        set((s) => ({ posts: [...s.posts, newPost] }));
      },

      updatePost: (id, updates) => {
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      removePost: (id) => {
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

      addRepostRule: (rule) => {
        const newRule: RepostRule = {
          ...rule,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ repostRules: [...s.repostRules, newRule] }));
      },

      updateRepostRule: (id, updates) => {
        set((s) => ({
          repostRules: s.repostRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }));
      },

      removeRepostRule: (id) => {
        set((s) => ({ repostRules: s.repostRules.filter((r) => r.id !== id) }));
      },

      toggleRepostRule: (id) => {
        set((s) => ({
          repostRules: s.repostRules.map((r) =>
            r.id === id
              ? { ...r, status: r.status === 'active' ? 'paused' : 'active' }
              : r
          ),
        }));
      },

      addRepostHistory: (item) => {
        const newItem: RepostHistoryItem = { ...item, id: crypto.randomUUID() };
        set((s) => ({ repostHistory: [newItem, ...s.repostHistory].slice(0, 500) }));
      },

      clearRepostHistory: () => set({ repostHistory: [] }),

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

      setBackendConfig: (url, enabled) => set({ backendUrl: url, useBackend: enabled }),

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    { name: 'autopost-storage' }
  )
);
