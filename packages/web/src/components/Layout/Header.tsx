import { useLocation, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useStore } from '../../store';
import { clsx } from 'clsx';

const routeTitles: Record<string, string> = {
  '/': '仪表盘',
  '/repos': '仓库管理',
  '/search': '代码搜索',
  '/settings': '系统设置',
};

export const Header = () => {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useStore();
  const title = routeTitles[location.pathname] || 'CodePop';

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/search"
            className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            快速搜索
          </Link>
        </div>
      </div>
    </header>
  );
};
