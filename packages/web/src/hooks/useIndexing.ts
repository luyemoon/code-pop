import { useQuery } from '@tanstack/react-query';
import { fetchRepo } from '../api';

export const useIndexing = (repoId: string) => {
  const { data: repo, refetch } = useQuery({
    queryKey: ['repo', repoId, 'indexing'],
    queryFn: () => fetchRepo(repoId),
    enabled: !!repoId,
    refetchInterval: (query) => {
      const repo = query.state.data;
      if (repo?.status === 'indexing') {
        return 2000; // Poll every 2 seconds while indexing
      }
      return false;
    },
  });

  return {
    repo,
    isIndexing: repo?.status === 'indexing',
    progress: repo
      ? {
          current: repo.indexedFiles,
          total: repo.totalFiles,
          percentage: repo.totalFiles > 0
            ? Math.round((repo.indexedFiles / repo.totalFiles) * 100)
            : 0,
        }
      : null,
    refetch,
  };
};
