import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Repo, SearchResult, Settings } from '../types';

interface AppStore {
  // Repository State
  repos: Repo[];
  setRepos: (repos: Repo[]) => void;
  addRepo: (repo: Repo) => void;
  updateRepo: (id: string, updates: Partial<Repo>) => void;
  removeRepo: (id: string) => void;

  // Search State
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;

  // Settings State
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // Repository State
      repos: [],
      setRepos: (repos) => set({ repos }),
      addRepo: (repo) => set((state) => ({ repos: [...state.repos, repo] })),
      updateRepo: (id, updates) =>
        set((state) => ({
          repos: state.repos.map((repo) =>
            repo.id === id ? { ...repo, ...updates } : repo
          ),
        })),
      removeRepo: (id) =>
        set((state) => ({
          repos: state.repos.filter((repo) => repo.id !== id),
        })),

      // Search State
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),
      recentSearches: [],
      addRecentSearch: (query) =>
        set((state) => ({
          recentSearches: [query, ...state.recentSearches.filter((q) => q !== query)].slice(0, 10),
        })),

      // Settings State
      settings: {
        apiEndpoint: 'http://localhost:8080/api/v1',
        embeddingProvider: 'openai',
        theme: 'dark',
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // UI State
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'codepop-storage',
      partialize: (state) => ({
        settings: state.settings,
        recentSearches: state.recentSearches,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
