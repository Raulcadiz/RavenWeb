import axios from 'axios';

// Detectar la IP correcta automáticamente
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  
  // Si es localhost, usar localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5199/api';
  }
  
  // Si es una IP de red, usar esa IP
  return `http://${hostname}:5199/api`;
};

const API_BASE_URL = getApiBaseUrl();

console.log('🌐 Detected hostname:', window.location.hostname);
console.log('🌐 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos timeout
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================
// TIPOS
// ============================================

export enum ChType {
  Channel = 0,
  Movie = 1,
  Show = 2
}

export enum ChStatus {
  NotInit = 0,
  Initializing = 1,
  Initialize = 2,
  Timeout = 3,
  Unknown = 4
}

export interface SeenInfo {
  seen: boolean;
  currentPosition: number;
  historyDate: string;
}

export interface ChannelInfo {
  title: string;
  group: string;
  logo: string;
  url: string;
  chNumber: number;
  channelType: ChType;
}

export interface SeenResumeChannel {
  title: string;
  position: number;
  totalDuration: number;
  seen: boolean;
  date: string;
}

export interface InitializeRequest {
  playlistUrl: string;
  name?: string;
  logoListUri?: string;
  loadCache?: boolean;
}

export interface ApiError {
  error: string;
  code?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SavedPlaylist {
  name: string;
  lastModified: string;
  size: number;
}

// ============================================
// ADAPTADOR DE DATOS (Backend en español)
// ============================================

// Interfaz para los datos que vienen del backend en español
interface ChannelInfoBackend {
  title?: string;
  titulo?: string;
  group?: string;
  grupo?: string;
  logo?: string;
  logotipo?: string;
  url?: string;
  chNumber?: number;
  'número de canal'?: number;
  channelType?: number;
  'tipo de canal'?: number;
  seenInfoCh?: any;
  totalDuration?: any;
  'duración total'?: any;
}

interface PaginatedResponseBackend<T> {
  items?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

// Función para normalizar los datos del backend
function normalizeChannel(channel: ChannelInfoBackend): ChannelInfo {
  return {
    title: channel.title || channel.titulo || '',
    group: channel.group || channel.grupo || 'Sin grupo',
    logo: channel.logo || channel.logotipo || '',
    url: channel.url || '',
    chNumber: channel.chNumber ?? channel['número de canal'] ?? 0,
    channelType: (channel.channelType ?? channel['tipo de canal'] ?? 0) as ChType,
  };
}

function normalizePaginatedResponse<T, R>(
  response: PaginatedResponseBackend<T>,
  normalizer: (item: T) => R
): PaginatedResponse<R> {
  return {
    items: (response.items || []).map(normalizer),
    total: response.total || 0,
    page: response.page || 1,
    pageSize: response.pageSize || 50,
    totalPages: response.totalPages || 1,
  };
}

// ============================================
// API ENDPOINTS
// ============================================

export const parserApi = {
  async initialize(request: InitializeRequest) {
    console.log('🚀 Initializing parser with:', request);
    const response = await api.post('/parser/initialize', request);
    console.log('✅ Parser initialized:', response.data);
    return response.data;
  },

  async process() {
    console.log('⚙️ Processing playlist...');
    const response = await api.post('/parser/process');
    console.log('✅ Playlist processed:', response.data);
    return response.data;
  },

  async getStatus(): Promise<{ status: string }> {
    const response = await api.get('/parser/status');
    console.log('📊 Parser status:', response.data);
    return response.data;
  },
};

export const channelsApi = {
  async getAll(
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    group?: string
  ): Promise<PaginatedResponse<ChannelInfo>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (search) params.append('search', search);
    if (group && group !== 'all') params.append('group', group);

    console.log('📡 Fetching channels:', params.toString());
    const response = await api.get(`/channels?${params}`);
    console.log('📦 Raw response:', response.data);
    
    const normalized = normalizePaginatedResponse(
      response.data,
      normalizeChannel
    );
    console.log('✨ Normalized channels:', normalized);
    
    return normalized;
  },

  async getLive(
    page: number = 1,
    pageSize: number = 50,
    search?: string
  ): Promise<PaginatedResponse<ChannelInfo>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (search) params.append('search', search);

    console.log('📡 Fetching live channels:', params.toString());
    const response = await api.get(`/channels/live?${params}`);
    
    const normalized = normalizePaginatedResponse(
      response.data,
      normalizeChannel
    );
    console.log('✨ Normalized live channels:', normalized);
    
    return normalized;
  },

  async getVod(
    page: number = 1,
    pageSize: number = 50,
    search?: string
  ): Promise<PaginatedResponse<ChannelInfo>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (search) params.append('search', search);

    console.log('📡 Fetching VOD channels:', params.toString());
    const response = await api.get(`/channels/vod?${params}`);
    
    const normalized = normalizePaginatedResponse(
      response.data,
      normalizeChannel
    );
    console.log('✨ Normalized VOD channels:', normalized);
    
    return normalized;
  },

  async getMovies(
    page: number = 1,
    pageSize: number = 50,
    search?: string
  ): Promise<PaginatedResponse<ChannelInfo>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (search) params.append('search', search);

    console.log('📡 Fetching movies:', params.toString());
    const response = await api.get(`/channels/movies?${params}`);
    
    const normalized = normalizePaginatedResponse(
      response.data,
      normalizeChannel
    );
    console.log('✨ Normalized movies:', normalized);
    
    return normalized;
  },

  async getByNumber(channelNumber: number): Promise<ChannelInfo> {
    console.log('📡 Fetching channel by number:', channelNumber);
    const response = await api.get(`/channels/${channelNumber}`);
    const normalized = normalizeChannel(response.data);
    console.log('✨ Normalized channel:', normalized);
    return normalized;
  },

  async updateProgress(channelNumber: number, seen: boolean, currentPosition: number) {
    console.log('📝 Updating progress:', { channelNumber, seen, currentPosition });
    const response = await api.put(`/channels/${channelNumber}/progress`, {
      seen,
      currentPosition,
    });
    console.log('✅ Progress updated:', response.data);
    return response.data;
  },
};

export const groupsApi = {
  async getAll(): Promise<string[]> {
    console.log('📡 Fetching groups...');
    const response = await api.get('/groups');
    console.log('📦 Groups received:', response.data);
    return response.data;
  },

  async getChannels(groupName: string): Promise<ChannelInfo[]> {
    console.log('📡 Fetching channels for group:', groupName);
    const response = await api.get(`/groups/${encodeURIComponent(groupName)}/channels`);
    const normalized = response.data.map(normalizeChannel);
    console.log('✨ Normalized group channels:', normalized);
    return normalized;
  },
};

export const historyApi = {
  async get(): Promise<SeenResumeChannel[]> {
    console.log('📡 Fetching history...');
    const response = await api.get('/history');
    console.log('📦 History received:', response.data);
    return response.data;
  },
};

export const playlistsApi = {
  async getSaved(): Promise<SavedPlaylist[]> {
    console.log('📡 Fetching saved playlists...');
    const response = await api.get('/playlists');
    console.log('📦 Playlists received:', response.data);
    return response.data;
  },

  async load(name: string) {
    console.log('📥 Loading playlist:', name);
    const response = await api.post(`/playlists/${encodeURIComponent(name)}/load`);
    console.log('✅ Playlist loaded:', response.data);
    return response.data;
  },

  async delete(name: string) {
    console.log('🗑️ Deleting playlist:', name);
    const response = await api.delete(`/playlists/${encodeURIComponent(name)}`);
    console.log('✅ Playlist deleted:', response.data);
    return response.data;
  },
};