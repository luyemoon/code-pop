import { IpcMain } from 'electron';
import { CodeSearchService } from '@codepop/core';

let searchService: CodeSearchService | null = null;

function getSearchService(): CodeSearchService {
  if (!searchService) {
    searchService = new CodeSearchService();
  }
  return searchService;
}

export function setupSearchHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('search-query', async (_, searchText: string, options?: Record<string, unknown>) => {
    try {
      const service = getSearchService();
      const results = await service.search(searchText, options);
      return results;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  });

  ipcMain.handle('search-in-file', async (_, filePath: string, searchText: string) => {
    try {
      const service = getSearchService();
      const results = await service.searchInFile(filePath, searchText);
      return results;
    } catch (error) {
      console.error('Search in file error:', error);
      throw error;
    }
  });
}
