import { IpcMain, BrowserWindow } from 'electron';
import { CodeIndexer } from '@codepop/core';

interface IndexingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  repoPath: string;
  startTime: number;
}

const jobs: Map<string, IndexingJob> = new Map();

export function setupIndexingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('indexing-start', async (event, repoPath: string) => {
    const jobId = `job-${Date.now()}`;
    const job: IndexingJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      repoPath,
      startTime: Date.now(),
    };
    jobs.set(jobId, job);

    const sender = event.sender;

    (async () => {
      try {
        job.status = 'running';
        const indexer = new CodeIndexer(repoPath);

        indexer.on('progress', (progress) => {
          job.progress = progress;
          sender.send('indexing-progress', {
            jobId,
            progress,
            status: job.status,
          });
        });

        await indexer.index();

        job.status = 'completed';
        job.progress = 100;
        sender.send('indexing-progress', {
          jobId,
          progress: 100,
          status: 'completed',
        });
      } catch (error) {
        job.status = 'failed';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sender.send('indexing-progress', {
          jobId,
          progress: job.progress,
          status: `failed: ${errorMessage}`,
        });
      }
    })();

    return { jobId };
  });

  ipcMain.handle('indexing-stop', async (_, jobId: string) => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      return {};
    }
    throw new Error('Job not found');
  });

  ipcMain.handle('indexing-status', async (_, jobId: string) => {
    const job = jobs.get(jobId);
    if (job) {
      return {
        status: job.status,
        progress: job.progress,
      };
    }
    throw new Error('Job not found');
  });
}
