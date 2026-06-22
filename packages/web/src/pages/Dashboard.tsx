import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  FileText,
  Search,
  Clock,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { fetchStats } from '../api';
import { useStore } from '../store';
import { SearchBox } from '../components/SearchBox';
import { useSearch } from '../hooks/useSearch';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { recentSearches } = useStore();
  const { query, setQuery, search, recentSearches: storeRecentSearches } = useSearch();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      search(searchQuery);
      navigate('/search');
    }
  };

  const statsCards = [
    {
      title: '总仓库数',
      value: stats?.totalRepos ?? '-',
      icon: FolderGit2,
      color: 'bg-indigo-500',
    },
    {
      title: '索引文件数',
      value: stats?.totalFiles ?? '-',
      icon: FileText,
      color: 'bg-emerald-500',
    },
    {
      title: '最近搜索',
      value: recentSearches.length || 0,
      icon: Search,
      color: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Search Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">快速搜索</h2>
        <p className="text-indigo-100 mb-6">输入关键词，快速搜索代码库中的内容</p>
        <div className="max-w-2xl">
          <SearchBox
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            placeholder="输入搜索关键词..."
            recentSearches={storeRecentSearches}
          />
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsCards.map((card, index) => (
          <div
            key={card.title}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all duration-200 hover:border-indigo-200 dark:hover:border-indigo-700"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 ${card.color} rounded-xl`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {card.title}
            </h3>
            {isLoading ? (
              <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {card.value}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            快捷操作
          </h3>
          <div className="space-y-3">
            <Link
              to="/repos"
              className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  添加新仓库
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  从本地路径或 Git URL 添加
                </p>
              </div>
            </Link>
            <Link
              to="/search"
              className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  高级搜索
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  按仓库筛选，自定义搜索范围
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Recent Searches */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            最近搜索
          </h3>
          {storeRecentSearches.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">
              暂无搜索记录
            </p>
          ) : (
            <div className="space-y-2">
              {storeRecentSearches.slice(0, 5).map((term, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(term);
                    navigate('/search');
                  }}
                  className="w-full flex items-center gap-3 p-3 text-left bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Search className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-200">
                    {term}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
