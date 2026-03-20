import { MUSIC_API_BASE, PLACEHOLDER_COVER, RESULTS_LIMIT } from '../constants';
import { SearchResult, Song } from '../types';
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

const SEARCH_FETCH_LIMIT = 50;
const searchCache = new Map<string, Song[]>();

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

const getSearchCacheKey = (query: string, source: string) => `${source}::${query.trim().toLowerCase()}`;

const normalizeSongs = (items: RawSong[], source: string): Song[] => {
    const seen = new Set<string>();

    return items.reduce<Song[]>((songs, item) => {
        const normalizedSong: Song = {
            ...item,
            source,
            id: item.id,
            pic_id: item.pic_id,
            url_id: item.url_id,
            lyric_id: item.lyric_id,
        };

        const key = `${normalizedSong.source}-${normalizedSong.id}`;
        if (seen.has(key)) {
            return songs;
        }

        seen.add(key);
        songs.push(normalizedSong);
        return songs;
    }, []);
};

const paginateSongs = (songs: Song[], page: number): SearchResult => {
    const startIndex = Math.max(0, (page - 1) * RESULTS_LIMIT);
    const endIndex = startIndex + RESULTS_LIMIT;

    return {
        songs: songs.slice(startIndex, endIndex),
        hasMore: endIndex < songs.length,
    };
};

const fetchSearchResults = async (
    query: string,
    source: string,
    signal?: AbortSignal
): Promise<Song[]> => {
    const params = new URLSearchParams({
        types: 'search',
        count: SEARCH_FETCH_LIMIT.toString(),
        source,
        pages: '1',
        name: query,
    });

    const response = await fetch(`${MUSIC_API_BASE}?${params.toString()}`, {
        method: 'GET',
        signal,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await safeJsonParse(response);
    if (!data || !Array.isArray(data)) {
        return [];
    }

    return normalizeSongs(data, source);
};

export const searchMusic = async (
  query: string,
  source: string,
  page: number = 1,
  signal?: AbortSignal
): Promise<SearchResult> => {
  const cacheKey = getSearchCacheKey(query, source);

  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  if (page > 1 && searchCache.has(cacheKey)) {
    return paginateSongs(searchCache.get(cacheKey) || [], page);
  }

  return rateLimiter.schedule(async () => {
      try {
        const allSongs = await fetchSearchResults(query, source, signal);
        searchCache.set(cacheKey, allSongs);
        return paginateSongs(allSongs, page);
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        console.error('Search failed:', error);
        searchCache.set(cacheKey, []);
        return { songs: [], hasMore: false };
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
    if (signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    const coverId = `${song.pic_id || song.id || ''}`.trim();
    if (!coverId) {
        return PLACEHOLDER_COVER;
    }

    if (/^https?:\/\//i.test(coverId)) {
        return coverId;
    }

    if (song.source === 'joox') {
        return `https://image.joox.com/JOOXcover/0/${encodeURIComponent(coverId)}/300`;
    }

    return PLACEHOLDER_COVER;
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
