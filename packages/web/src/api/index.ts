import axios from 'axios';
import type { Repo, SearchResult, Stats, AddRepoForm } from '../types';

const DEFAULT_API_ENDPOINT = 'http://localhost:8080/api/v1';

const getApiEndpoint = () => {
  return localStorage.getItem('codepop-api-endpoint') || DEFAULT_API_ENDPOINT;
};

const apiClient = axios.create({
  baseURL: getApiEndpoint(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Repository APIs
export const fetchRepos = async (): Promise<Repo[]> => {
  const response = await apiClient.get('/repos');
  return response.data.repos;
};

export const fetchRepo = async (id: string): Promise<Repo> => {
  const response = await apiClient.get(`/repos/${id}`);
  return response.data.repo;
};

export const addRepo = async (data: AddRepoForm): Promise<Repo> => {
  const response = await apiClient.post('/repos', data);
  return response.data.repo;
};

export const deleteRepo = async (id: string): Promise<void> => {
  await apiClient.delete(`/repos/${id}`);
};

export const reindexRepo = async (id: string): Promise<void> => {
  await apiClient.post(`/repos/${id}/reindex`);
};

// Search APIs
export const searchCode = async (query: string, repoId?: string): Promise<SearchResult[]> => {
  const response = await apiClient.post('/search', { query, repoId });
  return response.data.results;
};

// Stats APIs
export const fetchStats = async (): Promise<Stats> => {
  const response = await apiClient.get('/stats');
  return response.data;
};

export default apiClient;
