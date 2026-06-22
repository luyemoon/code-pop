import React from 'react';

interface DockBadgeProps {
  count: number | string | null;
  loading?: boolean;
}

export const DockBadge: React.FC<DockBadgeProps> = ({ count, loading }) => {
  React.useEffect(() => {
    if (window.electron?.setDockBadge) {
      window.electron.setDockBadge(count);
    }
  }, [count]);

  if (loading) {
    return (
      <div className="dock-badge dock-badge-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!count) {
    return null;
  }

  return (
    <div className="dock-badge">
      <span className="badge-count">{count}</span>
    </div>
  );
};
