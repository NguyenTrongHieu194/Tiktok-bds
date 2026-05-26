import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { VideoDoc, PropertyDoc } from '../types/tiktok';
import { tiktokService } from '../services/tiktokService';
import { 
  Heart, MessageCircle, Bookmark, Share2, Volume2, VolumeX, 
  Play, Pause, ArrowRight, UserPlus, UserCheck, MapPin, Sparkles, 
  FileText, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TikTokComments } from './TikTokComments';
import { recommendationService } from '../services/recommendationService';

interface TikTokVideoPlayerProps {
  video: VideoDoc;
  isActive: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  onSelectProperty: (propertyId: string) => void;
  onLikeToggle: (videoId: string) => Promise<boolean>;
  onFollowToggle: (agentId: string) => Promise<boolean>;
  onSaveToggle: (propertyId: string) => Promise<boolean>;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
}

export const TikTokVideoPlayer: React.FC<TikTokVideoPlayerProps> = ({
  video,
  isActive,
  isMuted,
  onMuteToggle,
  onSelectProperty,
  onLikeToggle,
  onFollowToggle,
  onSaveToggle,
  isLiked,
  isSaved,
  isFollowing
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [property, setProperty] = useState<PropertyDoc | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(video.commentsCount);

  // Gesture double tap & tap effects
  const [heartClicks, setHeartClicks] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);
  const [showAiTranscriptModal, setShowAiTranscriptModal] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  // Load tied property detailed info
  useEffect(() => {
    let active = true;
    const fetchProperty = async () => {
      const data = await tiktokService.getPropertyById(video.propertyId);
      if (active && data) {
        setProperty(data);
      }
    };
    fetchProperty();
    return () => { active = false; };
  }, [video.propertyId]);

  // Real-time Watch Time Tracking for Recommendation Feedback Engine
  const activeStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      activeStartTimeRef.current = Date.now();
    } else {
      if (activeStartTimeRef.current && user) {
        const watchDurationMs = Date.now() - activeStartTimeRef.current;
        const watchDurationSec = Math.round(watchDurationMs / 1000);
        
        if (watchDurationSec >= 3) { // Only log positive watch times greater than 2 seconds (skip quick swipes)
          recommendationService.logVideoInteraction({
            userId: user.uid,
            videoId: video.id,
            videoTags: video.aiTags || [],
            propertyPrice: property?.price,
            propertyCity: property?.location?.city,
            propertyDistrict: property?.location?.district,
            watchTimeSec: watchDurationSec,
            totalDuration: 15,
            liked: isLiked,
            saved: isSaved
          }).catch(err => console.warn("Logged feedback failed:", err));
        }
      }
      activeStartTimeRef.current = null;
    }

    return () => {
      if (activeStartTimeRef.current && user && isActive) {
        const watchDurationMs = Date.now() - activeStartTimeRef.current;
        const watchDurationSec = Math.round(watchDurationMs / 1000);
        if (watchDurationSec >= 3) {
          recommendationService.logVideoInteraction({
            userId: user.uid,
            videoId: video.id,
            videoTags: video.aiTags || [],
            propertyPrice: property?.price,
            propertyCity: property?.location?.city,
            propertyDistrict: property?.location?.district,
            watchTimeSec: watchDurationSec,
            totalDuration: 15,
            liked: isLiked,
            saved: isSaved
          }).catch(err => console.warn("Logged feedback failed:", err));
        }
      }
    };
  }, [isActive, user, video.id, video.aiTags, property, isLiked, isSaved]);

  // Handle Autoplay & Pause via isActive state controlled by parent page
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive) {
      // Small timeout for browser engine safety
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            console.warn("Autoplay block by browser engine, muting and retrying:", error);
            // Fallback for chrome/safari autoplay policy
            videoEl.muted = true;
            videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          });
      }
    } else {
      videoEl.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  // Sync mute values across the feed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Single Click to Mute/Unmute
  const handleSingleClick = () => {
    onMuteToggle();
    setShowMuteIndicator(true);
    setTimeout(() => {
      setShowMuteIndicator(false);
    }, 850);
  };

  // Double Click / Double Tap to Like
  const lastTap = useRef<number>(0);
  const handleTapGesture = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      // Double tap triggered
      handleDoubleTap(e);
    } else {
      // Single tap candidate
      setTimeout(() => {
        const afterNow = Date.now();
        // Ensure another tap didn't happen in between
        if (afterNow - lastTap.current >= DOUBLE_PRESS_DELAY) {
          handleSingleClick();
        }
      }, DOUBLE_PRESS_DELAY);
    }
    lastTap.current = now;
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newHeart = { id: Date.now(), x, y };
      setHeartClicks(prev => [...prev, newHeart]);
      
      // Fire Like action if not currently liked
      if (!isLiked) {
        onLikeToggle(video.id).catch(() => {});
      }

      // Remove heart after animation duration
      setTimeout(() => {
        setHeartClicks(prev => prev.filter(h => h.id !== newHeart.id));
      }, 1000);
    }
  };

  const handleShare = async () => {
    const title = property?.title || "Bất động sản cao cấp";
    const text = video.caption;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareFeedback(true);
    setTimeout(() => setShareFeedback(false), 2000);
  };

  return (
    <div 
      ref={containerRef}
      id={`tiktok-player-${video.id}`}
      className="relative w-full h-full bg-slate-950 overflow-hidden select-none flex items-center justify-center snap-start"
    >
      {/* Video element - with lazy source load */}
      {(isActive || videoLoaded) && (
        <video
          ref={videoRef}
          src={video.videoUrl}
          loop
          playsInline
          className="w-full h-full object-cover"
          poster={video.thumbnailUrl}
          muted={isMuted}
          onLoadedData={() => setVideoLoaded(true)}
          onClick={handleTapGesture}
        />
      )}

      {/* Placeholder thumbnail until loaded */}
      {!videoLoaded && (
        <img 
          src={video.thumbnailUrl} 
          alt="BĐS Thumbnail" 
          className="absolute inset-0 w-full h-full object-cover blur-sm filter brightness-75 scale-105"
        />
      )}

      {/* Double Tap Flying Heart Effect */}
      <AnimatePresence>
        {heartClicks.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 0, scale: 0.3, rotate: Math.random() * 40 - 20 }}
            animate={{ opacity: 1, scale: [1, 1.3, 1.2], y: heart.y - 120 }}
            exit={{ opacity: 0, scale: 0.5, y: heart.y - 180 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ left: heart.x - 36, top: heart.y - 36, position: 'absolute', pointerEvents: 'none', zIndex: 30 }}
          >
            <Heart className="h-18 w-18 text-red-500 fill-red-500 drop-shadow-lg" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Mute/Sound HUD Temporary Indicator Overlay */}
      <AnimatePresence>
        {showMuteIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.9, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute z-20 p-4 bg-black/60 rounded-full text-white pointer-events-none"
          >
            {isMuted ? <VolumeX className="h-8 w-8" /> : <Volume2 className="h-8 w-8 text-emerald-400 animate-bounce" />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Controls Hover Playing Indicators */}
      {!isPlaying && videoLoaded && (
        <button 
          id="play-overlay-indicator"
          onClick={() => { videoRef.current?.play(); setIsPlaying(true); }}
          className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white border border-white/20 backdrop-blur-sm z-10 hover:scale-110 active:scale-95 transition"
        >
          <Play className="h-7 w-7 fill-white translate-x-0.5" />
        </button>
      )}

      {/* Top Left Gradient Background Header overlay */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10" />

      {/* Floating Sparkle/AI badge at the top */}
      <div className="absolute top-4 left-4 z-20 flex gap-2 items-center text-[10px] text-slate-100 bg-slate-900/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 font-mono tracking-wider">
        <Sparkles className="h-3 w-3 text-cyan-400 animate-spin" />
        AI SMART FEED
      </div>

      {/* BOTOM & SIDE CONTROLS OVERLAY */}
      {/* Right Column Action Controls */}
      <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center space-y-4 mb-4 select-none">
        
        {/* Agent Profile & Follow Badge */}
        <div className="relative flex flex-col items-center">
          <img
            src={video.agentAvatar}
            alt={video.agentName}
            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 bg-slate-800 shadow-md transform hover:scale-105 active:scale-95 transition"
          />
          <button
            id={`btn-follow-${video.agentId}`}
            onClick={() => onFollowToggle(video.agentId).catch((err) => alert(err.message))}
            className={`absolute bottom-[-6px] flex items-center justify-center h-5 w-5 rounded-full border transition transform active:scale-95 duration-200
              ${isFollowing 
                ? 'bg-slate-800 border-slate-700 text-emerald-400' 
                : 'bg-emerald-500 border-white text-slate-950 hover:bg-emerald-400'
              }`}
          >
            {isFollowing ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
          </button>
        </div>

        {/* Space gap */}
        <div className="h-1" />

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <button
            id={`btn-like-${video.id}`}
            onClick={() => onLikeToggle(video.id).catch((err) => alert(err.message))}
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-lg text-white hover:bg-slate-800/60 active:scale-90 transition transform-gpu duration-150
              ${isLiked ? 'text-rose-500 border-rose-500/20' : ''}`}
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-rose-500' : ''}`} />
          </button>
          <span className="text-xs text-white drop-shadow-md font-mono mt-1 font-medium">
            {video.likesCount}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button
            id={`btn-comment-${video.id}`}
            onClick={() => setShowComments(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-lg text-white hover:bg-slate-800/60 active:scale-90 transition"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <span className="text-xs text-white drop-shadow-md font-mono mt-1 font-medium">
            {commentCount}
          </span>
        </div>

        {/* Save listing/Bookmark Button */}
        <div className="flex flex-col items-center">
          <button
            id={`btn-bookmark-${video.id}`}
            onClick={() => onSaveToggle(video.propertyId).catch((err) => alert(err.message))}
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-lg text-white hover:bg-slate-800/60 active:scale-90 transition transform-gpu
              ${isSaved ? 'text-amber-500 border-amber-500/20' : ''}`}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-amber-500' : ''}`} />
          </button>
          <span className="text-xs text-white drop-shadow-md font-mono mt-1 font-medium">
            {isSaved ? "Đã lưu" : "Lưu bài"}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button
            id={`btn-share-${video.id}`}
            onClick={handleShare}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-lg text-white hover:bg-slate-800/60 active:scale-90 transition"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <span className="text-[10px] text-white drop-shadow-md mt-1">Chia sẻ</span>
        </div>

        {/* AI Script & Subtitles Button */}
        {video.aiTranscript && (
          <div className="flex flex-col items-center">
            <button
              id={`btn-transcript-${video.id}`}
              onClick={() => setShowAiTranscriptModal(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500/85 to-emerald-500/85 border border-cyan-400/20 shadow-lg text-slate-950 hover:brightness-110 active:scale-90 transition"
              title="Xem kịch bản AI Thuyết Minh"
            >
              <FileText className="h-5 w-5" />
            </button>
            <span className="text-[10px] text-cyan-300 drop-shadow-md mt-1 font-mono">Bản dịch AI</span>
          </div>
        )}
      </div>

      {/* Copy link feedback banner */}
      <AnimatePresence>
        {shareFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="absolute top-20 z-30 bg-emerald-500 text-slate-950 font-medium px-4 py-2 rounded-full text-xs shadow-xl flex items-center gap-2"
          >
            <Compass className="h-4 w-4 animate-spin" />
            Đã sao chép liên kết chia sẻ BĐS!
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM METADATA OVERLAY (WIDESCREEN GRADIENT SHADOW) */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

      {/* Bottom Content Area */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 flex flex-col justify-end text-white text-left pointer-events-auto">
        <div className="mr-14"> {/* Avoid overlay with right-side controls column */}
          
          {/* Tag & Transaction Type Badge */}
          {property && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`text-[10px] uppercase tracking-wide px-2.5 py-0.5 rounded-full font-bold font-mono border
                ${property.transactionType === 'sale' 
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {property.transactionType === 'sale' ? 'Mở bán' : 'Cho thuê'}
              </span>
              <span className="bg-white/10 border border-white/5 text-slate-300 text-[10px] px-2.5 py-0.5 rounded-full font-sans capitalize font-medium">
                {property.propertyType === 'villa' ? 'Biệt thự' : 
                 property.propertyType === 'apartment' ? 'Căn hộ' :
                 property.propertyType === 'house' ? 'Nhà phố' : 'Bất động sản'}
              </span>
            </div>
          )}

          {/* Agent/Broker handle name */}
          <div className="flex items-center gap-1.5 mb-1 bg-black/10 py-1 px-1.5 w-fit rounded">
            <span className="font-semibold text-sm tracking-tight text-slate-100 hover:underline cursor-pointer">
              @{video.agentName || "Môi giới BĐS"}
            </span>
            <span className="h-1 w-1 bg-slate-500 rounded-full" />
            <span className="text-[11px] text-emerald-400 font-mono">Tư vấn viên</span>
          </div>

          {/* Price + Acreage row */}
          {property && (
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-2xl font-bold font-sans tracking-tight text-white drop-shadow-md">
                {property.priceFormatted || (property.transactionType === 'sale' ? `${property.price / 1000} Tỷ` : `${property.price} Tr/th`)}
              </div>
              <div className="text-xs text-slate-300 font-medium">
                • {property.areaSqM} m²
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                ({property.bedrooms} PN, {property.bathrooms} WC)
              </div>
            </div>
          )}

          {/* Interactive address row */}
          {property && (
            <div className="flex items-center gap-1 mb-2 text-xs text-slate-300 filter drop-shadow">
              <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="truncate font-sans tracking-tight leading-none">
                {property.location.address}, {property.location.city}
              </span>
            </div>
          )}

          {/* Caption text */}
          <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed mb-4 filter drop-shadow">
            {video.caption}
          </p>

          {/* MAIN CALL TO ACTION (CTA): "Xem chi tiết" */}
          <div className="relative">
            <motion.button
              id={`cta-details-${video.id}`}
              onClick={() => onSelectProperty(video.propertyId)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{ 
                boxShadow: ["0 0 0 0 rgba(16,185,129,0.3)", "0 0 0 10px rgba(16,185,129,0)", "0 0 0 0 rgba(16,185,129,0)"],
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl font-bold font-sans text-xs tracking-wide shadow-lg uppercase flex items-center justify-center gap-1.5 transition duration-150 relative z-10"
            >
              <span>Xem chi tiết bất động sản này</span>
              <ArrowRight className="h-4 w-4 stroke-[3]" />
            </motion.button>
          </div>

        </div>
      </div>

      {/* AI Thuyết Minh / Script Modal Bottom Sheet Popup */}
      <AnimatePresence>
        {showAiTranscriptModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAiTranscriptModal(false)}
              className="absolute inset-0 bg-black z-30"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-cyan-500/20 text-white rounded-t-2xl z-40 p-5 shadow-2xl flex flex-col max-h-[80%]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-sans font-bold text-cyan-400 text-sm uppercase tracking-wide">
                  <Sparkles className="h-4 w-4 text-cyan-400 animate-spin" />
                  Kịch bản thuyết minh AI (Audio Transcript)
                </div>
                <button
                  id="close-ai-transcript"
                  onClick={() => setShowAiTranscriptModal(false)}
                  className="rounded-full bg-slate-800 p-1 text-slate-400 hover:text-white"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              
              <div className="py-4 overflow-y-auto space-y-4 text-sm font-sans flex-1 scrollbar-thin scrollbar-thumb-slate-800 leading-relaxed text-slate-300">
                <p className="italic text-slate-400">“Dưới đây là văn bản thuyết minh giọng đọc AI được tự động trích xuất và tối ưu hóa cho video BĐS.”</p>
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-200">
                  {video.aiTranscript}
                </div>
                {video.aiTags && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 font-mono">Thẻ tìm kiếm AI:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {video.aiTags.map(tag => (
                        <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/20">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="pt-3 border-t border-slate-800">
                <button
                  id="understand-transcript-btn"
                  onClick={() => setShowAiTranscriptModal(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 font-semibold text-xs rounded-lg transition"
                >
                  Đóng bản dịch
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Inline Comments Sheet overlay */}
      <TikTokComments
        videoId={video.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        onCommentAdded={() => setCommentCount(prev => prev + 1)}
      />
    </div>
  );
};

// Internal minimal X Close Icon
const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
