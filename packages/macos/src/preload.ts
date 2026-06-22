import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
  hideQuickSearch: () => void;
  setDockBadge: (badge: string | number | null) => void;
  getAppPath: () => Promise<string>;
  getVersion: () => Promise<string>;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  onNavigate: (callback: (route: string) => void) => () => void;
  onOpenRepo: (callback: (repoPath: string) => void) => () => void;
  onCloseRepo: (callback: () => void) => () => void;
  onUpdaterStatus: (callback: (status: string, data?: unknown) => void) => () => void;
  database: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
    getAll: (table: string, filter?: Record<string, unknown>) => Promise<unknown[]>;
    getById: (table: string, id: string | number) => Promise<unknown>;
    insert: (table: string, data: Record<string, unknown>) => Promise<number>;
    update: (table: string, id: string | number, data: Record<string, unknown>) => Promise<boolean>;
    delete: (table: string, id: string | number) => Promise<boolean>;
  };
  indexing: {
    start: (repoPath: string) => Promise<{ jobId: string }>;
    stop: (jobId: string) => Promise<void>;
    getStatus: (jobId: string) => Promise<{ status: string; progress: number }>;
    onProgress: (callback: (progress: { jobId: string; progress: number; status: string }) => void) => () => void;
  };
  search: {
    query: (searchText: string, options?: Record<string, unknown>) => Promise<unknown[]>;
    searchInFile: (filePath: string, searchText: string) => Promise<unknown[]>;
  };
  settings: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    getAll: () => Promise<Record<string, unknown>>;
    reset: () => Promise<void>;
  };
}

const api: ElectronAPI = {
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  hideQuickSearch: () => ipcRenderer.send('hide-quick-search'),
  setDockBadge: (badge) => ipcRenderer.send('set-dock-badge', badge),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onNavigate: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, route: string) => callback(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
  onOpenRepo: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, repoPath: string) => callback(repoPath);
    ipcRenderer.on('open-repo', handler);
    return () => ipcRenderer.removeListener('open-repo', handler);
  },
  onCloseRepo: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('close-repo', handler);
    return () => ipcRenderer.removeListener('close-repo', handler);
  },
  onUpdaterStatus: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, status: string, data?: unknown) => callback(status, data);
    ipcRenderer.on('updater-status', handler);
    return () => ipcRenderer.removeListener('updater-status', handler);
  },
  database: {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db-run', sql, params),
    getAll: (table, filter) => ipcRenderer.invoke('db-get-all', table, filter),
    getById: (table, id) => ipcRenderer.invoke('db-get-by-id', table, id),
    insert: (table, data) => ipcRenderer.invoke('db-insert', table, data),
    update: (table, id, data) => ipcRenderer.invoke('db-update', table, id, data),
    delete: (table, id) => ipcRenderer.invoke('db-delete', table, id),
  },
  indexing: {
    start: (repoPath) => ipcRenderer.invoke('indexing-start', repoPath),
    stop: (jobId) => ipcRenderer.invoke('indexing-stop', jobId),
    getStatus: (jobId) => ipcRenderer.invoke('indexing-status', jobId),
    onProgress: (callback) => {
      const handler = (_: Electron.IpcRendererEvent, progress: { jobId: string; progress: number; status: string }) => callback(progress);
      ipcRenderer.on('indexing-progress', handler);
      return () => ipcRenderer.removeListener('indexing-progress', handler);
    },
  },
  search: {
    query: (searchText, options) => ipcRenderer.invoke('search-query', searchText, options),
    searchInFile: (filePath, searchText) => ipcRenderer.invoke('search-in-file', filePath, searchText),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings-get', key),
    set: (key, value) => ipcRenderer.invoke('settings-set', key, value),
    getAll: () => ipcRenderer.invoke('settings-get-all'),
    reset: () => ipcRenderer.invoke('settings-reset'),
  },
};

contextBridge.exposeInMainWorld('electron', api);
