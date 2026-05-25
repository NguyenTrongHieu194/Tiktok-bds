import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { tiktokService } from '../services/tiktokService';
import { CommentDoc } from '../types/tiktok';
import { X, Send, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TikTokCommentsProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
}

export const TikTokComments: React.FC<TikTokCommentsProps> = ({
  videoId,
  isOpen,
  onClose,
  onCommentAdded
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !videoId) return;
    
    const fetchComments = async () => {
      setLoading(true);
      try {
        const list = await tiktokService.getComments(videoId);
        setComments(list);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [isOpen, videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Vui lòng đăng nhập để bình luận!");
      return;
    }
    if (!text.trim()) return;

    try {
      const authorName = user.displayName || user.email?.split('@')[0] || "Người dùng BĐS";
      const authorAvatar = user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`;
      
      const newComment = await tiktokService.addComment(
        videoId,
        user.uid,
        authorName,
        authorAvatar,
        text.trim()
      );

      setComments(prev => [newComment, ...prev]);
      setText('');
      setError(null);
      onCommentAdded(); // Notify player to update comment count

      // Scroll to top of comment list
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    } catch (err: any) {
      setError("Không thể gửi bình luận. Vui lòng thử lại!");
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "Vừa xong";
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return "Vừa xong";
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 60) return "Vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            id="comments-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            id="comments-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute bottom-0 left-0 right-0 z-50 flex h-[60%] flex-col rounded-t-2xl bg-slate-900 border-t border-slate-800 text-white shadow-2xl"
          >
            {/* Top Bar Indicator */}
            <div className="flex items-center justify-center py-2">
              <div className="h-1.5 w-12 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-800">
              <span className="text-md font-semibold font-sans">
                Bình luận ({comments.length})
              </span>
              <button 
                id="close-comments-btn"
                onClick={onClose}
                className="rounded-full p-1.5 hover:bg-slate-800 transition text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Comment List */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                  <span className="text-sm text-slate-400 font-mono">Đang tải bình luận...</span>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-2 h-48">
                  <MessageCircle className="h-10 w-10 text-slate-600 animate-pulse" />
                  <p className="text-sm text-slate-400">Chưa có bình luận nào cho BĐS này.</p>
                  <p className="text-xs text-slate-500">Trở thành người đầu tiên tương tác!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 text-sm items-start">
                    <img 
                      src={comment.userAvatar} 
                      alt={comment.userName}
                      className="h-9 w-9 rounded-full object-cover border border-slate-800 bg-slate-800"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${comment.userName}`;
                      }}
                    />
                    <div className="flex-1 bg-slate-800/40 rounded-xl p-3 border border-slate-800/40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200">{comment.userName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed font-sans">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Input Area */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 safe-bottom">
              {user ? (
                <form id="comment-form" onSubmit={handleSubmit} className="flex gap-2 items-center">
                  <input
                    id="comment-input"
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Viết câu hỏi hoặc nhận xét về BĐS này..."
                    className="flex-1 rounded-full bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 border border-slate-700/50"
                    maxLength={250}
                  />
                  <button
                    id="submit-comment-btn"
                    type="submit"
                    disabled={!text.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition transform active:scale-95 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-center py-2 text-center text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg">
                  Vui lòng đăng nhập để bình luận về bất động sản này.
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
