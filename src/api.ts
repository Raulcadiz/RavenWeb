import { ChannelInfo, SavedPlaylist } from './types';

// Replace enums with type unions
export type ChType = 'live' | 'vod' | 'movies' | 'series';
export type ChStatus = 'active' | 'inactive' | 'error';

// Placeholder for API functions (adjust based on your actual implementation)
export const parserApi = {
  initialize: async (config: { playlistUrl: string; name: string; loadCache: boolean }) => {
    // Implementation
  },
  process: async () => {
    // Implementation
  },
};

export const channelsApi = {
  getAll: async (page: number, pageSize: number, searchTerm: string, group: string) => ({
    items: [] as ChannelInfo[],
    totalPages: 1,
  }),
  getLive: async (page: number, pageSize: number, searchTerm: string) => ({
    items: [] as ChannelInfo[],
    totalPages: 1,
  }),
  getVod: async (page: number, pageSize: number, searchTerm: string) => ({
    items: [] as ChannelInfo[],
    totalPages: 1,
  }),
  getMovies: async (page: number, pageSize: number, searchTerm: string) => ({
    items: [] as ChannelInfo[],
    totalPages: 1,
  }),
};

export const groupsApi = {
  getAll: async () => [] as string[],
};

export const playlistsApi = {
  getSaved: async () => [] as SavedPlaylist[],
  load: async (name: string) => {
    // Implementation
  },
  delete: async (name: string) => {
    // Implementation
  },
};