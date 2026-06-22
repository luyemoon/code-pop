import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Code2,
} from 'lucide-react';
import { useStore } from '../../store';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/repos', icon: FolderGit2, label: '仓库' },
  { path: '/search', icon: Search, label: '搜索' },
  { path: '/settings', icon: Settings, label: '设置' },
];

export const Sidebar = () => {
  const { sidebarOpen, toggleSidebar } = useStore();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <Code2 className="w-8 h-8 text-indigo-500 flex-shrink-0" />
        {sidebarOpen && (
          <span className="font-bold text-lg whitespace-nowrap">CodePop</span>
        )}
      </div>

      <nav className="p-3 space-y-1">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
              'hover:bg-slate-800 hover:text-indigo-400',
              location.pathname === path
                ? 'bg-slate-800 text-indigo-400 border-l-2 border-indigo-500'
                : 'text-slate-300'
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        className="absolute bottom-4 -right-3 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-600 transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
};
