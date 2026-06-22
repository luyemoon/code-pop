import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRepos, fetchRepo, addRepo, deleteRepo, reindexRepo } from '../api';
import { useStore } from '../store';
import type { AddRepoForm } from '../types';

export const useRepos = () => {
  const queryClient = useQueryClient();
  const { repos, setRepos, addRepo: addRepoToStore, removeRepo } = useStore();

  const reposQuery = useQuery({
    queryKey: ['repos'],
    queryFn: fetchRepos,
    initialData: repos,
  });

  const addRepoMutation = useMutation({
    mutationFn: (data: AddRepoForm) => addRepo(data),
    onSuccess: (newRepo) => {
      addRepoToStore(newRepo);
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });

  const deleteRepoMutation = useMutation({
    mutationFn: (id: string) => deleteRepo(id),
    onSuccess: (_, id) => {
      removeRepo(id);
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: (id: string) => reindexRepo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });

  return {
    repos: reposQuery.data || repos,
    isLoading: reposQuery.isLoading,
    error: reposQuery.error,
    refetch: reposQuery.refetch,
    addRepo: addRepoMutation.mutate,
    deleteRepo: deleteRepoMutation.mutate,
    reindex: reindexMutation.mutate,
    isAdding: addRepoMutation.isPending,
    isDeleting: deleteRepoMutation.isPending,
    isReindexing: reindexMutation.isPending,
  };
};

export const useRepo = (id: string) => {
  const { repos } = useStore();
  const localRepo = repos.find((r) => r.id === id);

  return useQuery({
    queryKey: ['repo', id],
    queryFn: () => fetchRepo(id),
    initialData: localRepo,
    enabled: !!id,
  });
};
