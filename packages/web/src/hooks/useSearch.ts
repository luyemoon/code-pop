import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { searchCode } from '../api';
import { useStore } from '../store';

export const useSearch = () => {
  const [query, setQuery] = useState('');
  const { searchResults, setSearchResults, recentSearches, addRecentSearch } = useStore();

  const searchMutation = useMutation({
    mutationFn: ({ query, repoId }: { query: string; repoId?: string }) =>
      searchCode(query, repoId),
    onSuccess: (results) => {
      setSearchResults(results);
      if (query.trim()) {
        addRecentSearch(query);
      }
    },
  });

  const search = useCallback(
    (searchQuery: string, repoId?: string) => {
      setQuery(searchQuery);
      searchMutation.mutate({ query: searchQuery, repoId });
    },
    [searchMutation]
  );

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setQuery('');
  }, [setSearchResults]);

  return {
    query,
    setQuery,
    results: searchResults,
    isSearching: searchMutation.isPending,
    error: searchMutation.error,
    search,
    clearResults,
    recentSearches,
  };
};
