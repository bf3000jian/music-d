
import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { Play, Music, Disc, Download, FileText, X, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { getSongCover, getSongUrl, getSongLyrics } from '../services/musicApi';
import { PLACEHOLDER_COVER } from '../constants';

interface SongListProps {
  songs: Song[];
  onPlay: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
}

const isWeChat = () => {
    return /micromessenger/i.test(navigator.userAgent);
};

const SongCard: React.FC<{ 
    song: Song; 
    onPlay: (s: Song) => void; 
    isActive: boolean; 
    isPlaying: boolean;
    onDownload: (s: Song) => void;
    onLyrics: (s: Song) => void;
}> = ({
  song,
  onPlay,
  isActive,
  isPlaying,
  onDownload,
  onLyrics,
}) => {
  const [coverUrl, setCoverUrl] = useState<string>(PLACEHOLDER_COVER);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    getSongCover(song, controller.signal).then(url => {
        if (isMounted) setCoverUrl(url);
    }).catch(e => {
        // Ignore abort errors
        if (e.name !== 'AbortError') console.error('Error fetching cover:', e);
    });

    return () => { 
        isMounted = false; 
        controller.abort(); 
    };
  }, [song]);

  return (
    <div 
      className={`group relative flex items-center p-3 rounded-xl transition-all duration-300 hover:bg-white/10 ${isActive ? 'bg-white/10 border border-purple-500/50' : 'border border-transparent'}`}
    >
      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800 shadow-lg">
        <img 
            src={coverUrl} 
            alt={song.name} 
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_COVER;
            }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-slate-800 -z-10">
            <Music size={24} />
        </div>
        
        <div 
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <button 
            onClick={() => onPlay(song)}
            className="p-2 bg-purple-500 rounded-full text-white shadow-lg hover:bg-purple-400 hover:scale-110 transition-transform"
          >
             {isActive && isPlaying ? (
                 <div className="w-4 h-4 flex gap-0.5 items-end justify-center">
                    <div className="w-1 h-3 bg-white animate-[bounce_1s_infinite]"></div>
                    <div className="w-1 h-4 bg-white animate-[bounce_1.2s_infinite]"></div>
                    <div className="w-1 h-2 bg-white animate-[bounce_0.8s_infinite]"></div>
                 </div>
             ) : (
                 <Play size={16} fill="currentColor" />
             )}
          </button>
        </div>
      </div>

      <div className="ml-4 flex-1 min-w-0 flex flex-col justify-between h-16 py-0.5">
        <div>
            <h3 className={`font-semibold truncate text-sm md:text-base ${isActive ? 'text-purple-400' : 'text-slate-100'}`}>
            {song.name}
            </h3>
            <p className="text-xs md:text-sm text-slate-400 truncate">
            {song.artist.join(', ')}
            </p>
        </div>
        
        <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 flex-shrink-0">
                    {song.source}
                </span>
                {song.album && <span className="text-[10px] text-slate-500 truncate">{song.album}</span>}
            </div>
            
            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onLyrics(song); }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="View Lyrics"
                 >
                     <FileText size={14} />
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onDownload(song); }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Download Song"
                 >
                     <Download size={14} />
                 </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export const SongList: React.FC<SongListProps> = ({ songs, onPlay, currentSong, isPlaying }) => {
  const [lyricsModal, setLyricsModal] = useState<{isOpen: boolean; song: Song | null; text: string; isLoading: boolean}>({
      isOpen: false, song: null, text: '', isLoading: false
  });
  
  const [downloadModal, setDownloadModal] = useState<{isOpen: boolean; song: Song | null; url: string | null; isLoading: boolean; copied: boolean}>({
      isOpen: false, song: null, url: null, isLoading: false, copied: false
  });

  const handleDownload = async (song: Song) => {
      setDownloadModal({ isOpen: true, song, url: null, isLoading: true, copied: false });
      try {
          const url = await getSongUrl(song);
          setDownloadModal(prev => ({ ...prev, url, isLoading: false }));
      } catch (e) {
          console.error("Failed to get download URL", e);
          setDownloadModal(prev => ({ ...prev, isLoading: false }));
      }
  };

  const handleCopyLink = () => {
      if (downloadModal.url) {
          navigator.clipboard.writeText(downloadModal.url);
          setDownloadModal(prev => ({ ...prev, copied: true }));
          setTimeout(() => setDownloadModal(prev => ({ ...prev, copied: false })), 2000);
      }
  };

  const handleLyrics = async (song: Song) => {
      setLyricsModal({ isOpen: true, song, text: '', isLoading: true });
      try {
        const rawLyrics = await getSongLyrics(song);
        const cleanedLyrics = rawLyrics
            .replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, '')
            .replace(/\[.*?\]/g, '')
            .split('\n')
            .filter(line => line.trim() !== '')
            .join('\n');
            
        setLyricsModal(prev => ({ ...prev, text: cleanedLyrics || "No lyrics text found.", isLoading: false }));
      } catch (e) {
        setLyricsModal(prev => ({ ...prev, text: "Failed to load lyrics.", isLoading: false }));
      }
  };

  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Disc size={48} className="mb-4 opacity-50" />
        <p>No songs found. Try a different search.</p>
      </div>
    );
  }

  return (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-32">
        {songs.map((song) => (
            <SongCard 
            key={`${song.source}-${song.id}`} 
            song={song} 
            onPlay={onPlay} 
            isActive={currentSong?.id === song.id && currentSong?.source === song.source}
            isPlaying={isPlaying}
            onDownload={handleDownload}
            onLyrics={handleLyrics}
            />
        ))}
        </div>

        {/* Lyrics Modal */}
        {lyricsModal.isOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{lyricsModal.song?.name}</h3>
                                <p className="text-xs text-slate-400">{lyricsModal.song?.artist.join(', ')}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setLyricsModal(prev => ({ ...prev, isOpen: false }))}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {lyricsModal.isLoading ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                                <Loader2 size={32} className="animate-spin text-purple-500" />
                                <p className="text-sm">Loading lyrics...</p>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                {lyricsModal.text.split('\n').map((line, i) => (
                                    <p key={i} className="text-slate-300 text-lg leading-relaxed">{line}</p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Download Modal */}
        {downloadModal.isOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <Download size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Download Song</h3>
                                <p className="text-xs text-slate-400 max-w-[200px] truncate">{downloadModal.song?.name}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setDownloadModal(prev => ({ ...prev, isOpen: false }))}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6">
                        {downloadModal.isLoading ? (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3">
                                <Loader2 size={32} className="animate-spin text-blue-500" />
                                <p className="text-sm">Fetching download link...</p>
                            </div>
                        ) : !downloadModal.url ? (
                             <div className="text-center py-6">
                                <p className="text-red-400 mb-2">Download Unavailable</p>
                                <p className="text-sm text-slate-500">Could not retrieve a download URL for this song.</p>
                             </div>
                        ) : isWeChat() ? (
                            <div className="text-center space-y-4">
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg text-left">
                                    <p className="text-yellow-200 text-sm font-semibold mb-1 flex items-center gap-2">
                                        <ExternalLink size={14} /> 
                                        WeChat Restrictions
                                    </p>
                                    <p className="text-yellow-200/70 text-xs leading-relaxed">
                                        WeChat does not support direct file downloads. Please click the menu at the top right corner 
                                        <span className="inline-block px-1 mx-1 bg-white/10 rounded">...</span>
                                        and select 
                                        <span className="font-bold text-yellow-100 mx-1">Open in Browser</span>.
                                    </p>
                                </div>
                                
                                <button 
                                    onClick={handleCopyLink}
                                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors border border-white/10"
                                >
                                    {downloadModal.copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                    {downloadModal.copied ? 'Copied to Clipboard' : 'Copy Download Link'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-400 text-center mb-4">
                                    Click the button below to start your download.
                                </p>
                                
                                <a 
                                    href={downloadModal.url}
                                    download={`${downloadModal.song?.name}.mp3`} // Hint filename, though browsers often ignore for cross-origin
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 font-semibold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Download size={18} />
                                    Download MP3
                                </a>

                                <button 
                                    onClick={handleCopyLink}
                                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl flex items-center justify-center gap-2 transition-colors border border-white/5"
                                >
                                    {downloadModal.copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    {downloadModal.copied ? 'Link Copied' : 'Copy Link'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
  );
};
