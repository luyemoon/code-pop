import React from 'react';

interface SearchResult {
  id: number;
  path: string;
  content: string;
  score: number;
}

export const QuickSearch: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electron.hideQuickSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        openResult(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await window.electron.search.query(query);
      setResults(searchResults as SearchResult[]);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openResult = (result: SearchResult) => {
    window.electron.hideQuickSearch();
    // The main window will handle opening the file
  };

  return (
    <div className="quick-search-container">
      <form onSubmit={handleSearch} className="quick-search-form">
        <input
          ref={searchRef}
          type="text"
          className="quick-search-input"
          placeholder="搜索代码... (⌘⇧C)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </form>

      <div className="quick-search-results">
        {isLoading ? (
          <div className="quick-search-loading">搜索中...</div>
        ) : results.length > 0 ? (
          <ul className="quick-search-list">
            {results.slice(0, 10).map((result, index) => (
              <li
                key={result.id}
                className={`quick-search-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => openResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="item-path">{result.path}</div>
                <div className="item-content">{result.content}</div>
              </li>
            ))}
          </ul>
        ) : query ? (
          <div className="quick-search-empty">未找到结果</div>
        ) : null}
      </div>

      <div className="quick-search-footer">
        <span className="hint">↑↓ 选择</span>
        <span className="hint">↵ 打开</span>
        <span className="hint">Esc 关闭</span>
      </div>
    </div>
  );
};
