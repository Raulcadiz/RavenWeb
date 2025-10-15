export type ChType = 'live' | 'vod' | 'movies' | 'series';
export type ChStatus = 'active' | 'inactive' | 'error';

export interface ChannelInfo {
  title: string;
  group: string;
  logo: string;
  url: string;
  chNumber: number;
  channelType: number;
}

export interface SavedPlaylist {
  name: string;
  lastModified: string;
  size: number;
}