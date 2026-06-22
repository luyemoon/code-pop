import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  globalShortcut,
  nativeImage,
  dialog,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { setupDatabaseHandlers } from './ipc/database';
import { setupIndexingHandlers } from './ipc/indexing';
import { setupSearchHandlers } from './ipc/search';
import { setupSettingsHandlers } from './ipc/settings';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quickSearchWindow: BrowserWindow | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CodePop',
    icon: path.join(__dirname, '../../build/icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#1e1e1e',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createQuickSearchWindow(): BrowserWindow {
  quickSearchWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    quickSearchWindow.loadURL('http://localhost:5173/#/quick-search');
  } else {
    quickSearchWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/quick-search',
    });
  }

  quickSearchWindow.on('blur', () => {
    quickSearchWindow?.hide();
  });

  return quickSearchWindow;
}

function createTray(): Tray {
  const iconPath = path.join(__dirname, '../../build/icon.icns');
  const icon = nativeImage.createFromPath(iconPath);
  const trayIcon = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('CodePop');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 CodePop',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: '快速搜索',
      accelerator: 'Cmd+Shift+C',
      click: () => showQuickSearch(),
    },
    { type: 'separator' },
    {
      label: '状态',
      submenu: [
        { label: '● 就绪', enabled: false },
        { label: '○ 索引中...', enabled: false },
      ],
    },
    { type: 'separator' },
    {
      label: '偏好设置...',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', '/settings');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      accelerator: 'Cmd+Q',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  return tray;
}

function showQuickSearch(): void {
  if (!quickSearchWindow) {
    createQuickSearchWindow();
  }

  quickSearchWindow?.center();
  quickSearchWindow?.show();
  quickSearchWindow?.focus();
}

function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'CodePop',
      submenu: [
        { label: '关于 CodePop', role: 'about' },
        { type: 'separator' },
        {
          label: '偏好设置...',
          accelerator: 'Cmd+,',
          click: () => {
            mainWindow?.show();
            mainWindow?.webContents.send('navigate', '/settings');
          },
        },
        { type: 'separator' },
        { label: '隐藏 CodePop', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        {
          label: '退出 CodePop',
          accelerator: 'Cmd+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '打开代码仓库...',
          accelerator: 'Cmd+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory'],
              title: '选择代码仓库',
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('open-repo', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: '关闭仓库',
          accelerator: 'Cmd+W',
          click: () => {
            mainWindow?.webContents.send('close-repo');
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '显示/隐藏窗口',
          accelerator: 'Cmd+Shift+H',
          click: () => {
            if (mainWindow?.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow?.show();
              mainWindow?.focus();
            }
          },
        },
        { type: 'separator' },
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '切换开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: 'separator' },
        { label: '全部前置', role: 'front' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '文档',
          click: () => {
            shell.openExternal('https://codepop.dev/docs');
          },
        },
        {
          label: '报告问题...',
          click: () => {
            shell.openExternal('https://github.com/codepop/repo/issues');
          },
        },
        { type: 'separator' },
        {
          label: '检查更新...',
          click: () => {
            autoUpdater.checkForUpdates();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function registerGlobalShortcuts(): void {
  globalShortcut.register('Cmd+Shift+C', () => {
    showQuickSearch();
  });
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater-status', 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater-status', 'available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater-status', 'not-available', info);
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater-status', 'error', err.message);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater-status', 'downloading', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater-status', 'downloaded', info);
  });
}

function setupIpcHandlers(): void {
  setupDatabaseHandlers(ipcMain);
  setupIndexingHandlers(ipcMain);
  setupSearchHandlers(ipcMain);
  setupSettingsHandlers(ipcMain);

  ipcMain.handle('show-open-dialog', async (_, options) => {
    return dialog.showOpenDialog(options);
  });

  ipcMain.handle('show-save-dialog', async (_, options) => {
    return dialog.showSaveDialog(options);
  });

  ipcMain.handle('show-message-box', async (_, options) => {
    return dialog.showMessageBox(options);
  });

  ipcMain.on('hide-quick-search', () => {
    quickSearchWindow?.hide();
  });

  ipcMain.on('set-dock-badge', (_, badge: string | number | null) => {
    if (badge === null) {
      app.dock?.setBadge('');
    } else {
      app.dock?.setBadge(String(badge));
    }
  });

  ipcMain.handle('get-app-path', () => {
    return app.getPath('userData');
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createQuickSearchWindow();
  createTray();
  createAppMenu();
  registerGlobalShortcuts();
  setupAutoUpdater();
  setupIpcHandlers();

  if (isDev) {
    console.log('Running in development mode');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
