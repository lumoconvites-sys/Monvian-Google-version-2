import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showCenterIcon, setShowCenterIcon] = useState<'play' | 'pause' | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  }, [isUploadModalOpen]);

  // Generate local preview URL for the selected video file
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  // 1. Fetch videos from Cloud Firestore + cache
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingVideos(true);

    fetchSpotVideos(spotId, spotName, spotCategory).then((fetched) => {
      if (isCancelled) return;
      setVideos(fetched);
      setIsLoadingVideos(false);

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
    video.volume = 1.0;

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
    }
  };

  const handleCloseUploadModal = () => {
    if (isUploading) return;
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setUploadTitle('');
    setUploadSuccess(false);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      const newVid = await uploadSpotVideo(
        spotId,
        selectedFile,
        uploadTitle.trim() || `Experiência em ${spotName}`,
        uploadAuthor.trim() || 'Visitante'
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
      {currentVideo ? (
        <div 
          onClick={handleTogglePlay}
          className="group relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-950/90 border border-zinc-200/80 dark:border-white/10 shadow-2xl cursor-pointer select-none transition-all duration-300 flex items-center justify-center min-h-[220px]"
          style={{
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}
        >
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

          {/* Translucent Top Header Overlay */}
          <div className="absolute top-0 inset-x-0 p-3.5 sm:p-4 bg-gradient-to-b from-black/75 via-black/35 to-transparent flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              {/* Speed Badge (1.2x) */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 dark:bg-black/60 border border-white/20 text-[11px] font-black tracking-wider text-white shadow-xs">
                <Sparkles className="w-3 h-3 text-[#38bdf8]" />
                <span>1.2x</span>
              </span>

              {/* Video Counter Pill */}
              {videos.length > 0 && (
                <span className="text-[11px] font-medium text-white/90 drop-shadow-sm bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
                  {`Vídeo ${currentIndex + 1} de ${videos.length}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Mute/Unmute */}
              <button
                type="button"
                onClick={toggleMute}
                className="w-8 h-8 rounded-full bg-black/50 border border-white/15 text-white flex items-center justify-center hover:bg-black/70 active:scale-95 transition-all cursor-pointer shadow-sm"
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
                <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-2xl">
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
                </div>
              </div>
            </div>

            {/* Slim Progress Bar */}
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-150 ease-linear rounded-full"
                style={{
                  width: duration > 0 ? `${(progress / duration) * 100}%` : '0%'
                }}
              />
            </div>
          </div>
        </div>
      ) : !isLoadingVideos ? (
        <div
          onClick={() => setIsUploadModalOpen(true)}
          className="w-full py-12 px-6 rounded-2xl bg-zinc-50 dark:bg-[#1C1C1E] border border-zinc-200/80 dark:border-white/10 flex flex-col items-center justify-center text-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Film className="w-7 h-7 text-zinc-400" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Nenhum vídeo enviado para este local ainda
          </p>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Toque em Enviar Vídeo para compartilhar sua experiência
          </span>
        </div>
      ) : null}

      {/* iOS Bottom Sheet Upload Video Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isUploadModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleCloseUploadModal}
                className="fixed inset-0 z-[320] bg-black/45 backdrop-blur-[2px] flex flex-col justify-end items-center"
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 360, damping: 34 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-[500px] bg-white rounded-t-[36px] px-6 pt-7 shadow-[0_-12px_40px_rgba(0,0,0,0.16)] text-[#0B0B0C] max-h-[92dvh] overflow-y-auto"
                  style={{
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 16px) + 18px), 28px)',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
                  }}
                >
                  {/* 2. CABEÇALHO */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-[54px] h-[54px] rounded-full bg-[#EFEFF6] flex items-center justify-center shrink-0">
                      <Upload className="w-[24px] h-[24px] text-[#0B0B0C]" strokeWidth={2.1} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[21px] font-bold text-[#0B0B0C] tracking-[-0.02em] leading-tight">
                        Enviar Vídeo do Local
                      </h3>
                      <p className="text-[15.5px] font-normal text-[#71717A] leading-snug mt-0.5">
                        Compartilhe sua experiência
                      </p>
                    </div>
                  </div>

                  {uploadSuccess ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                        <Check className="w-8 h-8 stroke-[2.5]" />
                      </div>
                      <h4 className="text-[19px] font-bold text-[#0B0B0C]">
                        Vídeo Enviado com Sucesso!
                      </h4>
                      <p className="text-[14.5px] text-[#71717A] max-w-xs">
                        Seu vídeo foi salvo na nuvem e adicionado às experiências deste local.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleUploadSubmit} className="space-y-5">
                      {/* 3. ÁREA DE SELEÇÃO DO VÍDEO */}
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,video/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="relative w-full rounded-[26px] bg-[#F8F8FA] hover:bg-[#F3F3F7] border-[1.5px] border-dashed border-[#D8D8DF] min-h-[195px] flex flex-col items-center justify-center text-center px-6 py-7 cursor-pointer transition-colors overflow-hidden"
                        >
                          {selectedFile && previewUrl ? (
                            <div className="w-full flex flex-col items-center gap-3">
                              <div className="relative w-full max-h-[210px] rounded-[18px] overflow-hidden bg-black flex items-center justify-center">
                                <video
                                  src={previewUrl}
                                  className="w-full max-h-[210px] object-contain"
                                  playsInline
                                  muted
                                  loop
                                  autoPlay
                                />
                                <div className="absolute bottom-2.5 right-2.5 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[12.5px] font-semibold">
                                  Trocar vídeo
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-[15px] font-bold text-[#0B0B0C] truncate max-w-[280px]">
                                  {selectedFile.name}
                                </p>
                                <p className="text-[13.5px] text-[#8E8E93] mt-0.5">
                                  {`${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Toque para substituir`}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Modern Video Camera Icon with Play Button */}
                              <div className="mb-3.5 flex items-center justify-center">
                                <svg
                                  width="72"
                                  height="48"
                                  viewBox="0 0 72 48"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden="true"
                                >
                                  <rect
                                    x="2"
                                    y="4"
                                    width="48"
                                    height="40"
                                    rx="10"
                                    fill="#8E929F"
                                  />
                                  <path
                                    d="M53 17.5L65.4 10.1C67.4 8.9 70 10.35 70 12.7V35.3C70 37.65 67.4 39.1 65.4 37.9L53 30.5V17.5Z"
                                    fill="#8E929F"
                                  />
                                  <path
                                    d="M22.5 17.2C22.5 16.02 23.8 15.3 24.8 15.93L35.4 22.73C36.33 23.32 36.33 24.68 35.4 25.27L24.8 32.07C23.8 32.7 22.5 31.98 22.5 30.8V17.2Z"
                                    fill="#FFFFFF"
                                  />
                                </svg>
                              </div>

                              <p className="text-[17.5px] font-bold text-[#0B0B0C] tracking-[-0.015em] leading-snug">
                                Clique para gravar ou escolher vídeo
                              </p>
                              <span className="text-[15px] font-normal text-[#8E8E93] mt-1">
                                MP4, MOV ou WebM
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 4. CAMPO TÍTULO OU DICA DO VÍDEO */}
                      <div>
                        <label className="block text-[17px] font-bold text-[#0B0B0C] tracking-[-0.015em] mb-2.5">
                          Título ou Dica do Vídeo
                        </label>
                        <input
                          type="text"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder={`Ex: Tour imperdível no ${spotName}`}
                          className="w-full h-[56px] px-5 rounded-[20px] bg-[#F3F3F6] border border-black/[0.04] text-[16.5px] font-normal text-[#0B0B0C] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                        />
                      </div>

                      {/* 5. CAMPO SEU NOME OU PERFIL */}
                      <div>
                        <label className="block text-[17px] font-bold text-[#0B0B0C] tracking-[-0.015em] mb-2.5">
                          Seu Nome ou Perfil
                        </label>
                        <input
                          type="text"
                          value={uploadAuthor}
                          onChange={(e) => setUploadAuthor(e.target.value)}
                          placeholder="Seu nome"
                          className="w-full h-[56px] px-5 rounded-[20px] bg-[#F3F3F6] border border-black/[0.04] text-[16.5px] font-normal text-[#0B0B0C] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                        />
                      </div>

                      {/* 6. BOTÕES INFERIORES */}
                      <div className="flex items-center gap-3.5 pt-2">
                        <button
                          type="button"
                          onClick={handleCloseUploadModal}
                          className="w-[36%] h-[58px] rounded-full bg-[#F3F3F6] hover:bg-[#EAEAEF] active:scale-[0.98] text-[#0B0B0C] font-bold text-[17px] tracking-[-0.01em] transition-all cursor-pointer shrink-0"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!selectedFile || isUploading}
                          className="flex-1 h-[58px] px-6 rounded-full bg-[#0B0B0C] hover:bg-black/90 active:scale-[0.98] text-white font-bold text-[17px] tracking-[-0.01em] flex items-center justify-center gap-2.5 shadow-[0_8px_22px_rgba(0,0,0,0.16)] transition-all disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isUploading ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Enviando...</span>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-[21px] h-[21px]" strokeWidth={2.2} />
                              <span>Publicar Vídeo</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
