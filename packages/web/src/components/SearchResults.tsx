import type { SearchResult } from '../types';
import { CodePreview } from './CodePreview';
import { FileText, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading?: boolean;
}

export const SearchResults = ({ results, isLoading }: SearchResultsProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (result: SearchResult) => {
    const code = result.code;
    await navigator.clipboard.writeText(code);
    setCopiedId(`${result.repoId}-${result.filePath}-${result.lineNumber}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse"
          >
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
            <div className="h-20 bg-slate-100 dark:bg-slate-700/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">
          暂无搜索结果，请尝试其他关键词
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        找到 {results.length} 个匹配结果
      </div>
      {results.map((result, index) => {
        const resultId = `${result.repoId}-${result.filePath}-${result.lineNumber}`;
        const isCopied = copiedId === resultId;

        return (
          <div
            key={index}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  {result.filePath}
                </span>
                <span className="text-slate-400">行 {result.lineNumber}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded">
                  {result.repoName}
                </span>
                <button
                  onClick={() => handleCopy(result)}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors',
                    isCopied
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400'
                  )}
                >
                  {isCopied ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <CodePreview code={result.code} language="typescript" />
          </div>
        );
      })}
    </div>
  );
};
