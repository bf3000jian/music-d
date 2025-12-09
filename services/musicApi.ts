import { MUSIC_API_BASE, PLACEHOLDER_COVER, RESULTS_LIMIT } from '../constants';
import { Song, MusicSource } from '../types';
import { rateLimiter } from './rateLimiter';

interface RawSong {
  id: any;
  name: string;
  artist: string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  source: string;
}

const safeJsonParse = async (response: Response) => {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
};

export const searchMusic = async (
  query: string,
  source: string,
  page: number = 1,
  signal?: AbortSignal
): Promise<Song[]> => {
  return rateLimiter.schedule(async () => {
      try {
        const params = new URLSearchParams({
          types: 'search',
          count: RESULTS_LIMIT.toString(),
          source: source,
          pages: page.toString(),
          name: query,
        });

        const response = await fetch(`${MUSIC_API_BASE}?${params.toString()}`, {
          method: 'GET',
          signal
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await safeJsonParse(response);
        
        if (!data || !Array.isArray(data)) {
            return [];
        }

        // Explicitly slice the results to enforce the limit, as some API sources might return more
        return data.map((item: RawSong) => ({
          ...item,
          source: source,
          id: item.id,
          pic_id: item.pic_id,
          url_id: item.url_id,
          lyric_id: item.lyric_id
        })).slice(0, RESULTS_LIMIT);
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        console.error('Search failed:', error);
        return [];
      }
  }, signal);
};

export const getSongUrl = async (song: Song, signal?: AbortSignal): Promise<string | null> => {
    const fetchUrl = async (id: string | number) => {
        return rateLimiter.schedule(async () => {
            const params = new URLSearchParams({
                types: 'url',
                id: id.toString(),
                source: song.source,
            });

            try {
                const response = await fetch(`${MUSIC_API_BASE}?${params.toString()}`, { signal });
                if (!response.ok) return null;
                
                const data = await safeJsonParse(response);
                if (data && data.url) {
                    return data.url;
                }
            } catch (e) {
                // Ignore errors
            }
            return null;
        }, signal);
    };

    if (song.url_id) {
        const url = await fetchUrl(song.url_id);
        if (url) return url;
    }

    if (song.id) {
        const url = await fetchUrl(song.id);
        if (url) return url;
    }

    return null;
};

export const getSongCover = async (song: Song, signal?: AbortSignal): Promise<string> => {
    const idToUse = song.pic_id || song.id;
    const params = new URLSearchParams({
        types: 'pic',
        id: idToUse.toString(),
        source: song.source,
    });
    
    const url = `${MUSIC_API_BASE}?${params.toString()}`;
    
    return rateLimiter.schedule(async () => {
        try {
            const response = await fetch(url, { signal });
            if (!response.ok) return PLACEHOLDER_COVER;
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                return data.url || PLACEHOLDER_COVER;
            }
            
            return response.url;
        } catch (error) {
            return PLACEHOLDER_COVER;
        }
    }, signal);
};

export const getSongLyrics = async (song: Song, signal?: AbortSignal): Promise<string> => {
    const idToUse = song.lyric_id || song.id;
    const params = new URLSearchParams({
        types: 'lyric',
        id: idToUse.toString(),
        source: song.source,
    });

    return rateLimiter.schedule(async () => {
        try {
            const response = await fetch(`${MUSIC_API_BASE}?${params.toString()}`, { signal });

            if (!response.ok) return "Lyrics not available.";
            
            const data = await safeJsonParse(response);
            let lyric = "";
            if (data?.lrc?.lyric) {
                lyric = data.lrc.lyric;
            } else if (data?.lyric) {
                lyric = data.lyric;
            }
            
            return lyric || "Lyrics not found.";
        } catch (e) {
            console.error("Error fetching lyrics", e);
            return "Failed to load lyrics.";
        }
    }, signal);
};