import { useState, useEffect, useCallback, useRef } from 'react';
import { Tv, Film, List, Play, Loader2, AlertCircle, Search, Grid3x3, X, Heart, Home } from 'lucide-react';
import { parserApi, channelsApi, groupsApi, playlistsApi } from './api';
import type { ChannelInfo, SavedPlaylist } from './api';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/http-streaming';

// Tipos para Video.js
import type Player from 'video.js/dist/types/player';

function App() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [showSavedPlaylists, setShowSavedPlaylists] = useState(false);
  
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'live' | 'vod' | 'movies'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isMuted, setIsMuted] = useState(true); // Iniciar muteado

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch (err) {
      console.error('Error saving favorites:', err);
    }
  }, [favorites]);

  // Cargar playlists guardadas al inicio
  useEffect(() => {
    loadSavedPlaylists();
  }, []);

  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;

    const url = selectedChannel.url;
    console.log('🎬 Setting up Video.js player');
    console.log('📺 Channel:', selectedChannel.title);
    console.log('🔗 URL:', url);

    // Limpiar player anterior
    if (playerRef.current) {
      console.log('🧹 Disposing previous player');
      playerRef.current.dispose();
      playerRef.current = null;
    }

    // Convertir .ts a .m3u8
    let finalUrl = url;
    if (url.endsWith('.ts')) {
      finalUrl = url.replace('.ts', '.m3u8');
      console.log('🔧 Fixed URL from .ts to .m3u8:', finalUrl);
    }

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: 'muted',
      preload: 'auto',
      fluid: false,
      fill: true,
      responsive: true,
      liveui: true,
      muted: true,
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          useBandwidthFromLocalStorage: true,
          allowSeeksWithinUnsafeLiveWindow: true,
          handlePartialData: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    player.src({
      src: finalUrl,
      type: 'application/x-mpegURL'
    });

    player.ready(() => {
      player.load();
      setTimeout(() => {
        player.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Error playing:', err);
          }
        });
      }, 300);
    });

    player.on('volumechange', () => {
      setIsMuted(player.muted());
    });

    player.on('error', () => {
      const error = player.error();
      if (error && error.code === 4) {
        setError('No se pudo cargar el stream. El canal puede estar caído.');
      }
    });

    player.on('playing', () => {
      setError(null);
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        console.log('🧹 Cleanup: disposing player');
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [selectedChannel]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const pageSize = 50;
      
      let response;
      switch (filter) {
        case 'live':
          response = await channelsApi.getLive(currentPage, pageSize, searchTerm);
          break;
        case 'vod':
          response = await channelsApi.getVod(currentPage, pageSize, searchTerm);
          break;
        case 'movies':
          response = await channelsApi.getMovies(currentPage, pageSize, searchTerm);
          break;
        default:
          response = await channelsApi.getAll(currentPage, pageSize, searchTerm, selectedGroup);
      }

      setChannels(response.items);
      setTotalPages(response.totalPages);

      if (groups.length === 0) {
        const groupsData = await groupsApi.getAll();
        setGroups(groupsData);
      }
    } catch (err: any) {
      setError('Error al cargar los datos');
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter, currentPage, searchTerm, selectedGroup, groups.length]);

  const handleLoadPlaylist = async () => {
    if (!playlistUrl.trim()) {
      setError('Por favor ingresa una URL válida');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await parserApi.initialize({
        playlistUrl: playlistUrl,
        name: 'default',
        loadCache: false,
      });

      await parserApi.process();
      await new Promise(resolve => setTimeout(resolve, 3000));

      setIsInitialized(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar la playlist');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIsInitialized(false);
    setChannels([]);
    setGroups([]);
    setSelectedGroup('all');
    setFilter('all');
    setSearchTerm('');
    setCurrentPage(1);
    setTotalPages(1);
    setPlaylistUrl('');
    setError(null);
    setShowSavedPlaylists(false);
  };

  const loadSavedPlaylists = async () => {
    try {
      const playlists = await playlistsApi.getSaved();
      setSavedPlaylists(playlists);
    } catch (err) {
      console.error('Error loading saved playlists:', err);
    }
  };

  const handleLoadSavedPlaylist = async (name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await playlistsApi.load(name);
      await parserApi.process();
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsInitialized(true);
      setShowSavedPlaylists(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar la playlist');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlaylist = async (name: string) => {
    if (!confirm(`¿Seguro que quieres eliminar "${name}"?`)) return;

    try {
      await playlistsApi.delete(name);
      setSavedPlaylists(prev => prev.filter(p => p.name !== name));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar la playlist');
      console.error('Error:', err);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized, filter, currentPage, searchTerm, selectedGroup]);

  const toggleFavorite = (chNumber: number) => {
    setFavorites(prev => 
      prev.includes(chNumber) 
        ? prev.filter(n => n !== chNumber)
        : [...prev, chNumber]
    );
  };

  const openChannel = (channel: ChannelInfo) => {
    setSelectedChannel(channel);
    setIsMuted(true);
    setError(null);
  };

  const closeChannel = () => {
    setSelectedChannel(null);
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      playerRef.current.muted(false);
      playerRef.current.volume(1.0);
      setIsMuted(false);
    }
  };

  const getChannelIcon = (type: number) => {
    switch (type) {
      case 0: return <Tv className="w-4 h-4" />;
      case 1: return <Film className="w-4 h-4" />;
      case 2: return <List className="w-4 h-4" />;
      default: return <Play className="w-4 h-4" />;
    }
  };

  const getChannelTypeLabel = (type: number) => {
    switch (type) {
      case 0: return 'En Vivo';
      case 1: return 'Película';
      case 2: return 'Serie';
      default: return 'Contenido';
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AmiIPTV
              </h1>
            </div>
          </div>
        </header>

        <div className="pt-20">
          <div className="container mx-auto px-6 py-12">
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
                <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Cargar Lista IPTV
                </h2>
                
                <input
                  type="text"
                  placeholder="https://ejemplo.com/playlist.m3u"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleLoadPlaylist()}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 text-white"
                  disabled={isLoading}
                />

                {error ? (
                  <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/20 mb-4">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <button
                  onClick={handleLoadPlaylist}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all mb-3"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Procesando playlist...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Cargar Playlist</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    // Test con stream que tiene audio garantizado
                    const testChannel: ChannelInfo = {
                      title: 'TEST AUDIO',
                      group: 'Test',
                      logo: '',
                      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                      chNumber: 9999,
                      channelType: 0
                    };
                    openChannel(testChannel);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all mb-3"
                >
                  <Play className="w-5 h-5" />
                  <span>🔊 Probar Canal TEST (con audio)</span>
                </button>

                <button
                  onClick={() => setShowSavedPlaylists(!showSavedPlaylists)}
                  disabled={isLoading}
                  className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all"
                >
                  <List className="w-5 h-5" />
                  <span>
                    {showSavedPlaylists ? 'Ocultar' : 'Ver'} Playlists Guardadas 
                    {savedPlaylists.length > 0 && ` (${savedPlaylists.length})`}
                  </span>
                </button>

                {showSavedPlaylists ? (
                  savedPlaylists.length > 0 ? (
                    <div className="mt-6 space-y-2 max-h-60 overflow-y-auto">
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Selecciona una playlist:</h3>
                      {savedPlaylists.map((playlist) => (
                        <div
                          key={playlist.name}
                          className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-3 rounded-lg transition-colors"
                        >
                          <button
                            onClick={() => handleLoadSavedPlaylist(playlist.name)}
                            disabled={isLoading}
                            className="flex-1 text-left disabled:opacity-50"
                          >
                            <div className="font-medium">{playlist.name}</div>
                            <div className="text-xs text-gray-400">
                              {new Date(playlist.lastModified).toLocaleDateString()} - {(playlist.size / 1024).toFixed(0)} KB
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(playlist.name);
                            }}
                            disabled={isLoading}
                            className="ml-2 p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Eliminar playlist"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-center text-gray-400 text-sm p-4 bg-white/5 rounded-lg">
                      No hay playlists guardadas. Carga una playlist nueva para guardarla automáticamente.
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AmiIPTV
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Cargar otra playlist"
              >
                <Home className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-20">
        <div className="container mx-auto px-6 py-6">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar canales..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              >
                <option value="all">Todos</option>
                <option value="live">En Vivo</option>
                <option value="vod">VOD</option>
                <option value="movies">Películas</option>
              </select>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              >
                <option value="all">Todos los grupos</option>
                {groups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {channels.length} canales (Página {currentPage} de {totalPages})
              </div>
              {totalPages > 1 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              No se encontraron canales
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-3'}>
              {channels.map((channel) => {
                const isFavorite = favorites.includes(channel.chNumber);
                
                return (
                  <div
                    key={channel.chNumber}
                    className="group bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all hover:scale-105"
                  >
                    <div className="relative aspect-video">
                      {channel.logo ? (
                        <img 
                          src={channel.logo} 
                          alt={channel.title} 
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      {!channel.logo ? (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
                          {getChannelIcon(channel.channelType)}
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(channel.chNumber);
                        }}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform z-10"
                      >
                        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                      </button>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => openChannel(channel)}
                          className="w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                        >
                          <Play className="w-6 h-6 ml-1" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-1 line-clamp-2" title={channel.title}>
                        {channel.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {getChannelIcon(channel.channelType)}
                        <span>{getChannelTypeLabel(channel.channelType)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedChannel ? (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6">
          <div className="w-full max-w-6xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedChannel.title}</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedChannel.group}</p>
              </div>
              <div className="flex items-center gap-2">
                {isMuted && (
                  <button
                    onClick={toggleMute}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold flex items-center gap-2 transition-all animate-pulse"
                  >
                    <span className="text-2xl">🔇</span>
                    <span>Activar Audio</span>
                  </button>
                )}
                <button 
                  onClick={closeChannel} 
                  className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            {error ? (
              <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/20 mb-4">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            ) : null}
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              <video 
                ref={videoRef}
                className="video-js vjs-big-play-centered w-full h-full"
              />
              {isMuted && (
                <div className="absolute top-4 right-4 bg-red-500/90 px-4 py-2 rounded-lg font-bold text-white animate-pulse">
                  🔇 SIN AUDIO - Haz click en "Activar Audio"
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;