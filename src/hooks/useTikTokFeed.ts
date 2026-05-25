import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { tiktokService } from '../services/tiktokService';
import { VideoDoc, PropertyDoc } from '../types/tiktok';
import { doc, getDocs, onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useTikTokFeed() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDocSnap, setLastDocSnap] = useState<any>(null);

  // Interaction collections states
  const [likedVideoIds, setLikedVideoIds] = useState<Set<string>>(new Set());
  const [savedPropertyIds, setSavedPropertyIds] = useState<Set<string>>(new Set());
  const [followedAgentIds, setFollowedAgentIds] = useState<Set<string>>(new Set());

  // Initial Seed check and load
  const loadInitialFeed = useCallback(async () => {
    setLoading(true);
    try {
      // Opt-in seed database
      await tiktokService.seedInitialDataIfDocsEmpty();
      
      const { videos: fetchedVideos, lastDoc, totalCount } = await tiktokService.getVideosFeed(null, 5);
      
      setVideos(fetchedVideos);
      setLastDocSnap(lastDoc);
      setHasMore(fetchedVideos.length >= 4); // If we fetched 4+ records, more might exist
    } catch (err) {
      console.error("Error loading TikTok feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch subsequent pages for Infinite Scroll
  const loadMoreVideos = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocSnap) return;
    setLoadingMore(true);
    try {
      const { videos: fetchedVideos, lastDoc } = await tiktokService.getVideosFeed(lastDocSnap, 5);
      
      if (fetchedVideos.length === 0) {
        setHasMore(false);
      } else {
        // Filter duplicates
        setVideos(prev => {
          const prevIds = new Set(prev.map(v => v.id));
          const uniques = fetchedVideos.filter(v => !prevIds.has(v.id));
          return [...prev, ...uniques];
        });
        setLastDocSnap(lastDoc);
        setHasMore(fetchedVideos.length >= 4);
      }
    } catch (err) {
      console.error("Error loading more videos:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDocSnap, loadingMore, hasMore]);

  // Read real-time states for Likes, Follows, and Saved bookmarks if logged in
  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  useEffect(() => {
    if (!user) {
      setLikedVideoIds(new Set());
      setSavedPropertyIds(new Set());
      setFollowedAgentIds(new Set());
      return;
    }

    // Subscribe to current user's liked videos
    const qLikes = query(collection(db, 'likes'), where('userId', '==', user.uid));
    const unsubLikes = onSnapshot(qLikes, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach(docSnap => ids.add(docSnap.data().videoId));
      setLikedVideoIds(ids);
    }, (err) => console.warn("Could not read likes real-time", err));

    // Subscribe to current user's saved properties
    const qSaved = query(collection(db, 'savedProperties'), where('userId', '==', user.uid));
    const unsubSaved = onSnapshot(qSaved, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach(docSnap => ids.add(docSnap.data().propertyId));
      setSavedPropertyIds(ids);
    }, (err) => console.warn("Could not read savedProperties real-time", err));

    // Subscribe to current user's followers
    const qFollowers = query(collection(db, 'followers'), where('followerUid', '==', user.uid));
    const unsubFollows = onSnapshot(qFollowers, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach(docSnap => ids.add(docSnap.data().followedUid));
      setFollowedAgentIds(ids);
    }, (err) => console.warn("Could not read followers real-time", err));

    return () => {
      unsubLikes();
      unsubSaved();
      unsubFollows();
    };
  }, [user]);

  // Actions wrapped with optimistic updates
  const handleLike = useCallback(async (videoId: string): Promise<boolean> => {
    if (!user) {
      throw new Error("Vui lòng đăng nhập để thích video!");
    }
    const isLiked = likedVideoIds.has(videoId);
    
    // Optimistic Update
    setLikedVideoIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
    setVideos(prev => prev.map(v => {
      if (v.id === videoId) {
        return { ...v, likesCount: v.likesCount + (isLiked ? -1 : 1) };
      }
      return v;
    }));

    try {
      return await tiktokService.toggleLikeVideo(videoId, user.uid, isLiked);
    } catch (err) {
      // Revert upon failure
      setLikedVideoIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(videoId);
        else next.delete(videoId);
        return next;
      });
      setVideos(prev => prev.map(v => {
        if (v.id === videoId) {
          return { ...v, likesCount: v.likesCount + (isLiked ? 1 : -1) };
        }
        return v;
      }));
      throw err;
    }
  }, [user, likedVideoIds]);

  const handleFollow = useCallback(async (agentId: string): Promise<boolean> => {
    if (!user) {
      throw new Error("Vui lòng đăng nhập để theo dõi môi giới!");
    }
    const isFollowing = followedAgentIds.has(agentId);

    // Optimistic Update
    setFollowedAgentIds(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(agentId);
      else next.add(agentId);
      return next;
    });

    try {
      return await tiktokService.toggleFollowAgent(agentId, user.uid, isFollowing);
    } catch (err) {
      setFollowedAgentIds(prev => {
        const next = new Set(prev);
        if (isFollowing) next.add(agentId);
        else next.delete(agentId);
        return next;
      });
      throw err;
    }
  }, [user, followedAgentIds]);

  const handleSave = useCallback(async (propertyId: string): Promise<boolean> => {
    if (!user) {
      throw new Error("Vui lòng đăng nhập để lưu bất động sản!");
    }
    const isSaved = savedPropertyIds.has(propertyId);

    // Optimistic Update
    setSavedPropertyIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });

    try {
      return await tiktokService.toggleBookmarkProperty(propertyId, user.uid, isSaved);
    } catch (err) {
      setSavedPropertyIds(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(propertyId);
        else next.delete(propertyId);
        return next;
      });
      throw err;
    }
  }, [user, savedPropertyIds]);

  return {
    videos,
    loading,
    loadingMore,
    hasMore,
    likedVideoIds,
    savedPropertyIds,
    followedAgentIds,
    loadMoreVideos,
    refetch: loadInitialFeed,
    handleLike,
    handleFollow,
    handleSave
  };
}
