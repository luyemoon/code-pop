import { IpcMain, BrowserWindow } from 'electron';

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
        
        // Simulate indexing progress
        for (let i = 0; i <= 100; i += 10) {
          job.progress = i;
          sender.send('indexing-progress', {
            jobId,
            progress: i,
            status: 'running',
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        }

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
