export interface Song {
  id: string | number;
  name: string;
  artist: string[];
  album?: string;
  pic_id?: string;
  url_id?: string;
  lyric_id?: string;
  source: string;
  cover_url?: string; // Enriched property
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  audioUrl: string | null;
  isLoading: boolean;
}

export type MusicSource = string;

export interface SearchResult {
  songs: Song[];
  hasMore: boolean;
}