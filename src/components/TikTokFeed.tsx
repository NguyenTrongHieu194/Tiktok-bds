import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTikTokFeed } from '../hooks/useTikTokFeed';
import { TikTokVideoPlayer } from './TikTokVideoPlayer';
import { 
  ChevronUp, ChevronDown, Compass, RefreshCw, AlertCircle, 
  Sparkles, Grid, Layers, PlaySquare, BookmarkCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TikTokFeedProps {
  onSelectProperty: (propertyId: string) => void;
}

export const TikTokFeed: React.FC<TikTokFeedProps> = ({ onSelectProperty }) => {
  const {
    videos,
    loading,
    loadingMore,
    hasMore,
    likedVideoIds,
    savedPropertyIds,
    followedAgentIds,
    loadMoreVideos,
    refetch,
    handleLike,
    handleFollow,
    handleSave
  } = useTikTokFeed();

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true); // Default to muted per generic browser policies
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation support for desktop arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollByOffset(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollByOffset(-1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videos, currentVideoIndex]);

  // Scroll to a specific offset (+1 or -1 index)
  const scrollByOffset = (offset: number) => {
    const nextIndex = currentVideoIndex + offset;
    if (nextIndex < 0 || nextIndex >= videos.length) return;
    
    const container = feedContainerRef.current;
    if (container) {
      const children = container.querySelectorAll('.snap-start');
      const targetElement = children[nextIndex] as HTMLElement;
      if (targetElement) {
        container.scrollTo({
          top: targetElement.offsetTop,
          behavior: 'smooth'
        });
        setCurrentVideoIndex(nextIndex);
      }
    }
  };

  // Listen to container scroll events to compute active visible video & trigger infinite scroll page load
  const handleScroll = () => {
    const container = feedContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    
    // Calculate current video taking the middle portion as marker
    const index = Math.round(scrollTop / clientHeight);
    if (index !== currentVideoIndex && index >= 0 && index < videos.length) {
      setCurrentVideoIndex(index);
    }

    // Infinite scroll check: when user scrolls near the bottom block, pull new records
    if (videos.length > 0 && index >= videos.length - 2) {
      loadMoreVideos();
    }
  };

  // Toggle audio across videos feed
  const handleMuteToggle = () => {
    setGlobalMuted(prev => !prev);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[100dvh] bg-slate-950 text-white space-y-4">
        {/* Glowing loader */}
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
          <Compass className="absolute h-7 w-7 text-emerald-400 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-sm font-semibold text-slate-100 font-sans uppercase tracking-widest">
            AI BĐS Smart Feed
          </h3>
          <p className="text-xs text-slate-400 font-mono">Đang tải luồng video bất động sản...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[100dvh] bg-slate-950 text-white p-6 text-center space-y-5">
        <AlertCircle className="h-16 w-16 text-rose-500 animate-bounce" />
        <div className="space-y-2 max-w-sm">
          <h3 className="text-md font-bold text-slate-200">Không có luồng video nào</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Hệ thống hiện tại chưa tải được video BĐS từ kho lưu trữ. Vui lòng bấm làm mới hoặc kiểm tra kết nối mạng.
          </p>
        </div>
        <button
          id="btn-feed-retry"
          onClick={refetch}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-sans text-xs rounded-xl shadow-lg transition flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tải lại dữ liệu mẫu
        </button>
      </div>
    );
  }

  // Active video image for background blurring on Widescreen
  const activeVideo = videos[currentVideoIndex];

  return (
    <div id="tiktok-feed-wrapper" className="relative w-full h-[100dvh] bg-slate-950 overflow-hidden flex items-center justify-center">
      
      {/* Background blur filter on desktop view */}
      {activeVideo && (
        <div 
          className="hidden md:block absolute inset-0 bg-cover bg-center filter blur-[60px] brightness-[0.25] opacity-50 scale-110 pointer-events-none transition-all duration-700 z-0"
          style={{ backgroundImage: `url(${activeVideo.thumbnailUrl})` }}
        />
      )}

      {/* Main TikTok vertical screen standard container */}
      <div 
        id="tiktok-device-container"
        className="w-full h-full md:aspect-[9/16] md:max-w-[420px] md:h-[92vh] md:rounded-3xl md:overflow-hidden md:border md:border-slate-800 md:shadow-[0_0_80px_rgba(0,0,0,0.85)] relative bg-slate-950 flex flex-col z-10"
      >
        {/* Style injection to block scrollbars */}
        <style dangerouslySetInnerHTML={{__html: `
          #tiktok-feed-scroller::-webkit-scrollbar {
            display: none !important;
          }
          #tiktok-feed-scroller {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
        `}} />

        {/* Dynamic Vertical Scroll Layer snapping each video */}
        <div
          ref={feedContainerRef}
          id="tiktok-feed-scroller"
          onScroll={handleScroll}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory h-full w-full bg-slate-950 scroll-smooth"
        >
          {videos.map((video, index) => {
            // Lazy load check: only mount player elements if they are within immediately adjacent items (current, next, previous) for maximum performance
            const isNearVisible = Math.abs(index - currentVideoIndex) <= 1;

            return (
              <div 
                key={video.id} 
                className="snap-start w-full h-full shrink-0 relative"
                style={{ height: '100%' }}
              >
                {isNearVisible ? (
                  <TikTokVideoPlayer
                    video={video}
                    isActive={index === currentVideoIndex}
                    isMuted={globalMuted}
                    onMuteToggle={handleMuteToggle}
                    onSelectProperty={onSelectProperty}
                    onLikeToggle={handleLike}
                    onFollowToggle={handleFollow}
                    onSaveToggle={handleSave}
                    isLiked={likedVideoIds.has(video.id)}
                    isSaved={savedPropertyIds.has(video.propertyId)}
                    isFollowing={followedAgentIds.has(video.agentId)}
                  />
                ) : (
                  // Safe lightweight thumbnail placeholder
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <img 
                      src={video.thumbnailUrl} 
                      alt="Xem Video" 
                      className="w-full h-full object-cover filter brightness-50"
                    />
                    <div className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/70 border border-white/20 text-white animate-pulse">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Lazy Loading More spinner trigger inside the stream */}
          {loadingMore && (
            <div className="snap-start w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
              <p className="text-xs font-mono text-emerald-400 mt-3 animate-pulse">
                Đang quét thêm bất động sản hấp dẫn...
              </p>
            </div>
          )}
        </div>

        {/* Hover Desktop Next/Prev Arrow Keys Overlay helpers */}
        <div className="hidden md:flex absolute right-[-70px] top-1/2 transform -translate-y-1/2 flex-col gap-2 z-20">
          <button
            id="desktop-prev-btn"
            disabled={currentVideoIndex === 0}
            onClick={() => scrollByOffset(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/60 border border-slate-700/65 text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl transition"
            title="Video trước (Phím mũi tên Lên)"
          >
            <ChevronUp className="h-6 w-6" />
          </button>
          <button
            id="desktop-next-btn"
            disabled={currentVideoIndex === videos.length - 1}
            onClick={() => scrollByOffset(1)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/60 border border-slate-700/65 text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl transition"
            title="Video tiếp theo (Phím mũi tên Xuống)"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        </div>

        {/* Double click instruction watermark on desktop */}
        <div className="hidden md:block absolute left-[-150px] bottom-10 w-32 bg-slate-900/40 backdrop-blur-md border border-slate-800/40 text-slate-400 text-[10px] py-2 px-3 rounded-xl text-left pointer-events-none">
          <p className="font-bold text-slate-200 mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-400" />
            Mẹo điều khiển:
          </p>
          - Sử dụng <b>Phím Mũi Tên</b> Lên/Xuống để cuộn.<br/>
          - <b>Click 2 lần</b> lên video để thích.<br/>
          - <b>Chạm 1 lần</b> để bật/tắt tiếng.
        </div>
      </div>

    </div>
  );
};
