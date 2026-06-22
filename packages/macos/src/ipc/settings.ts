import { IpcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface Settings {
  apiEndpoint: string;
  remoteDbUrl: string;
  launchAtStartup: boolean;
  showInDock: boolean;
  notificationsEnabled: boolean;
  globalHotkey: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

const defaultSettings: Settings = {
  apiEndpoint: 'http://localhost:3000',
  remoteDbUrl: '',
  launchAtStartup: false,
  showInDock: true,
  notificationsEnabled: true,
  globalHotkey: 'Cmd+Shift+C',
  theme: 'system',
  language: 'en',
};

let settings: Settings | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): Settings {
  if (settings) return settings;

  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      settings = { ...defaultSettings, ...JSON.parse(data) };
    } else {
      settings = { ...defaultSettings };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = { ...defaultSettings };
  }

  return settings;
}

function saveSettings(): void {
  const settingsPath = getSettingsPath();
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

export function setupSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings-get', async (_, key: string) => {
    const currentSettings = loadSettings();
    return (currentSettings as Record<string, unknown>)[key];
  });

  ipcMain.handle('settings-set', async (_, key: string, value: unknown) => {
    const currentSettings = loadSettings();
    (currentSettings as Record<string, unknown>)[key] = value;
    saveSettings();
  });

  ipcMain.handle('settings-get-all', async () => {
    return loadSettings();
  });

  ipcMain.handle('settings-reset', async () => {
    settings = { ...defaultSettings };
    saveSettings();
  });
}
