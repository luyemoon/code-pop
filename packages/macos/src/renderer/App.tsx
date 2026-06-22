import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

declare global {
  interface Window {
    electron: import('../preload').ElectronAPI;
  }
}

interface SearchResult {
  id: number;
  path: string;
  content: string;
  score: number;
}

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentRepo, setCurrentRepo] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [indexingProgress, setIndexingProgress] = React.useState(0);
  const [version, setVersion] = React.useState('');

  React.useEffect(() => {
    if (window.electron) {
      window.electron.getVersion().then(setVersion);

      const unsubscribeNavigate = window.electron.onNavigate((route) => {
        navigate(route);
      });

      const unsubscribeOpenRepo = window.electron.onOpenRepo((repoPath) => {
        setCurrentRepo(repoPath);
        handleIndexRepo(repoPath);
      });

      const unsubscribeCloseRepo = window.electron.onCloseRepo(() => {
        setCurrentRepo(null);
        setSearchResults([]);
      });

      return () => {
        unsubscribeNavigate();
        unsubscribeOpenRepo();
        unsubscribeCloseRepo();
      };
    }
  }, [navigate]);

  React.useEffect(() => {
    if (location.pathname === '/settings') {
      // Settings view is handled by the parent component
    }
  }, [location]);

  const handleIndexRepo = async (repoPath: string) => {
    setIsIndexing(true);
    setIndexingProgress(0);

    try {
      const { jobId } = await window.electron.indexing.start(repoPath);
      console.log('Indexing started:', jobId);
    } catch (error) {
      console.error('Indexing error:', error);
      setIsIndexing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const results = await window.electron.search.query(searchQuery);
      setSearchResults(results as SearchResult[]);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleOpenRepo = async () => {
    const result = await window.electron.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择代码仓库',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      setCurrentRepo(result.filePaths[0]);
      handleIndexRepo(result.filePaths[0]);
    }
  };

  const isSettingsPage = location.pathname === '/settings';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <h1>CodePop</h1>
          <span className="version">v{version}</span>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-button ${!isSettingsPage ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            搜索
          </button>
          <button
            className={`nav-button ${isSettingsPage ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            设置
          </button>
        </nav>
      </header>

      {isSettingsPage ? (
        <SettingsView />
      ) : (
        <main className="app-main">
          <div className="search-section">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                className="search-input"
                placeholder="搜索代码..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="search-button">
                搜索
              </button>
            </form>

            {!currentRepo ? (
              <div className="empty-state">
                <p>未打开代码仓库</p>
                <button className="primary-button" onClick={handleOpenRepo}>
                  打开仓库
                </button>
              </div>
            ) : (
              <div className="repo-info">
                <span className="repo-path">{currentRepo}</span>
                {isIndexing && (
                  <div className="indexing-indicator">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${indexingProgress}%` }}
                      />
                    </div>
                    <span>索引中... {indexingProgress}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="results-section">
            {searchResults.length > 0 ? (
              <ul className="results-list">
                {searchResults.map((result) => (
                  <li key={result.id} className="result-item">
                    <div className="result-path">{result.path}</div>
                    <div className="result-content">{result.content}</div>
                    <div className="result-score">匹配度: {result.score.toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-results">
                <p>输入搜索词开始搜索</p>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
};

const SettingsView: React.FC = () => {
  const [settings, setSettings] = React.useState({
    apiEndpoint: '',
    remoteDbUrl: '',
    launchAtStartup: false,
    showInDock: true,
    notificationsEnabled: true,
    globalHotkey: 'Cmd+Shift+C',
    theme: 'system' as 'light' | 'dark' | 'system',
    language: 'en',
  });

  React.useEffect(() => {
    window.electron.settings.getAll().then((allSettings) => {
      setSettings((prev) => ({ ...prev, ...allSettings }));
    });
  }, []);

  const handleSettingChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    window.electron.settings.set(key, value);
  };

  return (
    <div className="settings-container">
      <h2>偏好设置</h2>

      <section className="settings-section">
        <h3>连接</h3>
        <div className="setting-item">
          <label>API 端点</label>
          <input
            type="text"
            value={settings.apiEndpoint}
            onChange={(e) => handleSettingChange('apiEndpoint', e.target.value)}
            placeholder="http://localhost:3000"
          />
        </div>
        <div className="setting-item">
          <label>远程数据库 (可选)</label>
          <input
            type="text"
            value={settings.remoteDbUrl}
            onChange={(e) => handleSettingChange('remoteDbUrl', e.target.value)}
            placeholder="postgresql://..."
          />
        </div>
      </section>

      <section className="settings-section">
        <h3>启动</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.launchAtStartup}
              onChange={(e) => handleSettingChange('launchAtStartup', e.target.checked)}
            />
            开机启动
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.showInDock}
              onChange={(e) => handleSettingChange('showInDock', e.target.checked)}
            />
            显示在 Dock
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h3>通知</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
            />
            启用通知
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h3>快捷键</h3>
        <div className="setting-item">
          <label>全局快速搜索</label>
          <input
            type="text"
            value={settings.globalHotkey}
            onChange={(e) => handleSettingChange('globalHotkey', e.target.value)}
          />
        </div>
      </section>

      <section className="settings-section">
        <h3>外观</h3>
        <div className="setting-item">
          <label>主题</label>
          <select
            value={settings.theme}
            onChange={(e) => handleSettingChange('theme', e.target.value)}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
        <div className="setting-item">
          <label>语言</label>
          <select
            value={settings.language}
            onChange={(e) => handleSettingChange('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>关于</h3>
        <p>CodePop v0.1.0</p>
        <p>代码搜索与索引工具</p>
      </section>
    </div>
  );
};
