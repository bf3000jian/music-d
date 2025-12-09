import React, { useState, useRef } from 'react';
import { Song } from './types';
import { searchMusic } from './services/musicApi';
import { getSmartSearchTerms } from './services/geminiService';
import { SongList } from './components/SongList';
import { Player } from './components/Player';
import { RateLimitIndicator } from './components/RateLimitIndicator';
import { SOURCES, DEFAULT_SOURCE, SUPPORTED_SOURCES, RESULTS_LIMIT } from './constants';
import { Search, Sparkles, Loader2, Music2, Plus, X, Check, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeSource, setActiveSource] = useState<string>(DEFAULT_SOURCE);
  const [availableSources, setAvailableSources] = useState<{label: string, value: string}[]>(SOURCES);
  const [showAddSource, setShowAddSource] = useState(false);

  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  
  // Search State
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Track parameters of the current song list to ensure Load More uses consistent params
  const [executedQuery, setExecutedQuery] = useState('');
  const [executedSource, setExecutedSource] = useState('');

  // Keep track of the current search request to cancel it if a new one starts
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || query;
    if (!q.trim()) return;

    // Abort previous search if running
    if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    setIsLoading(true);
    setSearchTriggered(true);
    setSongs([]);
    setAiSuggestions([]);
    
    // Reset Pagination
    setPage(1);
    setHasMore(false);
    
    // Capture search context
    setExecutedSource(activeSource);
    setExecutedQuery(q);

    try {
      if (isAiMode && !overrideQuery) {
        // AI Vibe Search
        const suggestions = await getSmartSearchTerms(q);
        if (controller.signal.aborted) return;

        setAiSuggestions(suggestions);
        // Automatically search for the first suggestion
        if (suggestions.length > 0) {
           const firstSuggestion = suggestions[0];
           setExecutedQuery(firstSuggestion); // Update executed query to the actual term used
           const results = await searchMusic(firstSuggestion, activeSource, 1, controller.signal);
           setSongs(results);
           setHasMore(results.length === RESULTS_LIMIT);
        }
      } else {
        // Direct Search
        const results = await searchMusic(q, activeSource, 1, controller.signal);
        setSongs(results);
        setHasMore(results.length === RESULTS_LIMIT);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
          console.error(error);
      }
    } finally {
      if (!controller.signal.aborted) {
         setIsLoading(false);
      }
    }
  };

  const handleLoadMore = async () => {
      if (isLoadingMore || !hasMore) return;
      
      setIsLoadingMore(true);
      const nextPage = page + 1;

      try {
          // Use executedQuery and executedSource to ensure continuity
          const newSongs = await searchMusic(executedQuery, executedSource, nextPage);
          
          setSongs(prev => [...prev, ...newSongs]);
          setPage(nextPage);
          setHasMore(newSongs.length === RESULTS_LIMIT);
      } catch (e) {
          console.error("Failed to load more songs", e);
      } finally {
          setIsLoadingMore(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
      setQuery(suggestion);
      handleSearch(suggestion);
  };

  const playSong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const playNext = () => {
     if (!currentSong || songs.length === 0) return;
     const currentIndex = songs.findIndex(s => s.id === currentSong.id);
     const nextIndex = (currentIndex + 1) % songs.length;
     playSong(songs[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(songs[prevIndex]);
  };

  const handleAddSource = (sourceValue: string) => {
      const sourceObj = SUPPORTED_SOURCES.find(s => s.value === sourceValue);
      if (sourceObj && !availableSources.find(s => s.value === sourceValue)) {
          setAvailableSources([...availableSources, sourceObj]);
          setActiveSource(sourceValue);
          setShowAddSource(false);
      }
  };

  const handleRemoveSource = (e: React.MouseEvent, valueToRemove: string) => {
      e.stopPropagation();
      if (availableSources.length <= 1) return; 
      
      const newSources = availableSources.filter(s => s.value !== valueToRemove);
      setAvailableSources(newSources);
      
      if (activeSource === valueToRemove) {
          setActiveSource(newSources[0].value);
      }
  };

  // Get list of sources that are NOT yet added
  const unaddedSources = SUPPORTED_SOURCES.filter(
      s => !availableSources.some(added => added.value === s.value)
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center">
      {/* Background Gradient Mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[100px]" />
      </div>

      <RateLimitIndicator />

      <main className="w-full max-w-6xl px-4 py-8 relative z-10 flex-1 flex flex-col">
        
        {/* Header */}
        <header className="mb-10 text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg shadow-purple-500/20">
                    <Music2 size={32} className="text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
                    MuseAI
                </h1>
            </div>
            <p className="text-slate-400">Smart music discovery powered by Gemini</p>
        </header>

        {/* Search & Controls */}
        <div className="w-full max-w-2xl mx-auto space-y-6 mb-12">
            
            {/* Source Tabs */}
            <div className="flex flex-wrap justify-center items-center gap-2 p-1 bg-slate-800/50 backdrop-blur-sm rounded-full w-fit mx-auto border border-white/5 transition-all relative z-20">
                {availableSources.map(source => (
                    <div
                        key={source.value}
                        onClick={() => setActiveSource(source.value)}
                        className={`group relative px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer flex items-center gap-2 ${
                            activeSource === source.value 
                            ? 'bg-slate-700 text-white shadow-sm pr-2' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {source.label}
                        {/* Only show remove button for non-default sources or if multiple sources exist */}
                        {availableSources.length > 1 && (
                            <button
                                onClick={(e) => handleRemoveSource(e, source.value)}
                                className={`p-0.5 rounded-full hover:bg-slate-600 transition-colors ${
                                    activeSource === source.value ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
                
                <div className="relative">
                    <button 
                        onClick={() => setShowAddSource(!showAddSource)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                            showAddSource ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-700 hover:text-white'
                        }`}
                        title="Add Music Source"
                    >
                        <Plus size={16} className={`transition-transform duration-200 ${showAddSource ? 'rotate-45' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showAddSource && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto animate-fade-in custom-scrollbar">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/50 sticky top-0 backdrop-blur-sm">
                                Add Source
                            </div>
                            {unaddedSources.length > 0 ? (
                                unaddedSources.map(s => (
                                    <button
                                        key={s.value}
                                        onClick={() => handleAddSource(s.value)}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-purple-500/20 hover:text-white transition-colors flex items-center justify-between group"
                                    >
                                        <span>{s.label}</span>
                                        <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                    All sources added
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Search Input */}
            <div className="relative group">
                <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 opacity-20 group-hover:opacity-40 blur transition-opacity ${isAiMode ? 'opacity-50 blur-md' : ''}`}></div>
                <div className="relative flex items-center bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                    
                    {/* Mode Toggle */}
                    <button 
                        onClick={() => setIsAiMode(!isAiMode)}
                        className={`px-4 py-4 border-r border-white/10 flex items-center gap-2 transition-colors ${
                            isAiMode ? 'bg-purple-500/10 text-purple-400' : 'hover:bg-white/5 text-slate-400'
                        }`}
                        title={isAiMode ? "AI Vibe Search Active" : "Standard Keyword Search"}
                    >
                        <Sparkles size={18} className={isAiMode ? "animate-pulse" : ""} />
                        <span className="text-sm font-medium hidden sm:inline">{isAiMode ? 'AI Mode' : 'Search'}</span>
                    </button>

                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isAiMode ? "Describe your vibe (e.g., 'Late night coding session')..." : "Search for song, artist, album..."}
                        className="flex-1 bg-transparent px-4 py-4 outline-none placeholder:text-slate-600 text-lg"
                    />

                    <button 
                        onClick={() => handleSearch()}
                        className="px-6 py-4 hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
                    </button>
                </div>
            </div>
            
            {/* AI Suggestions Chips */}
            {isAiMode && aiSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center animate-fade-in">
                    <span className="text-xs text-slate-500 w-full text-center mb-1">Gemini suggests:</span>
                    {aiSuggestions.map((term, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSuggestionClick(term)}
                            className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/20 transition-colors"
                        >
                            {term}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Results */}
        <div className="flex-1 pb-32">
             {searchTriggered && (
                 <>
                    <SongList 
                        songs={songs} 
                        onPlay={playSong} 
                        currentSong={currentSong}
                        isPlaying={isPlaying}
                    />
                    
                    {/* Load More Button */}
                    {hasMore && (
                        <div className="flex justify-center mt-8">
                            <button
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full font-medium transition-all duration-200 border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {isLoadingMore ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Loading...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Load More</span>
                                        <ChevronDown size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                 </>
             )}
        </div>
      </main>

      <Player 
        currentSong={currentSong} 
        onNext={playNext}
        onPrev={playPrev}
      />
    </div>
  );
};

export default App;