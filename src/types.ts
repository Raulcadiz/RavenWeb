// Tipos que corresponden a las clases de C#

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
  channelType: number;
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
