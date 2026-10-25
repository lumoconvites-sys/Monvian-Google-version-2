import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Upload, 
  Film, 
  Sparkles, 
  Check, 
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SpotVideo, 
  fetchSpotVideos, 
  uploadSpotVideo, 
  saveVideoPlaybackPosition, 
  getVideoPlaybackPosition 
} from '../services/spotVideosService';

interface SpotVideoPlayerProps {
  spotId: string;
  spotName: string;
  spotCategory?: string;
  className?: string;
  onVideoUploaded?: (newVideo: SpotVideo) => void;
}

export const SpotVideoPlayer: React.FC<SpotVideoPlayerProps> = ({
  spotId,
  spotName,
  spotCategory,
  className = '',
  onVideoUploaded,
}) => {
  const [videos, setVideos] = useState<SpotVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showCenterIcon, setShowCenterIcon] = useState<'play' | 'pause' | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fill author name from logged-in user if available
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
      if (u.name) setUploadAuthor(u.name);
    } catch {}
  }, []);

  // 1. Fetch videos from Cloud Firestore + cache
  useEffect(() => {
    let isCancelled = false;

    fetchSpotVideos(spotId, spotName, spotCategory).then((fetched) => {
      if (isCancelled) return;
      setVideos(fetched);

      // Check saved position to resume where left off
      const savedPos = getVideoPlaybackPosition(spotId);
      if (savedPos && fetched.length > 0) {
        const idx = fetched.findIndex((v) => v.id === savedPos.videoId);
        if (idx !== -1) {
          setCurrentIndex(idx);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [spotId, spotName, spotCategory]);

  const currentVideo = videos[currentIndex] || null;

  // 2. Playback Rate 1.2x & Resume Position Handling
  const setupAndPlayVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentVideo) return;

    video.playbackRate = 1.2;

    const savedPos = getVideoPlaybackPosition(spotId);
    if (savedPos && savedPos.videoId === currentVideo.id && savedPos.currentTime > 0) {
      if (Math.abs(video.currentTime - savedPos.currentTime) > 1) {
        try {
          video.currentTime = savedPos.currentTime;
        } catch {}
      }
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    }
  }, [currentVideo, spotId]);

  useEffect(() => {
    setupAndPlayVideo();
  }, [setupAndPlayVideo, currentIndex]);

  // Save playback position periodically and on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (videoRef.current && currentVideo) {
        saveVideoPlaybackPosition(spotId, currentVideo.id, videoRef.current.currentTime);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (videoRef.current && currentVideo) {
        saveVideoPlaybackPosition(spotId, currentVideo.id, videoRef.current.currentTime);
      }
    };
  }, [spotId, currentVideo]);

  // 3. Single Tap Toggle: "clicando uma vez pausa o vídeo"
  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (iconTimerRef.current) clearTimeout(iconTimerRef.current);

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setShowCenterIcon('play');
        iconTimerRef.current = setTimeout(() => setShowCenterIcon(null), 700);
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setShowCenterIcon('pause');
      iconTimerRef.current = setTimeout(() => setShowCenterIcon(null), 900);
      if (currentVideo) {
        saveVideoPlaybackPosition(spotId, currentVideo.id, video.currentTime);
      }
    }
  };

  // 4. Auto Next Video (Infinite Loop)
  const handleVideoEnded = () => {
    if (videos.length <= 1) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.playbackRate = 1.2;
        videoRef.current.play().catch(() => {});
      }
      return;
    }
    const nextIndex = (currentIndex + 1) % videos.length;
    setCurrentIndex(nextIndex);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setProgress(video.currentTime);
    setDuration(video.duration || 0);

    if (currentVideo && Math.floor(video.currentTime) % 2 === 0) {
      saveVideoPlaybackPosition(spotId, currentVideo.id, video.currentTime);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  // 5. Upload Video Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
      if (!uploadTitle) {
        const rawName = files[0].name.replace(/\.[^/.]+$/, '');
        setUploadTitle(rawName.length > 4 ? rawName : `Experiência em ${spotName}`);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      const newVid = await uploadSpotVideo(
        spotId,
        selectedFile,
        uploadTitle || `Experiência em ${spotName}`,
        uploadAuthor || 'Visitante'
      );

      setVideos((prev) => [newVid, ...prev]);
      setCurrentIndex(0);
      onVideoUploaded?.(newVid);
      setIsUploading(false);
      setUploadSuccess(true);

      setTimeout(() => {
        setUploadSuccess(false);
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadTitle('');
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Community Videos Header & Upload Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Film className="w-4 h-4 text-zinc-400" />
            <span>Vídeos da Comunidade</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Armazenados na nuvem no formato original enviado
          </p>
        </div>

        {/* Upload Video Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Enviar Vídeo</span>
        </button>
      </div>

      {/* Natural Aspect-Ratio Video Container (Preserves Exact Format Uploaded by User) */}
      <div 
        onClick={handleTogglePlay}
        className="group relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-950/90 border border-zinc-200/80 dark:border-white/10 backdrop-blur-xl shadow-2xl cursor-pointer select-none transition-all duration-300 flex items-center justify-center min-h-[220px]"
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        {currentVideo ? (
          <video
            ref={videoRef}
            key={currentVideo.id}
            src={currentVideo.videoUrl}
            playsInline
            muted={isMuted}
            autoPlay
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.playbackRate = 1.2;
              }
            }}
            className="w-full h-auto max-h-[68vh] object-contain transform-gpu pointer-events-none block mx-auto"
          />
        ) : (
          <div className="w-full py-16 flex flex-col items-center justify-center text-zinc-500 gap-2">
            <Film className="w-8 h-8 animate-pulse text-zinc-400" />
            <span className="text-xs font-semibold">Carregando vídeos da nuvem...</span>
          </div>
        )}

        {/* Translucent Top Header Overlay */}
        <div className="absolute top-0 inset-x-0 p-3.5 sm:p-4 bg-gradient-to-b from-black/75 via-black/35 to-transparent flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            {/* Speed Badge (1.2x) */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 dark:bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-black tracking-wider text-white shadow-xs">
              <Sparkles className="w-3 h-3 text-[#38bdf8]" />
              <span>1.2x</span>
            </span>

            {/* Video Counter Pill */}
            {videos.length > 0 && (
              <span className="text-[11px] font-medium text-white/90 drop-shadow-sm bg-black/40 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md">
                Vídeo {currentIndex + 1} de {videos.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute/Unmute */}
            <button
              type="button"
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-black/70 active:scale-95 transition-all cursor-pointer shadow-sm"
              title={isMuted ? 'Ativar som' : 'Desativar som'}
              aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-white/90" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        {/* Center Feedback Icon on Click (Pause / Play) */}
        <AnimatePresence>
          {showCenterIcon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-2xl">
                {showCenterIcon === 'pause' ? (
                  <Pause className="w-7 h-7 fill-white text-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white text-white ml-1" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Translucent Info & Progress Bar */}
        <div className="absolute bottom-0 inset-x-0 p-3.5 sm:p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col gap-2">
          {currentVideo && (
            <div className="flex items-end justify-between gap-3 text-white">
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-bold tracking-tight truncate drop-shadow-md">
                  {currentVideo.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-white/80 font-medium">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-zinc-300" />
                    <span>{currentVideo.authorName}</span>
                  </span>
                  <span>•</span>
                  <span>Reprodução Contínua</span>
                </div>
              </div>
            </div>
          )}

          {/* Slim Progress Bar */}
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-xs">
            <div 
              className="h-full bg-white transition-all duration-150 ease-linear rounded-full"
              style={{
                width: duration > 0 ? `${(progress / duration) * 100}%` : '0%'
              }}
            />
          </div>
        </div>
      </div>

      {/* iOS-Style Translucent Upload Video Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div 
            onClick={() => setIsUploadModalOpen(false)}
            className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#262626] rounded-3xl p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Enviar Vídeo do Local</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{spotName}</p>
                  </div>
                </div>
              </div>

              {uploadSuccess ? (
                <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 text-green-500 flex items-center justify-center">
                    <Check className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <h4 className="text-base font-bold">Vídeo Enviado com Sucesso!</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Seu vídeo foi salvo na nuvem no formato original e adicionado à reprodução em 1.2x.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {/* File Picker Area */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-200 dark:border-white/15 hover:border-zinc-400 dark:hover:border-white/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors bg-zinc-50 dark:bg-white/5"
                    >
                      <Film className="w-8 h-8 text-zinc-400" />
                      {selectedFile ? (
                        <div>
                          <p className="text-xs font-bold text-green-500 truncate max-w-[260px]">
                            ✓ {selectedFile.name}
                          </p>
                          <span className="text-[11px] text-zinc-500">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Clique para trocar
                          </span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold">Clique para gravar ou escolher vídeo</p>
                          <span className="text-[11px] text-zinc-500">
                            MP4, MOV ou WebM no formato original
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title input */}
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                      Título ou Dica do Vídeo
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder={`Ex: Tour imperdível no ${spotName}`}
                      className="w-full h-11 px-3.5 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/30"
                    />
                  </div>

                  {/* Author input */}
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                      Seu Nome ou Perfil
                    </label>
                    <input
                      type="text"
                      value={uploadAuthor}
                      onChange={(e) => setUploadAuthor(e.target.value)}
                      placeholder="Ex: Ana Luiza"
                      className="w-full h-11 px-3.5 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/30"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="flex-1 h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:hover:bg-white/15 dark:text-zinc-300 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedFile || isUploading}
                      className="flex-2 h-12 px-6 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-98 disabled:opacity-50 cursor-pointer shadow-md"
                    >
                      {isUploading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Publicar Vídeo</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
