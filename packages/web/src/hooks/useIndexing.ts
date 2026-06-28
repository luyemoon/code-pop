import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRepo } from '../api';
import { useStore } from '../store';

export interface StageProgress {
  stage: string;
  current: number;
  total: number;
  percentage: number;
}

export interface IndexingProgress {
  current: number;
  total: number;
  percentage: number;
}

const STAGE_LABELS: Record<string, string> = {
  scan: '文件扫描',
  symbols: '符号解析',
  embeddings: '向量生成',
  call_graph: '调用图构建',
};

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

  const realTimeUpdate = useStore(
    (state) => state.realTimeUpdates[`repo_${repoId}`] as
      | { progress?: number; stage?: string; stage_progress?: StageProgress; error?: string }
      | undefined
  );

  const isIndexing = repo?.status === 'indexing';

  const progress: IndexingProgress | null = useMemo(() => {
    if (!repo) return null;

    // Prefer live WebSocket data when available.
    if (isIndexing && realTimeUpdate?.progress !== undefined) {
      return {
        current: realTimeUpdate.stage_progress?.current ?? repo.indexedFiles,
        total: realTimeUpdate.stage_progress?.total ?? repo.totalFiles,
        percentage: Math.round(realTimeUpdate.progress),
      };
    }

    return {
      current: repo.indexedFiles,
      total: repo.totalFiles,
      percentage: repo.totalFiles > 0
        ? Math.round((repo.indexedFiles / repo.totalFiles) * 100)
        : 0,
    };
  }, [repo, realTimeUpdate, isIndexing]);

  const stageProgress: StageProgress | null = useMemo(() => {
    if (!isIndexing || !realTimeUpdate?.stage_progress) return null;
    return {
      ...realTimeUpdate.stage_progress,
      stage: realTimeUpdate.stage_progress.stage,
    };
  }, [realTimeUpdate, isIndexing]);

  const currentStageLabel = stageProgress
    ? STAGE_LABELS[stageProgress.stage] ?? stageProgress.stage
    : isIndexing
      ? '索引中'
      : null;

  return {
    repo,
    isIndexing,
    progress,
    stageProgress,
    currentStageLabel,
    error: realTimeUpdate?.error,
    refetch,
  };
};
