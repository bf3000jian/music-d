
import React, { useRef, useEffect, useState } from 'react';
import { PlayerState, Song } from '../types';
import { getSongUrl, getSongCover } from '../services/musicApi';
import { PLACEHOLDER_COVER } from '../constants';
import { Play, Pause, Volume2, SkipBack, SkipForward, Loader2 } from 'lucide-react';

interface PlayerProps {
  currentSong: Song | null;
  onNext?: () => void;
  onPrev?: () => void;
}

export const Player: React.FC<PlayerProps> = ({ currentSong, onNext, onPrev }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    volume: 0.7,
    progress: 0,
    duration: 0,
    audioUrl: null,
    isLoading: false,
  });
  const [coverUrl, setCoverUrl] = useState<string>(PLACEHOLDER_COVER);

  // Sync volume whenever it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playerState.volume;
    }
  }, [playerState.volume]);

  // Handle song change
  useEffect(() => {
    if (!currentSong) return;

    const controller = new AbortController();
    let isActive = true;

    const loadSong = async () => {
      // Pause immediately when switching songs
      if (audioRef.current) {
        audioRef.current.pause();
      }

      setPlayerState(prev => ({ 
        ...prev, 
        isLoading: true, 
        currentSong,
        isPlaying: false, // Reset playing state
        progress: 0,
        duration: 0
      }));
      setCoverUrl(PLACEHOLDER_COVER);
      
      try {
        // Fetch Cover (non-blocking) with cancel signal
        getSongCover(currentSong, controller.signal).then(url => {
            if (isActive) setCoverUrl(url);
        }).catch(() => {});

        // Fetch Audio URL with cancel signal
        const url = await getSongUrl(currentSong, controller.signal);

        if (isActive) {
          if (url) {
            setPlayerState(prev => ({ 
                ...prev, 
                audioUrl: url, 
                isLoading: false 
            }));
            
            // Setup audio element and attempt play
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.load(); // Explicitly load the new source
                
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            if (isActive) setPlayerState(prev => ({ ...prev, isPlaying: true }));
                        })
                        .catch(error => {
                            // This catches "Autoplay blocked" errors
                            if (error.name !== 'AbortError') {
                                console.warn("Autoplay blocked or playback failed:", error);
                            }
                            if (isActive) setPlayerState(prev => ({ ...prev, isPlaying: false }));
                        });
                }
            }
          } else {
             console.error("No URL found for song");
             setPlayerState(prev => ({ ...prev, isLoading: false }));
             // Optionally trigger onNext here if you want to skip invalid songs automatically
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
            console.error("Error loading song", error);
        }
        if (isActive) setPlayerState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadSong();

    return () => { 
        isActive = false; 
        controller.abort();
    };
  }, [currentSong]);

  const togglePlay = () => {
    if (!audioRef.current || !playerState.audioUrl) return;
    
    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
          playPromise
            .then(() => setPlayerState(prev => ({ ...prev, isPlaying: true })))
            .catch(e => {
                console.error("Play failed:", e);
                setPlayerState(prev => ({ ...prev, isPlaying: false }));
            });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const duration = audioRef.current.duration;
      const currentTime = audioRef.current.currentTime;
      setPlayerState(prev => ({
        ...prev,
        progress: currentTime,
        duration: isNaN(duration) ? 0 : duration,
      }));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setPlayerState(prev => ({ ...prev, progress: time }));
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      // Don't report error if it was just an abort/empty src during transition
      if (audioRef.current && audioRef.current.src) {
           console.error("Audio playback error:", e.currentTarget.error);
      }
      setPlayerState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 p-4 z-50 animate-slide-up text-white">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onNext}
        onPause={() => setPlayerState(prev => ({ ...prev, isPlaying: false }))}
        onPlay={() => setPlayerState(prev => ({ ...prev, isPlaying: true }))}
        onError={handleAudioError}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4">
        
        {/* Track Info */}
        <div className="flex items-center gap-4 w-full md:w-1/4">
          <div className="relative">
            <div className={`w-14 h-14 rounded-md overflow-hidden bg-slate-800 ${playerState.isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`}>
                 <img 
                    src={coverUrl} 
                    alt="Cover" 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_COVER; }}
                 />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
             <div className="font-semibold truncate">{currentSong.name}</div>
             <div className="text-xs text-slate-400 truncate">{currentSong.artist.join(', ')}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center w-full md:w-2/4 gap-2">
           <div className="flex items-center gap-6">
              <button onClick={onPrev} className="text-slate-400 hover:text-white transition-colors">
                 <SkipBack size={20} />
              </button>
              
              <button 
                onClick={togglePlay}
                disabled={playerState.isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-900 hover:scale-105 transition-transform disabled:opacity-50"
              >
                {playerState.isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : playerState.isPlaying ? (
                    <Pause size={20} fill="currentColor" />
                ) : (
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              <button onClick={onNext} className="text-slate-400 hover:text-white transition-colors">
                 <SkipForward size={20} />
              </button>
           </div>

           <div className="w-full flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span>{formatTime(playerState.progress)}</span>
              <input 
                type="range" 
                min={0} 
                max={playerState.duration || 100} 
                value={playerState.progress}
                onChange={handleSeek}
                className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
              <span>{formatTime(playerState.duration)}</span>
           </div>
        </div>

        {/* Volume */}
        <div className="hidden md:flex items-center gap-2 w-1/4 justify-end">
            <Volume2 size={16} className="text-slate-400" />
            <input 
               type="range"
               min={0}
               max={1}
               step={0.05}
               value={playerState.volume}
               onChange={(e) => {
                   const val = parseFloat(e.target.value);
                   setPlayerState(prev => ({ ...prev, volume: val }));
               }}
               className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-400 hover:[&::-webkit-slider-thumb]:bg-white"
            />
        </div>

      </div>
    </div>
  );
};
