import { useState } from 'react';
import { SearchBox } from '../components/SearchBox';
import { SearchResults } from '../components/SearchResults';
import { useSearch } from '../hooks/useSearch';
import { useRepos } from '../hooks/useRepos';
import { Filter } from 'lucide-react';

export const Search = () => {
  const { repos } = useRepos();
  const { query, setQuery, results, isSearching, search, clearResults, recentSearches } =
    useSearch();
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      search(searchQuery, selectedRepoId || undefined);
    }
  };

  const handleRepoFilter = (repoId: string) => {
    setSelectedRepoId(repoId);
    if (query.trim()) {
      search(query, repoId || undefined);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Search Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          代码搜索
        </h2>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchBox
              value={query}
              onChange={setQuery}
              onSearch={handleSearch}
              placeholder="输入搜索关键词，支持自然语言..."
              isSearching={isSearching}
              recentSearches={recentSearches}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={selectedRepoId}
              onChange={(e) => handleRepoFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
            >
              <option value="">所有仓库</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <SearchResults results={results} isLoading={isSearching} />

      {/* Search Tips */}
      {results.length === 0 && !isSearching && !query && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
            搜索提示
          </h3>
          <ul className="space-y-3 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-indigo-500">•</span>
              <span>输入代码片段或自然语言描述进行搜索</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500">•</span>
              <span>使用仓库筛选器缩小搜索范围</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500">•</span>
              <span>点击结果中的复制按钮快速复制代码</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
