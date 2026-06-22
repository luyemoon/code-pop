import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FolderGit2,
  RefreshCw,
  Trash2,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useRepo, useRepos } from '../hooks/useRepos';
import { useIndexing } from '../hooks/useIndexing';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';
import { clsx } from 'clsx';

export const RepoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deleteRepo, reindex, isDeleting, isReindexing } = useRepos();
  const { data: repo, isLoading, error } = useRepo(id!);
  const { isIndexing, progress } = useIndexing(id!);

  const handleDelete = () => {
    if (window.confirm('确定要删除这个仓库吗？')) {
      deleteRepo(id!);
      navigate('/repos');
    }
  };

  const handleReindex = () => {
    reindex(id!);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !repo) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          仓库不存在
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          无法找到该仓库，可能已被删除
        </p>
        <button
          onClick={() => navigate('/repos')}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
        >
          返回仓库列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Button */}
      <button
        onClick={() => navigate('/repos')}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        返回仓库列表
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <FolderGit2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {repo.name}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                {repo.path}
              </p>
            </div>
          </div>
          <StatusBadge status={repo.status} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <FileText className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">索引文件</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {repo.indexedFiles} / {repo.totalFiles}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <Clock className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">创建时间</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {new Date(repo.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <RefreshCw className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">最后索引</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {repo.lastIndexedAt
                  ? new Date(repo.lastIndexedAt).toLocaleDateString()
                  : '-'}
              </p>
            </div>
          </div>
          <div>
            {repo.gitUrl && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Git URL</p>
                <p className="font-semibold text-slate-900 dark:text-white truncate">
                  {repo.gitUrl}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Indexing Progress */}
      {(isIndexing || repo.status === 'indexing') && progress && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            索引进度
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
              {progress.percentage}%
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            正在索引: {progress.current} / {progress.total} 个文件
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReindex}
          disabled={isReindexing || repo.status === 'indexing'}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors',
            isReindexing || repo.status === 'indexing'
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-500 hover:bg-indigo-600 text-white'
          )}
        >
          <RefreshCw className={clsx('w-5 h-5', isReindexing && 'animate-spin')} />
          重新索引
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors"
        >
          <Trash2 className="w-5 h-5" />
          删除仓库
        </button>
      </div>
    </div>
  );
};
