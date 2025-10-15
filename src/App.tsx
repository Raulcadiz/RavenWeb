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
  const [isMuted, setIsMuted] = useState(false); // Intentar con audio activado por defecto
  const [isStreamLoading, setIsStreamLoading] = useState(false);

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

    // Detectar tipo de stream y configurar URL
    let finalUrl = url;
    let streamType = 'application/x-mpegURL'; // HLS por defecto
    let hasAudio = false;
    
    if (url.endsWith('.ts')) {
      finalUrl = url.replace('.ts', '.m3u8');
      console.log('🔧 Fixed URL from .ts to .m3u8:', finalUrl);
    } else if (url.includes('.m3u8') || url.includes('get.php')) {
      // Es HLS
      streamType = 'application/x-mpegURL';
      console.log('📺 Detected HLS stream');
      
      // Detectar si es un stream HLS con audio (como RTVE)
      if (url.includes('rtve.es') || url.includes('m3u8')) {
        hasAudio = true;
        console.log('🎵 HLS stream with audio detected (like RTVE)');
      }
    } else if (url.includes('.mp4') || url.includes('.avi') || url.includes('.mkv')) {
      // Es video directo
      streamType = 'video/mp4';
      hasAudio = true; // Los videos directos suelen tener audio
      console.log('🎬 Detected direct video stream');
    } else {
      // Intentar como HLS por defecto
      console.log('❓ Unknown stream type, trying as HLS');
    }
    
    console.log('🔗 Final URL:', finalUrl);
    console.log('📋 Stream type:', streamType);

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: hasAudio ? true : 'muted', // Autoplay con audio si el stream lo tiene
      preload: 'auto',
      fluid: false,
      fill: true,
      responsive: true,
      liveui: true,
      muted: false, // Intentar siempre con audio activado
      // Configuraciones específicas según el tipo de stream
      crossorigin: 'anonymous',
      html5: {
        vhs: {
          overrideNative: !hasAudio, // Usar nativo para streams con audio
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          useBandwidthFromLocalStorage: true,
          allowSeeksWithinUnsafeLiveWindow: true,
          handlePartialData: true,
          // Configuraciones adicionales para IPTV
          experimentalBufferBasedABR: !hasAudio,
          experimentalLLHLS: !hasAudio,
          // Intentar diferentes configuraciones
          enableLowInitialPlaylist: true,
          limitRenditionByPlayerDimensions: false,
          allowSeeksWithinUnsafeLiveWindow: true,
        },
        nativeAudioTracks: hasAudio, // Usar nativo para streams con audio
        nativeVideoTracks: hasAudio,
        // Intentar reproducir sin restricciones
        preloadTextTracks: hasAudio,
      },
    });

    player.src({
      src: finalUrl,
      type: streamType
    });

    player.ready(() => {
      player.load();
      
      // Intentar reproducir inmediatamente con audio activado
      const tryPlay = async () => {
        try {
          // Intentar reproducir con audio activado
          player.muted(false);
          player.volume(1.0);
          await player.play();
          console.log('✅ Reproducción exitosa con audio!');
          setIsMuted(false);
          setIsStreamLoading(false);
          
          // Activar pantalla completa automáticamente
          setTimeout(() => {
            try {
              player.requestFullscreen();
              console.log('📺 Pantalla completa activada automáticamente');
            } catch (err) {
              console.log('❌ No se pudo activar pantalla completa:', err);
            }
          }, 1000);
          
        } catch (err) {
          console.log('❌ Error en reproducción con audio:', err);
          
          // Si falla con audio, intentar muteado como fallback
          setTimeout(async () => {
            try {
              player.muted(true);
              await player.play();
              console.log('✅ Reproducción exitosa (muteado como fallback)!');
              setIsMuted(true);
              setIsStreamLoading(false);
              
              // Activar pantalla completa automáticamente
              setTimeout(() => {
                try {
                  player.requestFullscreen();
                  console.log('📺 Pantalla completa activada automáticamente');
                } catch (err) {
                  console.log('❌ No se pudo activar pantalla completa:', err);
                }
              }, 1000);
              
            } catch (err2) {
              console.log('❌ Segundo intento falló:', err2);
              setError('No se puede reproducir en el navegador. Usa VLC.');
              setIsStreamLoading(false);
            }
          }, 1000);
        }
      };
      
      // Intentar reproducir después de un breve delay
      setTimeout(tryPlay, 500);
    });

    // Timeout para detectar si el stream no carga
    const loadingTimeout = setTimeout(() => {
      console.log('⚠️ Timeout de carga alcanzado');
      console.log('📊 Player ready state:', player.readyState());
      console.log('📊 Player network state:', player.networkState());
      console.log('📊 Player current time:', player.currentTime());
      
      if (player.readyState() < 2) {
        console.log('❌ Stream no tiene datos suficientes');
        setError('El stream no se puede cargar en el navegador. Usa VLC para reproducir.');
        setIsStreamLoading(false);
      } else {
        console.log('✅ Stream tiene datos, intentando reproducir...');
        // El stream tiene datos, intentar reproducir
        player.play().catch(err => {
          console.log('❌ No se puede reproducir:', err);
          setError('Stream cargado pero no se puede reproducir. Usa VLC.');
          setIsStreamLoading(false);
        });
      }
    }, 8000); // 8 segundos timeout

    player.on('volumechange', () => {
      const muted = player.muted();
      console.log('🔊 Volume changed - muted:', muted);
      setIsMuted(muted);
    });

    // También sincronizar cuando el player esté listo
    player.on('loadedmetadata', () => {
      const muted = player.muted();
      console.log('📊 Metadata loaded - muted:', muted);
      
      // Verificar si el stream tiene audio
      const videoElement = player.el().querySelector('video');
      if (videoElement) {
        const audioTracks = videoElement.audioTracks ? videoElement.audioTracks.length : 0;
        console.log('🎵 Audio tracks:', audioTracks);
        console.log('🎵 Video element muted:', videoElement.muted);
        console.log('🎵 Video element volume:', videoElement.volume);
        
        // Solo mostrar advertencia si realmente hay un problema
        if (audioTracks === 0 && player.readyState() >= 2) {
          console.log('⚠️ STREAM SIN AUDIO DETECTADO');
          console.log('💡 Este es un stream IPTV sin audio en el navegador');
          console.log('💡 Los streams IPTV a menudo no tienen audio en navegadores web');
          console.log('💡 Usa VLC para reproducir con audio');
          
          // Solo mostrar error si el stream está funcionando pero sin audio
          setTimeout(() => {
            if (player.readyState() >= 2 && player.currentTime() > 0) {
              setError('Este canal no tiene audio en el navegador. Es normal en streams IPTV. Usa VLC para reproducir con audio.');
            }
          }, 3000); // Esperar 3 segundos para confirmar
        } else {
          console.log('✅ Stream con audio detectado o aún cargando');
        }
      }
      
      setIsMuted(muted);
    });

    player.on('error', () => {
      const error = player.error();
      if (error) {
        console.error('Player error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Stream URL:', finalUrl);
        
        if (error.code === 4) {
          setError('No se pudo cargar el stream. El canal puede estar caído o no es compatible con el navegador.');
        } else {
          setError(`Error de reproducción: ${error.message || 'Error desconocido'} (Código: ${error.code})`);
        }
      }
    });

    // Agregar más eventos de debug
    player.on('loadstart', () => {
      console.log('🔄 Load started for:', finalUrl);
      setIsStreamLoading(true);
    });

    player.on('loadedmetadata', () => {
      console.log('📊 Metadata loaded');
      console.log('📺 Video dimensions:', player.videoWidth(), 'x', player.videoHeight());
      console.log('⏱️ Duration:', player.duration());
    });

    player.on('loadeddata', () => {
      console.log('📊 Data loaded - stream ready to play');
    });

    player.on('canplaythrough', () => {
      console.log('✅ Stream can play through - fully loaded');
    });

    player.on('canplay', () => {
      console.log('▶️ Can play');
      console.log('📺 Video dimensions:', player.videoWidth(), 'x', player.videoHeight());
      console.log('⏱️ Duration:', player.duration());
      
      // Limpiar errores cuando el stream puede reproducirse
      setError(null);
    });

    player.on('waiting', () => {
      console.log('⏳ Waiting for data');
    });

    player.on('stalled', () => {
      console.log('⚠️ Stream stalled');
    });

    player.on('playing', () => {
      console.log('🎬 Video is playing!');
      console.log('📺 Current time:', player.currentTime());
      console.log('🔊 Audio muted:', player.muted());
      
      // Limpiar errores cuando el video funciona
      setError(null);
      setIsStreamLoading(false);
      clearTimeout(loadingTimeout); // Limpiar timeout si el video empieza a reproducirse
      
      // Sincronizar estado de audio
      const muted = player.muted();
      setIsMuted(muted);
      
      if (muted) {
        console.log('🔇 Video reproduciéndose pero sin audio');
        console.log('💡 Usuario puede hacer clic en "Activar Audio" para escuchar');
      } else {
        console.log('🔊 Video reproduciéndose CON audio');
      }
    });

    player.on('pause', () => {
      console.log('⏸️ Video paused');
    });

    player.on('ended', () => {
      console.log('🏁 Video ended');
    });

    // Evento para detectar cuando el usuario hace clic en el botón de play
    player.on('play', () => {
      console.log('▶️ Play button clicked');
      // No hacer nada automático aquí, dejar que el usuario controle el audio
    });

    // Activar audio cuando el usuario haga clic en el video
    player.on('useractive', () => {
      if (player.muted()) {
        console.log('👤 Usuario activo - activando audio...');
        player.muted(false);
        player.volume(1.0);
        setIsMuted(false);
        console.log('✅ Audio activado por interacción del usuario');
      }
    });

    // También activar audio cuando el usuario haga clic en cualquier parte de la página
    const handleUserInteraction = () => {
      if (playerRef.current && playerRef.current.muted()) {
        console.log('🖱️ Interacción del usuario - activando audio...');
        playerRef.current.muted(false);
        playerRef.current.volume(1.0);
        setIsMuted(false);
        console.log('✅ Audio activado por interacción global');
      }
    };

    // Agregar listeners para interacción del usuario
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });

    // Eventos de pantalla completa
    player.on('fullscreenchange', () => {
      if (player.isFullscreen()) {
        console.log('📺 Entrando a pantalla completa');
      } else {
        console.log('📺 Saliendo de pantalla completa');
      }
    });

    player.on('enterFullscreen', () => {
      console.log('📺 Pantalla completa activada');
    });

    player.on('exitFullscreen', () => {
      console.log('📺 Pantalla completa desactivada');
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
      console.error('❌ Error loading data:', err);
      setError(`Error al cargar los datos: ${err.response?.data?.error || err.message || 'Error desconocido'}`);
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
      // Cargar desde cache - NO necesita process()
      await playlistsApi.load(name);
      
      // NO llamar a parserApi.process() - ya está en cache
      // await parserApi.process(); ❌
      
      // Pequeña pausa para asegurar que el backend terminó
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
    setIsMuted(false); // Intentar con audio activado
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
              <div className="flex flex-wrap items-center gap-2">
                {isMuted && (
                  <button
                    onClick={() => {
                      if (playerRef.current) {
                        console.log('🔊 Activando audio...');
                        const player = playerRef.current;
                        
                        // Debug completo del estado del player
                        console.log('📊 Player state:', {
                          muted: player.muted(),
                          volume: player.volume(),
                          readyState: player.readyState(),
                          networkState: player.networkState(),
                          currentTime: player.currentTime(),
                          duration: player.duration(),
                          hasAudio: player.audioTracks ? player.audioTracks().length : 'unknown'
                        });
                        
                        // Intentar múltiples métodos
                        try {
                          // Método 1: Desmutear directamente
                          player.muted(false);
                          player.volume(1.0);
                          
                          // Método 2: Forzar reproducción
                          player.play().catch(err => console.log('❌ Error al reproducir:', err));
                          
                          // Método 3: Verificar después de un delay
                          setTimeout(() => {
                            const muted = player.muted();
                            const volume = player.volume();
                            console.log('🔊 Estado después de activar:', {
                              muted: muted,
                              volume: volume,
                              canPlay: player.readyState() >= 2
                            });
                            
                            if (muted) {
                              console.log('❌ Sigue muteado - intentando método alternativo');
                              // Método alternativo: recrear el player
                              player.muted(false);
                              player.volume(1.0);
                              player.currentTime(player.currentTime() + 0.1);
                            }
                            
                            setIsMuted(muted);
                          }, 200);
                          
                        } catch (err) {
                          console.error('❌ Error al activar audio:', err);
                        }
                      }
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-lg font-bold flex items-center gap-2 transition-all animate-pulse text-white shadow-lg"
                  >
                    <span className="text-2xl">🔇</span>
                    <span>🔊 Activar Audio</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    if (playerRef.current) {
                      try {
                        playerRef.current.requestFullscreen();
                        console.log('📺 Pantalla completa activada manualmente');
                      } catch (err) {
                        console.log('❌ Error al activar pantalla completa:', err);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold flex items-center gap-2 transition-all text-white"
                >
                  <span>📺</span>
                  <span>Pantalla Completa</span>
                </button>
                <button
                  onClick={() => {
                    console.log('🧪 Probando audio con stream de prueba...');
                    if (playerRef.current && selectedChannel) {
                      const player = playerRef.current;
                      
                      // Stream de prueba con audio garantizado
                      const testUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
                      
                      player.src({
                        src: testUrl,
                        type: 'application/x-mpegURL'
                      });
                      
                      player.load();
                      player.muted(false);
                      player.volume(1.0);
                      
                      setTimeout(() => {
                        player.play().then(() => {
                          console.log('✅ Stream de prueba reproduciéndose');
                          setIsMuted(false);
                          setError(null);
                        }).catch(err => {
                          console.log('❌ Error con stream de prueba:', err);
                        });
                      }, 1000);
                    }
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center gap-2 transition-all text-white"
                >
                  <span>🧪</span>
                  <span>Probar Audio</span>
                </button>
                <button
                  onClick={() => {
                    console.log('📺 Probando stream RTVE con audio...');
                    if (playerRef.current && selectedChannel) {
                      const player = playerRef.current;
                      
                      // Stream RTVE con audio garantizado
                      const rtveUrl = 'https://ztnr.rtve.es/ztnr/1688877.m3u8';
                      
                      player.src({
                        src: rtveUrl,
                        type: 'application/x-mpegURL'
                      });
                      
                      player.load();
                      player.muted(false);
                      player.volume(1.0);
                      
                      setTimeout(() => {
                        player.play().then(() => {
                          console.log('✅ Stream RTVE reproduciéndose');
                          setIsMuted(false);
                          setError(null);
                        }).catch(err => {
                          console.log('❌ Error con stream RTVE:', err);
                        });
                      }, 1000);
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center gap-2 transition-all text-white"
                >
                  <span>📺</span>
                  <span>Probar RTVE</span>
                </button>
                <button
                  onClick={() => {
                    console.log('🔄 Volviendo al stream original...');
                    if (playerRef.current && selectedChannel) {
                      const player = playerRef.current;
                      const originalUrl = selectedChannel.url;
                      
                      // Volver al stream original
                      player.src({
                        src: originalUrl,
                        type: 'application/x-mpegURL'
                      });
                      
                      player.load();
                      player.muted(true); // Volver a muteado
                      player.volume(1.0);
                      
                      setTimeout(() => {
                        player.play().then(() => {
                          console.log('✅ Stream original cargado');
                          setIsMuted(true);
                        }).catch(err => {
                          console.log('❌ Error con stream original:', err);
                        });
                      }, 1000);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center gap-2 transition-all text-white"
                >
                  <span>🔄</span>
                  <span>Volver Original</span>
                </button>
                <button
                  onClick={async () => {
                    const url = selectedChannel.url;
                    
                    // Intentar abrir con VLC directamente
                    try {
                      window.open(`vlc://${url}`, '_blank');
                    } catch (err) {
                      console.log('VLC protocol failed');
                    }
                    
                    // Fallback: copiar al portapapeles
                    try {
                      await navigator.clipboard.writeText(url);
                      alert('✅ URL copiada al portapapeles!\n\nSi VLC no se abrió automáticamente:\n1. Abre VLC Media Player\n2. Media → Open Network Stream (Ctrl+N)\n3. Pega la URL (Ctrl+V)\n4. Play');
                    } catch (err) {
                      // Si clipboard falla, mostrar la URL
                      prompt('Copia esta URL y ábrela en VLC:', url);
                    }
                  }}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold flex items-center gap-2 transition-all text-white shadow-lg"
                  title="Abrir en VLC Media Player"
                >
                  <Play className="w-6 h-6" />
                  <span>🎬 Abrir en VLC</span>
                </button>
                <button
                  onClick={async () => {
                    // Solución avanzada: múltiples intentos con diferentes configuraciones
                    if (playerRef.current) {
                      const player = playerRef.current;
                      const originalUrl = selectedChannel.url;
                      
                      console.log('🌐 Intentando reproducir en web con múltiples métodos...');
                      setError(null);
                      setIsStreamLoading(true);
                      
                      const methods = [
                        {
                          name: 'HLS con CORS bypass',
                          config: {
                            src: originalUrl,
                            type: 'application/x-mpegURL',
                            crossOrigin: 'anonymous'
                          }
                        },
                        {
                          name: 'Video directo',
                          config: {
                            src: originalUrl,
                            type: 'video/mp4'
                          }
                        },
                        {
                          name: 'HLS nativo',
                          config: {
                            src: originalUrl,
                            type: 'application/vnd.apple.mpegurl'
                          }
                        },
                        {
                          name: 'Stream sin CORS',
                          config: {
                            src: originalUrl,
                            type: 'application/x-mpegURL'
                          }
                        }
                      ];
                      
                      for (let i = 0; i < methods.length; i++) {
                        const method = methods[i];
                        console.log(`🔄 Probando método ${i + 1}: ${method.name}`);
                        
                        try {
                          // Configurar el player con el método actual
                          player.src(method.config);
                          player.load();
                          
                          // Esperar a que cargue
                          await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                              reject(new Error('Timeout'));
                            }, 3000);
                            
                            player.ready(() => {
                              clearTimeout(timeout);
                              resolve(true);
                            });
                            
                            player.on('error', () => {
                              clearTimeout(timeout);
                              reject(new Error('Player error'));
                            });
                          });
                          
                          // Intentar reproducir
                          await player.play();
                          console.log(`✅ ¡Éxito con método: ${method.name}!`);
                          setIsStreamLoading(false);
                          setError(null);
                          return; // Salir si funciona
                          
                        } catch (err) {
                          console.log(`❌ Método ${method.name} falló:`, err);
                          if (i === methods.length - 1) {
                            // Último método falló
                            console.log('❌ Todos los métodos fallaron');
                            setError('No se puede reproducir en el navegador. Los streams IPTV requieren VLC para funcionar correctamente.');
                            setIsStreamLoading(false);
                          }
                        }
                      }
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold flex items-center gap-2 transition-all text-white shadow-lg"
                  title="Intentar reproducir en el navegador con múltiples métodos"
                >
                  <Tv className="w-6 h-6" />
                  <span>🌐 Probar en Web</span>
                </button>
                <button
                  onClick={() => {
                    // Abrir stream en nueva pestaña
                    const url = selectedChannel.url;
                    console.log('🌐 Abriendo stream en nueva pestaña:', url);
                    
                    // Crear una nueva ventana con el stream
                    const newWindow = window.open('', '_blank', 'width=800,height=600');
                    if (newWindow) {
                      newWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>${selectedChannel.title}</title>
                          <style>
                            body { margin: 0; padding: 20px; background: #000; color: white; font-family: Arial; }
                            video { width: 100%; height: 80vh; background: #000; }
                            .info { margin-bottom: 20px; }
                            .error { color: red; margin-top: 20px; }
                          </style>
                        </head>
                        <body>
                          <div class="info">
                            <h2>${selectedChannel.title}</h2>
                            <p>Intentando reproducir stream...</p>
                          </div>
                          <video controls autoplay muted>
                            <source src="${url}" type="application/x-mpegURL">
                            <source src="${url}" type="video/mp4">
                            Tu navegador no soporta este formato de video.
                          </video>
                          <div class="error" id="error" style="display:none;">
                            <p>No se puede reproducir en el navegador. Usa VLC:</p>
                            <p>1. Abre VLC Media Player</p>
                            <p>2. Media → Open Network Stream (Ctrl+N)</p>
                            <p>3. Pega esta URL: <strong>${url}</strong></p>
                          </div>
                          <script>
                            const video = document.querySelector('video');
                            const error = document.getElementById('error');
                            
                            video.addEventListener('error', () => {
                              error.style.display = 'block';
                            });
                            
                            video.addEventListener('canplay', () => {
                              console.log('Stream funcionando!');
                            });
                            
                            // Timeout de 10 segundos
                            setTimeout(() => {
                              if (video.readyState < 2) {
                                error.style.display = 'block';
                              }
                            }, 10000);
                          </script>
                        </body>
                        </html>
                      `);
                      newWindow.document.close();
                    }
                  }}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold flex items-center gap-2 transition-all text-white shadow-lg"
                  title="Abrir stream en nueva pestaña"
                >
                  <Tv className="w-6 h-6" />
                  <span>🪟 Nueva Pestaña</span>
                </button>
                <button 
                  onClick={closeChannel} 
                  className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            {error ? (
              <div className="flex flex-col gap-3 text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/20 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Problema de reproducción</span>
                </div>
                <p className="text-sm">{error}</p>
                <div className="text-xs text-red-300 bg-red-800/30 p-2 rounded">
                  💡 <strong>Solución:</strong> 
                  {error.includes('sin audio') ? 
                    'Este canal no tiene audio en el navegador. Usa VLC para reproducir con audio.' :
                    'Los streams IPTV a menudo no funcionan en navegadores web debido a restricciones de CORS. Usa el botón "Abrir en VLC" para reproducir el canal en VLC Media Player.'
                  }
                </div>
              </div>
            ) : null}
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              <video 
                ref={videoRef}
                className="video-js vjs-big-play-centered w-full h-full"
              />
              {isMuted && (
                <div className="absolute top-4 right-4 bg-red-500/90 px-4 py-2 rounded-lg font-bold text-white animate-pulse">
                  🔇 SIN AUDIO - Usa los botones de arriba para activar
                </div>
              )}
              {isStreamLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                    <p className="text-lg font-semibold">Cargando stream...</p>
                    <p className="text-sm text-gray-300 mt-2">El stream está cargando, puede tardar unos segundos</p>
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => {
                          if (playerRef.current) {
                            console.log('🎬 Forzando reproducción...');
                            const player = playerRef.current;
                            
                            // Método 1: Reproducir directamente
                            player.play().catch(err => {
                              console.log('❌ Método 1 falló:', err);
                              
                              // Método 2: Muteado y reproducir
                              player.muted(true);
                              player.play().catch(err2 => {
                                console.log('❌ Método 2 falló:', err2);
                                
                                // Método 3: Recargar y reproducir
                                player.load();
                                setTimeout(() => {
                                  player.play().catch(err3 => {
                                    console.log('❌ Método 3 falló:', err3);
                                    setError('No se puede reproducir. Usa VLC.');
                                    setIsStreamLoading(false);
                                  });
                                }, 1000);
                              });
                            });
                          }
                        }}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold"
                      >
                        ▶️ Forzar Reproducción
                      </button>
                      
                      <button
                        onClick={() => {
                          // Abrir directamente en nueva pestaña
                          const url = selectedChannel?.url;
                          if (url) {
                            window.open(url, '_blank');
                          }
                        }}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold"
                      >
                        🪟 Abrir Directamente
                      </button>
                    </div>
                  </div>
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