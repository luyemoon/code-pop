import React from 'react';

interface TrayMenuProps {
  onShow: () => void;
  onQuickSearch: () => void;
  onSettings: () => void;
  onQuit: () => void;
  status: 'ready' | 'indexing' | 'error';
}

export const TrayMenu: React.FC<TrayMenuProps> = ({
  onShow,
  onQuickSearch,
  onSettings,
  onQuit,
  status,
}) => {
  return (
    <div className="tray-menu">
      <div className="tray-menu-item" onClick={onShow}>
        打开 CodePop
      </div>
      <div className="tray-menu-item" onClick={onQuickSearch}>
        快速搜索
        <span className="shortcut">⌘⇧C</span>
      </div>
      <div className="tray-menu-divider" />
      <div className="tray-menu-status">
        <span className={`status-indicator ${status}`} />
        {status === 'ready' && '● 就绪'}
        {status === 'indexing' && '○ 索引中...'}
        {status === 'error' && '● 错误'}
      </div>
      <div className="tray-menu-divider" />
      <div className="tray-menu-item" onClick={onSettings}>
        偏好设置...
      </div>
      <div className="tray-menu-divider" />
      <div className="tray-menu-item" onClick={onQuit}>
        退出
      </div>
    </div>
  );
};
