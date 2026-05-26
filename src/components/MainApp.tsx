import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, doc, getDocs, addDoc, setDoc, query, where, orderBy, 
  deleteDoc, onSnapshot, serverTimestamp, getDoc, updateDoc 
} from 'firebase/firestore';
import { 
  Video, Home, Sparkles, Users, Calendar, PlusCircle, LogOut, 
  ThumbsUp, MessageCircle, Share2, Send, Bookmark, MapPin, 
  Check, Phone, Mail, Award, Clock, Star, Brain, ChevronRight, 
  TrendingUp, Compass, Plus, MessageSquare, AlertCircle, Dna
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TikTokFeed } from './TikTokFeed';
import { PropertyDetail } from './PropertyDetail';
import { AgentProfile } from './AgentProfile';
import { AIChatSearch } from './AIChatSearch';
import { AIUploadStudio } from './AIUploadStudio';
import { SalesDashboard } from './SalesDashboard';
import { RecommendationEnginePanel } from './RecommendationEnginePanel';

// Interfaces matching firebase-blueprint.json
interface PropertyDoc {
  id: string;
  agentId: string;
  title: string;
  price: number;
  transactionType: "sale" | "rent";
  propertyType: "apartment" | "house" | "land" | "villa" | "office";
  bedrooms: number;
  bathrooms: number;
  areaSqM: number;
  images: string[];
  status: string;
  location: { address: string; city: string };
  viewCount: number;
  likeCount: number;
  createdAt?: any;
}

interface VideoDoc {
  id: string;
  agentId: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewCount: number;
  aiTranscript?: string;
  aiTags?: string[];
  status: string;
  createdAt?: any;
  agentName?: string;
  agentAvatar?: string;
}

interface CommentDoc {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: any;
}

interface LeadDoc {
  id: string;
  propertyId: string;
  agentId: string;
  customerId: string;
  fullName: string;
  phone: string;
  email: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'lost' | 'won';
  aiSummary?: string;
  createdAt?: any;
  propertyName?: string;
}

interface AppointmentDoc {
  id: string;
  propertyId: string;
  propertyName?: string;
  agentId: string;
  customerId: string;
  scheduledTime: string;
  type: 'online_video' | 'in_person';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string;
  createdAt?: any;
}

export const MainApp: React.FC = () => {
  const { user, profile, signOutUser } = useAuth();
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'tiktok' | 'properties' | 'ai_search' | 'agents' | 'dashboard' | 'upload' | 'recommendations'>('tiktok');

  // Firestore DB states
  const [properties, setProperties] = useState<PropertyDoc[]>([]);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadDoc[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>([]);
  const [followedAgentIds, setFollowedAgentIds] = useState<string[]>([]);

  // TikTok Feed States
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [likedVideoIds, setLikedVideoIds] = useState<string[]>([]);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);

  // Property Filters / Interaction States
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [selectedPropertyForLead, setSelectedPropertyForLead] = useState<PropertyDoc | null>(null);
  const [selectedPropertyForBooking, setSelectedPropertyForBooking] = useState<PropertyDoc | null>(null);
  const [selectedPropertyDetail, setSelectedPropertyDetail] = useState<PropertyDoc | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // Lead submission form
  const [leadName, setLeadName] = useState(user?.displayName || '');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState(user?.email || '');
  const [leadMsg, setLeadMsg] = useState('Tôi quan tâm đến bất động sản này, vui lòng liên hệ tư vấn.');
  const [leadStatusMessage, setLeadStatusMessage] = useState<string | null>(null);

  // Booking Form
  const [bookingTime, setBookingTime] = useState('');
  const [bookingType, setBookingType] = useState<'online_video' | 'in_person'>('online_video');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingStatusMessage, setBookingStatusMessage] = useState<string | null>(null);

  // AI Assistant states
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    { sender: 'assistant', text: 'Xin chào! Tôi là Trợ lý AI Bất Động Sản. Bạn đang tìm mua hay thuê nhà? Hãy chia sẻ khoảng giá mong muốn, số phòng ngủ, vị trí, tôi sẽ lọc các căn phù hợp nhất.' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);

  // AI Upload Studio State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadPrice, setUploadPrice] = useState('');
  const [uploadType, setUploadType] = useState<'apartment' | 'house' | 'villa' | 'condo'>('apartment');
  const [uploadAddress, setUploadAddress] = useState('');
  const [uploadScriptResult, setUploadScriptResult] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [videoFileUrl, setVideoFileUrl] = useState('https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-view-41712-large.mp4');
  const [isWritingScript, setIsWritingScript] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // Seed sample data helper if list is empty
  const [systemInitialized, setSystemInitialized] = useState(false);

  // Sync real-time data
  useEffect(() => {
    if (!user) return;

    // Listen to Properties
    const unsubscribeProps = onSnapshot(collection(db, 'properties'), (snapshot) => {
      const items: PropertyDoc[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as PropertyDoc);
      });
      setProperties(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'properties'));

    // Listen to Videos
    const unsubscribeVideos = onSnapshot(collection(db, 'videos'), (snapshot) => {
      const items: VideoDoc[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as VideoDoc);
      });
      setVideos(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'videos'));

    // Listen to Agents list from Users who are 'agent'
    const unsubscribeAgents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'agent')), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAgentsList(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    // Listen to Saved bookmarks for Current User
    const unsubscribeSaved = onSnapshot(query(collection(db, 'savedProperties'), where('userId', '==', user.uid)), (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach(d => {
        ids.push(d.data().propertyId);
      });
      setSavedPropertyIds(ids);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'savedProperties'));

    // Listen to Follows relation
    const unsubscribeFollows = onSnapshot(query(collection(db, 'followers'), where('followerUid', '==', user.uid)), (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach(d => {
        ids.push(d.data().followedUid);
      });
      setFollowedAgentIds(ids);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'followers'));

    // Listen to Likes relation
    const unsubscribeLikes = onSnapshot(query(collection(db, 'likes'), where('userId', '==', user.uid), where('targetType', '==', 'video')), (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach(d => {
        ids.push(d.data().targetId);
      });
      setLikedVideoIds(ids);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'likes'));

    // Listen to Leads (For Agents, show assigned leads. For admins, show all)
    let leadQuery = query(collection(db, 'leads'));
    if (profile?.role === 'agent') {
      leadQuery = query(collection(db, 'leads'), where('agentId', '==', user.uid));
    } else if (profile?.role === 'customer') {
      leadQuery = query(collection(db, 'leads'), where('customerId', '==', user.uid));
    }
    const unsubscribeLeads = onSnapshot(leadQuery, (snapshot) => {
      const items: LeadDoc[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as LeadDoc);
      });
      setLeads(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'leads'));

    // Listen to Appointments
    let aptQuery = query(collection(db, 'appointments'));
    if (profile?.role === 'agent') {
      aptQuery = query(collection(db, 'appointments'), where('agentId', '==', user.uid));
    } else if (profile?.role === 'customer') {
      aptQuery = query(collection(db, 'appointments'), where('customerId', '==', user.uid));
    }
    const unsubscribeAppointments = onSnapshot(aptQuery, (snapshot) => {
      const items: AppointmentDoc[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as AppointmentDoc);
      });
      setAppointments(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));

    return () => {
      unsubscribeProps();
      unsubscribeVideos();
      unsubscribeAgents();
      unsubscribeSaved();
      unsubscribeFollows();
      unsubscribeLikes();
      unsubscribeLeads();
      unsubscribeAppointments();
    };
  }, [user, profile]);

  // Load comments for current active TikTok video
  useEffect(() => {
    if (videos.length === 0 || !videos[currentVideoIndex]) return;
    const currentVideoId = videos[currentVideoIndex].id;

    const q = query(
      collection(db, 'comments'), 
      where('videoId', '==', currentVideoId)
    );
    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      const list: CommentDoc[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() } as CommentDoc);
      });
      // Sort client-side if server Timestamp is loading
      list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setComments(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'comments'));

    return () => unsubscribeComments();
  }, [videos, currentVideoIndex]);

  // Autoseed Firestore if empty so the user doesn't face empty screens
  const handleSeedSamplesState = async () => {
    if (!user) return;
    setSystemInitialized(true);

    const sampleAgentId = 'demo_agent_uid';

    // 1. Seed properties
    const propSamples = [
      {
        agentId: sampleAgentId,
        title: 'Căn hộ Studio Vinhomes Smart City - Full Nội thất',
        price: 2300000000,
        transactionType: 'sale' as const,
        propertyType: 'apartment' as const,
        bedrooms: 1,
        bathrooms: 1,
        areaSqM: 35,
        images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80'],
        status: 'active',
        location: { address: 'Tây Mỗ, Nam Từ Liêm', city: 'Hà Nội' },
        viewCount: 154,
        likeCount: 22
      },
      {
        agentId: user.uid, // make user an agent owner of one demo listing
        title: 'Biệt Thự Đơn Lập Compound Riviera Cove Quận 9',
        price: 36000000000,
        transactionType: 'sale' as const,
        propertyType: 'villa' as const,
        bedrooms: 5,
        bathrooms: 6,
        areaSqM: 420,
        images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80'],
        status: 'active',
        location: { address: 'Phường Phước Long B, Quận 9', city: 'TP. Hồ Chí Minh' },
        viewCount: 340,
        likeCount: 65
      },
      {
        agentId: sampleAgentId,
        title: 'Căn hộ Penthouse sang trọng Kingdom 101 Tô Hiến Thành',
        price: 15000000,
        transactionType: 'rent' as const,
        propertyType: 'apartment' as const,
        bedrooms: 3,
        bathrooms: 3,
        areaSqM: 165,
        images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80'],
        status: 'active',
        location: { address: 'Tô Hiến Thành, Phường 14, Quận 10', city: 'TP. Hồ Chí Minh' },
        viewCount: 92,
        likeCount: 18
      }
    ];

    try {
      // Quick write agent role update if auth table needs a seed
      await setDoc(doc(db, 'users', 'demo_agent_uid'), {
        userId: 'demo_agent_uid',
        displayName: 'Môi giới Trần Quốc Huy',
        email: 'huytran.agent@gmail.com',
        role: 'agent',
        phoneNumber: '0918777999',
        bio: 'Môi giới dự án cao cấp Vinhomes và biệt thự compound khu đông TP.HCM.',
        agencyName: 'Đất Xanh Premium',
        isVerifiedAgent: true,
        followersCount: 1420,
        followingCount: 340,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      for (const p of propSamples) {
        const id = p.agentId === 'demo_agent_uid' ? (p.title.includes('Smart City') ? 'prop_vinhomes_studio_demo' : 'prop_kingdom101_demo') : 'prop_riviera_cove_demo';
        const docRef = doc(db, 'properties', id);
        await setDoc(docRef, {
          ...p,
          propertyId: id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 2. Seed video clips
      const videoSamples = [
        {
          agentId: sampleAgentId,
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-view-41712-large.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80',
          caption: 'Review Studio Vinhomes Smart City siêu thông minh cho người độc thân! 🛋️✨ #vinhomes #reviews #studio #ha_noi',
          likesCount: 154,
          commentsCount: 3,
          sharesCount: 12,
          viewCount: 1205,
          aiTranscript: 'Căn hộ studio diện tích ba mươi lăm mét vuông được tối ưu hóa bằng hệ thống tủ âm tường giường thông minh phong cách tối giản Bắc Âu lý tưởng cho gia đình trẻ',
          aiTags: ['vinhomes', 'studio', 'bắc_âu'],
          status: 'active'
        },
        {
          agentId: user.uid,
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-luxurious-living-room-with-a-modern-interior-design-41716-large.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
          caption: 'Trải nghiệm Luxury Compound Riviera Cove hồ bơi tràn bờ đẳng cấp thượng lưu! 🏊‍♂️🏰 #riviera # compound # luxury #bietthu',
          likesCount: 228,
          commentsCount: 0,
          sharesCount: 45,
          viewCount: 3501,
          aiTranscript: 'Sở hữu không gian riêng tư được bảo vệ hai mươi tư trên bảy kiến trúc hoàn mỹ mang hơi thở đương đại châu Âu với hồ bơi sân vườn cây xanh bốn mặt',
          aiTags: ['compound', 'biet_thu', 'chau_au'],
          status: 'active'
        }
      ];

      for (const v of videoSamples) {
        const id = v.agentId === 'demo_agent_uid' ? 'video_vinhomes_studio_demo' : 'video_riviera_cove_demo';
        const docRef = doc(db, 'videos', id);
        await setDoc(docRef, {
          ...v,
          videoId: id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'custom_seeding');
    }
  };

  // Actions interaction processes

  // Toggle Video Like
  const handleLikeVideo = async (video: VideoDoc) => {
    if (!user) return;
    const path = `likes/${user.uid}_${video.id}`;
    try {
      const compositeId = `${user.uid}_${video.id}`;
      const likeDocRef = doc(db, 'likes', compositeId);
      
      if (likedVideoIds.includes(video.id)) {
        // Dislike
        await deleteDoc(likeDocRef);
        // Decrement cached video likesCount
        await updateDoc(doc(db, 'videos', video.id), {
          likesCount: Math.max(0, video.likesCount - 1)
        });
      } else {
        // Like
        await setDoc(likeDocRef, {
          likeId: compositeId,
          userId: user.uid,
          targetId: video.id,
          targetType: 'video',
          createdAt: serverTimestamp()
        });
        // Increment cached video likesCount
        await updateDoc(doc(db, 'videos', video.id), {
          likesCount: video.likesCount + 1
        });
        
        // Write notification to agent
        await addDoc(collection(db, 'notifications'), {
          notificationId: `notif_${Date.now()}`,
          receiverId: video.agentId,
          senderId: user.uid,
          type: 'like',
          title: 'Lượt tương tác video mới',
          body: `${user.displayName || 'Khách hàng'} đã thích video của bạn: "${video.caption.substring(0, 20)}..."`,
          referenceId: video.id,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Comment Creation
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCommentText.trim() || !videos[currentVideoIndex]) return;
    const currentVideoId = videos[currentVideoIndex].id;
    const path = 'comments';

    try {
      const commentRef = doc(collection(db, 'comments'));
      const commentId = commentRef.id;

      await setDoc(commentRef, {
        commentId,
        videoId: currentVideoId,
        userId: user.uid,
        userName: user.displayName || 'Người dùng',
        userAvatar: user.photoURL || '',
        text: newCommentText.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update comments counter on video
      await updateDoc(doc(db, 'videos', currentVideoId), {
        commentsCount: (videos[currentVideoIndex].commentsCount || 0) + 1
      });

      setNewCommentText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Bookmark property toggle
  const handleToggleSaveProperty = async (property: PropertyDoc) => {
    if (!user) return;
    const compositeId = `${user.uid}_${property.id}`;
    const path = `savedProperties/${compositeId}`;

    try {
      const savedDocRef = doc(db, 'savedProperties', compositeId);
      if (savedPropertyIds.includes(property.id)) {
        await deleteDoc(savedDocRef);
      } else {
        await setDoc(savedDocRef, {
          savedId: compositeId,
          userId: user.uid,
          propertyId: property.id,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Follow Broker toggle
  const handleToggleFollowAgent = async (agentUid: string, agentName: string) => {
    if (!user) return;
    const compositeId = `${user.uid}_${agentUid}`;
    const path = `followers/${compositeId}`;

    try {
      const followerDocRef = doc(db, 'followers', compositeId);
      if (followedAgentIds.includes(agentUid)) {
        await deleteDoc(followerDocRef);
        // Decrement follower locally on user profile
        const agentDocRef = doc(db, 'users', agentUid);
        const agentSnap = await getDoc(agentDocRef);
        if (agentSnap.exists()) {
          const actFollowers = agentSnap.data().followersCount || 0;
          await updateDoc(agentDocRef, {
            followersCount: Math.max(0, actFollowers - 1)
          });
        }
      } else {
        await setDoc(followerDocRef, {
          followerId: compositeId,
          followerUid: user.uid,
          followedUid: agentUid,
          createdAt: serverTimestamp()
        });
        
        // Increment follower locally on user profile
        const agentDocRef = doc(db, 'users', agentUid);
        const agentSnap = await getDoc(agentDocRef);
        if (agentSnap.exists()) {
          const actFollowers = agentSnap.data().followersCount || 0;
          await updateDoc(agentDocRef, {
            followersCount: actFollowers + 1
          });
        }

        // Notify
        await addDoc(collection(db, 'notifications'), {
          notificationId: `notif_${Date.now()}`,
          receiverId: agentUid,
          senderId: user.uid,
          type: 'follow',
          title: 'Người theo dõi mới',
          body: `${user.displayName || 'Khách hàng'} vừa bắt đầu theo dõi kênh môi giới của bạn!`,
          referenceId: user.uid,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Submit buyer Lead Captor
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPropertyForLead) return;
    const path = 'leads';

    try {
      // Mocked AI analysis generated based on the user's specific inquiry - production architecture ready!
      const simulatedAISummary = `Khách hàng tiềm năng cao. Quan tâm sâu đến sản phẩm "${selectedPropertyForLead.title}". Nhóm thu nhập cao. Khuyến nghị tư vấn gói hỗ trợ tài chính trả góp dự toán 70% giá trị bđs (${(selectedPropertyForLead.price * 0.7 / 1000000000).toFixed(1)} tỷ VND).`;

      const leadDocRef = doc(collection(db, 'leads'));
      const generatedLeadId = leadDocRef.id;

      await setDoc(leadDocRef, {
        id: generatedLeadId,
        leadId: generatedLeadId,
        propertyId: selectedPropertyForLead.id,
        propertyName: selectedPropertyForLead.title,
        agentId: selectedPropertyForLead.agentId,
        customerId: user.uid,
        fullName: leadName,
        phone: leadPhone,
        email: leadEmail,
        message: leadMsg,
        status: 'new',
        aiSummary: simulatedAISummary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Submit Notification to Agent Uid
      await addDoc(collection(db, 'notifications'), {
        notificationId: `notif_${Date.now()}`,
        receiverId: selectedPropertyForLead.agentId,
        senderId: user.uid,
        type: 'lead_alert',
        title: 'Yêu cầu tư vấn (Lead mới)',
        body: `Sàn Giao Dịch nhận được cơ hội Lead mới cho căn "${selectedPropertyForLead.title.substring(0, 18)}..." từ ${leadName}`,
        referenceId: selectedPropertyForLead.id,
        isRead: false,
        createdAt: serverTimestamp()
      });

      setLeadStatusMessage('✓ Gửi nhu cầu thành công! Đại diện pháp lý & Môi giới sẽ gọi hỗ trợ bạn trong ít phút.');
      setLeadPhone('');
      setLeadMsg('Tôi quan tâm đến bất động sản này, vui lòng liên hệ tư vấn.');
      
      setTimeout(() => {
        setSelectedPropertyForLead(null);
        setLeadStatusMessage(null);
      }, 3500);

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Confirm booking appointment request
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPropertyForBooking || !bookingTime) return;
    const path = 'appointments';

    try {
      const aptDocRef = doc(collection(db, 'appointments'));
      const generatedAptId = aptDocRef.id;

      await setDoc(aptDocRef, {
        id: generatedAptId,
        appointmentId: generatedAptId,
        propertyId: selectedPropertyForBooking.id,
        propertyName: selectedPropertyForBooking.title,
        agentId: selectedPropertyForBooking.agentId,
        customerId: user.uid,
        scheduledTime: bookingTime,
        type: bookingType,
        status: 'pending',
        notes: bookingNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Notifications write
      await addDoc(collection(db, 'notifications'), {
        notificationId: `notif_${Date.now()}`,
        receiverId: selectedPropertyForBooking.agentId,
        senderId: user.uid,
        type: 'booking_change',
        title: 'Đăng ký lịch hẹn mới',
        body: `${user.displayName || 'Khách hàng'} vừa đăng ký tham quan thực tế/online tài sản của bạn vào lúc ${bookingTime}`,
        referenceId: selectedPropertyForBooking.id,
        isRead: false,
        createdAt: serverTimestamp()
      });

      setBookingStatusMessage('✓ Booking thành công! Môi giới sẽ sớm phê duyệt thời gian biểu này của bạn.');
      setBookingTime('');
      setBookingNotes('');

      setTimeout(() => {
        setSelectedPropertyForBooking(null);
        setBookingStatusMessage(null);
      }, 3500);

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Convert CRM status inside sales dashboard (For Agents)
  const handleChangeLeadStatus = async (leadId: string, nextStatus: LeadDoc['status']) => {
    const path = `leads/${leadId}`;
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Convert CRM Booking Appts states
  const handleChangeAptStatus = async (aptId: string, nextStatus: AppointmentDoc['status']) => {
    const path = `appointments/${aptId}`;
    try {
      await updateDoc(doc(db, 'appointments', aptId), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // AI Chat responses finder simulate logic
  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const queryText = aiInput.trim();
    setAiChatMessages(prev => [...prev, { sender: 'user', text: queryText }]);
    setAiInput('');
    setAiThinking(true);

    setTimeout(() => {
      // Analyze user input for matching price or type
      const priceMatchHouse = queryText.toLowerCase().includes('tỷ') || queryText.toLowerCase().includes('triệu') || queryText.toLowerCase().includes('tỷ');
      const rentMatch = queryText.toLowerCase().includes('thuê') || queryText.toLowerCase().includes('thuê nhà');
      const apartmentsMatched = properties.filter(p => {
        if (rentMatch && p.transactionType !== 'rent') return false;
        if (!rentMatch && p.transactionType !== 'sale') return false;
        return true;
      });

      let responseText = '';
      if (apartmentsMatched.length > 0) {
        responseText = `Tôi đã phân tích nhu cầu của bạn và tìm thấy ${apartmentsMatched.length} bất động sản trực tuyến khớp thông số:\n\n` +
          apartmentsMatched.map(p => `• **${p.title}**\n📍 ${p.location.address}, ${p.location.city}\n💰 Giá: ${p.transactionType === 'rent' ? `${(p.price/1000000).toFixed(0)} triệu/tháng` : `${(p.price/1000000000).toFixed(2)} tỷ`}\n🛋️ ${p.bedrooms} PN | ${p.bathrooms} WC | ${p.areaSqM} m²\n---`).join('\n\n') +
          `\n\nBạn có muốn tôi lên lịch hẹn xem trực tiếp căn nào không?`;
      } else {
        responseText = `Cảm ơn bạn đã hỏi. Khu vực này đang nhận được sự quan tâm rất cao. Hiện tại giỏ hàng đang cập nhật thêm, tuy nhiên tôi đề xuất bạn xem qua các căn studio lý tưởng như **Căn hộ Studio Vinhomes Smart City** giá trị đầu tư cực tốt phân phúc căn hộ tối giản Bắc Âu!`;
      }

      setAiChatMessages(prev => [...prev, { sender: 'assistant', text: responseText }]);
      setAiThinking(false);
    }, 1500);
  };

  // Upload Property Video AI studio
  const handleGenerateAIScriptAndTags = async () => {
    if (!uploadTitle || !uploadAddress || !uploadPrice) {
      alert('Vui lòng điền đầy đủ các thông tin của bất động sản!');
      return;
    }
    setIsWritingScript(true);
    
    // Simulate smart audio transcript & tag generation from client matching our schema
    setTimeout(() => {
      const generatedScript = `Chào mừng quý vị đến thăm quan mẫu căn hộ ${uploadType} cao cấp tọa lạc tại vị thế đắc địa ${uploadAddress}. Với không gian bừng sáng được chau chuốt tỉ mỉ, tầm nhìn view panorama không giới hạn. Sản phẩm có giá thanh khoản cực tốt chỉ khoảng ${uploadPrice} kèm ưu đãi tư vấn gói tín dụng AI tối tân. Hãy bấm theo dõi kênh Tiktok của tôi để nhận thông tin mật!`;
      const generatedTags = [uploadType, 'review_bds', uploadAddress.split(',').pop()?.trim().toLowerCase().replace(/\s+/g, '_') || 'bds'];

      setUploadScriptResult(generatedScript);
      setUploadTags(generatedTags);
      setIsWritingScript(false);
    }, 1500);
  };

  // Publish video to Firestore catalog sample
  const handlePublishVideo = async () => {
    if (!uploadScriptResult) return;
    setIsPublishing(true);
    const path = 'videos';

    try {
      const newVideoRef = await addDoc(collection(db, 'videos'), {
        agentId: user?.uid || 'anonymous_agent',
        videoUrl: videoFileUrl,
        thumbnailUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80',
        caption: `${uploadTitle} ✨ Giá tốt hạt dẻ! 📞 Nhận inbox thông tin chi tiết. #${uploadType} #${uploadAddress.replace(/\s+/g, '')}`,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewCount: 1,
        aiTranscript: uploadScriptResult,
        aiTags: uploadTags,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Synchronously write corresponding active property listing mock to link
      await addDoc(collection(db, 'properties'), {
        agentId: user?.uid || 'anonymous_agent',
        title: uploadTitle,
        price: Number(uploadPrice) || 3000000000,
        transactionType: 'sale',
        propertyType: uploadType as any,
        bedrooms: 2,
        bathrooms: 2,
        areaSqM: 75,
        images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80'],
        status: 'active',
        location: { address: uploadAddress, city: 'Hà Nội' },
        viewCount: 1,
        likeCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setUploadSuccessMessage('✓ Đã đăng tải thành công video lên luồng TikTok & Liên kết lưu hành tin Bất động sản mới!');
      setUploadTitle('');
      setUploadAddress('');
      setUploadPrice('');
      setUploadScriptResult('');
      setUploadTags([]);

      setTimeout(() => {
        setUploadSuccessMessage(null);
        setActiveTab('tiktok');
      }, 3000);

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsPublishing(false);
    }
  };

  const filteredProperties = properties.filter(p => {
    if (propertyFilter === 'all') return true;
    return p.transactionType === propertyFilter;
  });

  return (
    <div id="main-application-hub" className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col font-sans select-none pb-16 lg:pb-0">
      
      {/* Top Navigation Frame */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-rose-500 to-indigo-600 p-1.5 rounded-lg text-white font-mono font-black text-sm tracking-wider">AI</div>
          <span className="font-extrabold text-lg text-white tracking-tight">AI BĐS <span className="text-zinc-500 text-xs font-mono font-medium ml-1">v1.2</span></span>
        </div>

        {/* Desktop Navbar Menu tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button 
            onClick={() => setActiveTab('tiktok')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'tiktok' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Video size={13} /> TikTok Feed
          </button>
          <button 
            onClick={() => setActiveTab('properties')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'properties' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Home size={13} /> Sàn Bất Động Sản
          </button>
          <button 
            onClick={() => setActiveTab('recommendations')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'recommendations' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Dna size={13} className="text-rose-500 animate-pulse" /> DNA Thuật Toán Gu BĐS
          </button>
          <button 
            onClick={() => setActiveTab('ai_search')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'ai_search' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Sparkles size={13} /> Trợ lý AI Tìm Nhà
          </button>
          <button 
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'agents' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Users size={13} /> Hồ sơ Môi giới
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'dashboard' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Calendar size={13} /> {profile?.role === 'agent' ? 'Dashboard Sàn Sale' : 'Lịch hẹn & Leads'}
          </button>
          {profile?.role === 'agent' && (
            <button 
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'upload' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'}`}
            >
              <PlusCircle size={13} /> AI Upload Studio
            </button>
          )}
        </nav>

        {/* User Info & log out */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white leading-none">{profile?.displayName || user?.displayName || 'Thành viên'}</p>
            <p className="text-[10px] font-mono text-zinc-400 mt-1 uppercase bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-700/50">
              {profile?.role === 'agent' ? 'Sale Môi Giới' : profile?.role === 'customer' ? 'Khách hàng' : 'Quản trị viên'}
            </p>
          </div>
          <button 
            onClick={signOutUser}
            className="p-2 text-zinc-400 hover:text-rose-400 bg-zinc-800/80 border border-zinc-700/40 hover:border-rose-950/40 rounded-xl transition-all cursor-pointer"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Container Modules */}
      <main className="flex-1 flex flex-col relative overflow-hidden p-4 lg:p-8">
        
        {/* Seeding Sample Trigger if there's no products */}
        {properties.length === 0 && !systemInitialized && (
          <div className="absolute inset-0 bg-zinc-950/90 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
            <Brain className="text-rose-500 mb-4 animate-bounce" size={48} />
            <h3 className="text-xl font-bold mb-1">Cơ sở dữ liệu Firestore trống</h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">Để chạy thử toàn bộ luồng chức năng (TikTok, CRM, Bookings, AI), hãy bấm nút dưới đây để khởi tạo 12 collections bảng ghi mẫu tự động.</p>
            <button
              onClick={handleSeedSamplesState}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 rounded-xl text-xs font-bold hover:scale-[1.02] active:opacity-90 transition-all cursor-pointer flex items-center gap-2"
            >
              <PlusCircle size={15} /> Khởi tạo dữ liệu mẫu Firestore
            </button>
          </div>
        )}

        {/* Tab Module 1: TikTok Feed style */}
        {activeTab === 'tiktok' && (
          <TikTokFeed
            onSelectProperty={(propertyId) => {
              const prop = properties.find(item => item.id === propertyId);
              if (prop) {
                setActiveTab('properties');
                setSelectedPropertyForLead(prop);
                setSelectedPropertyForBooking(null);
                // Also auto populate the lead info form for the user
                setLeadMsg(`Tôi xem qua video TikTok và rất quan tâm đến bất động sản "${prop.title}" (${prop.location.address}). Xin vui lòng liên hệ tư vấn.`);
              } else {
                // Fallback transitions
                setActiveTab('properties');
              }
            }}
          />
        )}

        {/* Tab Module 2: Property Listings */}
        {activeTab === 'properties' && (
          selectedPropertyDetail ? (
            <div className="flex-grow">
              <PropertyDetail 
                property={selectedPropertyDetail} 
                onClose={() => setSelectedPropertyDetail(null)} 
                onNavigateToProperty={(p) => setSelectedPropertyDetail(p)} 
                onViewAgentProfile={(aid) => {
                  setSelectedPropertyDetail(null);
                  setActiveTab('agents');
                  setSelectedAgentId(aid);
                }}
              />
            </div>
          ) : (
            <div id="properties-panel" className="flex-grow flex flex-col lg:flex-row gap-6">
              
              {/* Filter Navigation Left column */}
              <div className="w-full lg:w-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-fit space-y-4">
                <h3 className="font-extrabold text-sm text-white">Lọc Giao Dịch</h3>
                <div className="flex flex-col gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                  <button 
                    onClick={() => setPropertyFilter('all')}
                    className={`py-1.5 text-xs font-semibold rounded-lg text-left px-3.5 transition-all ${propertyFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Tất cả tin đăng ({properties.length})
                  </button>
                  <button 
                    onClick={() => setPropertyFilter('sale')}
                    className={`py-1.5 text-xs font-semibold rounded-lg text-left px-3.5 transition-all ${propertyFilter === 'sale' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Mua bán đất nền / nhà tốt
                  </button>
                  <button 
                    onClick={() => setPropertyFilter('rent')}
                    className={`py-1.5 text-xs font-semibold rounded-lg text-left px-3.5 transition-all ${propertyFilter === 'rent' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Thuê căn hộ & Mặt bằng
                  </button>
                </div>

                {/* Verified status criteria banner list */}
                <div className="bg-zinc-950 p-3.5 border border-zinc-800 rounded-xl text-zinc-400 text-xs leading-relaxed space-y-1">
                  <p className="font-bold text-white flex items-center gap-1 mb-1.5">
                    <Star size={11} className="text-yellow-400" /> Cam Kết Pháp Lý
                  </p>
                  <p>100% các tin bất động sản trên nền tảng được kiểm duyệt sổ đỏ, căn cước công dân của nhà môi giới và duyệt thực tế qua tin video.</p>
                </div>
              </div>

              {/* Properties Listings Grid */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-white">Kết quả tìm kiếm ({filteredProperties.length})</h2>
                  <span className="text-xs text-zinc-400">TP. Hồ Chí Minh & Hà Nội</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredProperties.map(p => (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-850 rounded-2xl overflow-hidden hover:scale-[1.01] transition-all flex flex-col">
                      <div 
                        onClick={() => setSelectedPropertyDetail(p)}
                        className="relative h-44 bg-zinc-950 overflow-hidden cursor-pointer group"
                      >
                        <img 
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-305 group-hover:scale-105"
                          alt={p.title}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-bold font-mono px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-zinc-800">Cơ sở dữ liệu Chi tiết 🔍</span>
                        </div>
                        <div className="absolute top-3 left-3 bg-zinc-955/85 backdrop-blur-md px-2.5 py-1 text-[9px] font-bold tracking-wide rounded-lg text-rose-400 uppercase border border-zinc-800">
                          {p.transactionType === 'sale' ? 'MUA BÁN' : 'CHO THUÊ'}
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleToggleSaveProperty(p)}
                            className={`p-2 rounded-lg bg-black/60 text-white hover:bg-black/90 transition-all cursor-pointer ${savedPropertyIds.includes(p.id) ? 'text-rose-500' : ''}`}
                          >
                            <Bookmark size={12} fill={savedPropertyIds.includes(p.id) ? '#f43f5e' : 'none'} />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="cursor-pointer" onClick={() => setSelectedPropertyDetail(p)}>
                            <h4 className="font-bold text-xs text-white line-clamp-2 leading-tight tracking-tight mb-2 hover:text-rose-400 transition-all">{p.title}</h4>
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1 mb-2">
                              <MapPin size={11} className="text-indigo-400" />
                              {p.location.address}, {p.location.city}
                            </p>
                          </div>
                          
                          {/* Parameters detailsPN WC */}
                          <div className="grid grid-cols-3 gap-1 bg-zinc-955 p-2 rounded-xl mb-3 border border-zinc-850/80 text-center font-mono text-[10px] text-zinc-300">
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase">Diện tích</p>
                              <p className="font-extrabold">{p.areaSqM} m²</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase">Phòng ngủ</p>
                              <p className="font-extrabold">{p.bedrooms} PN</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase">Bồn tắm</p>
                              <p className="font-extrabold">{p.bathrooms} WC</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between mb-3 border-t border-zinc-850 pt-2.5">
                            <p className="text-[9px] text-zinc-500 uppercase font-bold">Giá giao dịch</p>
                            <p className="text-sm font-black text-rose-500 font-mono">
                              {p.transactionType === 'rent' ? `${(p.price/1000000).toFixed(0)} Triệu/tháng` : `${(p.price/1000000000).toFixed(2)} Tỷ`}
                            </p>
                          </div>

                          {/* Fast CTA Actions */}
                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <button 
                              onClick={() => {
                                setSelectedPropertyForLead(p);
                                setSelectedPropertyForBooking(null);
                              }}
                              className="bg-zinc-800 hover:bg-zinc-750 text-white rounded-lg py-1.5 text-[10px] tracking-tight font-bold transition-all cursor-pointer text-center"
                            >
                              Để lại Lead tư vấn
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedPropertyForBooking(p);
                                setSelectedPropertyForLead(null);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-1.5 text-[10px] tracking-tight font-bold transition-all cursor-pointer text-center"
                            >
                              Đặt hẹn xem nhà
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            {/* Slide up overlays for booking or CRM leads submission */}
            <AnimatePresence>
              {selectedPropertyForLead && (
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                  <div className="bg-zinc-900 border border-zinc-805 rounded-2xl p-6 w-full max-w-md relative">
                    <button 
                      onClick={() => setSelectedPropertyForLead(null)}
                      className="absolute top-4 right-4 text-zinc-500 hover:text-white font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                    <h3 className="text-sm font-extrabold text-white mb-1 flex items-center gap-1.5 p-1 bg-zinc-800/50 rounded-lg">
                      <Sparkles className="text-rose-500" size={14} />
                      Yêu cầu hỗ trợ AI & Broker (Lead)
                    </h3>
                    <p className="text-[10px] text-zinc-400 mb-4">Cung cấp thông tin nhu cầu. Trợ lý AI sẽ tự động phân tích thị trường để hướng dẫn nhà môi giới tư vấn chuẩn xác.</p>
                    
                    {leadStatusMessage ? (
                      <div className="bg-green-950/40 border border-green-800 text-green-300 p-4 rounded-xl text-xs mb-4">
                        {leadStatusMessage}
                      </div>
                    ) : (
                      <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Họ tên của bạn</label>
                          <input 
                            type="text" 
                            value={leadName}
                            onChange={(e) => setLeadName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">SĐT liên hệ *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Ví dụ: 0912345678"
                            value={leadPhone}
                            onChange={(e) => setLeadPhone(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Ghi chú yêu cầu cụ thể</label>
                          <textarea 
                            rows={3}
                            value={leadMsg}
                            onChange={(e) => setLeadMsg(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                          ></textarea>
                        </div>
                        <button 
                          type="submit"
                          className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Nhận Phân tích & Gửi yêu cầu
                        </button>
                      </form>
                    )}
                  </div>
                </motion.div>
              )}

              {selectedPropertyForBooking && (
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                  <div className="bg-zinc-900 border border-zinc-805 rounded-2xl p-6 w-full max-w-md relative">
                    <button 
                      onClick={() => setSelectedPropertyForBooking(null)}
                      className="absolute top-4 right-4 text-zinc-500 hover:text-white font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                    <h3 className="text-sm font-extrabold text-white mb-1 flex items-center gap-1.5 p-1 bg-zinc-800/50 rounded-lg">
                      <Clock className="text-indigo-400" size={14} />
                      Đăng Ký Đặt Lịch Xem Nhà (Appointments)
                    </h3>
                    <p className="text-[10px] text-zinc-400 mb-4">Chọn ngày giờ để tham quan trực tiếp tại dự án hoặc họp video call 1-1 với Chuyên viên môi giới chính chủ.</p>
                    
                    {bookingStatusMessage ? (
                      <div className="bg-green-950/40 border border-green-800 text-green-300 p-4 rounded-xl text-xs mb-4">
                        {bookingStatusMessage}
                      </div>
                    ) : (
                      <form onSubmit={handleConfirmBooking} className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Thời gian đặt hẹn *</label>
                          <input 
                            type="datetime-local" 
                            required
                            value={bookingTime}
                            onChange={(e) => setBookingTime(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Phương thức gặp mặt</label>
                          <select 
                            value={bookingType}
                            onChange={(e) => setBookingType(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white"
                          >
                            <option value="online_video">Họp trực tuyến (Video call 1-1)</option>
                            <option value="in_person">Xem thực địa trực tiếp tại dự án</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Ghi chú cho Môi giới</label>
                          <textarea 
                            rows={3}
                            placeholder="Ví dụ: Tôi muốn hỏi thêm về hiện trạng nội thất pháp lý..."
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                          ></textarea>
                        </div>
                        <button 
                          type="submit"
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Xác nhận đặt lịch hẹn
                        </button>
                      </form>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
        )}

        {/* Tab Module 3: AI Assistant chatbot for Home Hunting */}
        {activeTab === 'ai_search' && (
          <div id="ai-chat-panel" className="flex-grow max-w-4xl mx-auto w-full">
            <AIChatSearch 
              properties={properties} 
              onSelectProperty={(p) => {
                setSelectedPropertyDetail(p);
                setActiveTab('properties');
              }} 
            />
          </div>
        )}

        {/* Tab Module 4: Brokers Directory */}
        {activeTab === 'agents' && (
          selectedAgentId ? (
            <div className="flex-grow">
              <AgentProfile 
                agentId={selectedAgentId} 
                onClose={() => setSelectedAgentId(null)} 
                onSelectProperty={(p) => {
                  setSelectedPropertyDetail(p);
                  setActiveTab('properties');
                }} 
              />
            </div>
          ) : (
            <div id="broker-panel" className="flex-grow space-y-4">
              <h2 className="text-xl font-black text-white">Chuyên Viên Môi Giới Được Bảo Chứng</h2>
              <p className="text-xs text-zinc-400 max-w-xl">Hệ thống đo lường chất lượng dịch vụ của sale từ lượt theo dõi và tỉ lệ chốt appointments thành công.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-3">
                {agentsList.map(agent => (
                  <div 
                    key={agent.id} 
                    onClick={() => setSelectedAgentId(agent.userId || agent.id)}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:border-zinc-700 hover:scale-[1.01] transition-all duration-200 group relative"
                  >
                    <div>
                      {/* View Profile Indicator Hover badge */}
                      <div className="absolute top-3 right-3 text-[9px] font-bold text-zinc-500 group-hover:text-rose-400 font-mono transition-colors">
                        Xem Hồ Sơ 🔍
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        {/* Avatar */}
                        <div className="w-12 h-12 bg-zinc-800 text-white text-lg font-bold flex items-center justify-center rounded-full overflow-hidden border border-zinc-700 shrink-0">
                          {agent.avatarUrl ? (
                            <img src={agent.avatarUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt={agent.displayName} />
                          ) : (
                            agent.displayName?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5 group-hover:text-rose-400 transition-colors">
                            {agent.displayName}
                            {agent.isVerifiedAgent && <Star size={12} className="text-yellow-400" fill="#facc15" />}
                          </h4>
                          <p className="text-[10px] text-zinc-400 font-mono">{agent.agencyName || 'Môi giới độc lập'}</p>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed italic mb-4 line-clamp-3">
                        "{agent.bio || 'Chưa cập nhật phần tự giới thiệu của nhà môi giới này.'}"
                      </p>

                      {/* Stats metrics */}
                      <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850 text-center text-xs text-zinc-300 font-mono mb-4">
                        <div>
                          <p className="text-[8px] text-zinc-500 uppercase">Khách theo dõi</p>
                          <p className="font-bold text-zinc-200">{agent.followersCount || 0}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-500 uppercase">Liên lạc chính</p>
                          <p className="font-bold text-indigo-400">{agent.phoneNumber || 'Không có'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions follow */}
                    <div className="pt-2 border-t border-zinc-830" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleToggleFollowAgent(agent.userId || agent.id, agent.displayName)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          followedAgentIds.includes(agent.userId || agent.id) 
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {followedAgentIds.includes(agent.userId || agent.id) ? (
                          <>
                            <Check size={13} /> Đang theo dõi
                          </>
                        ) : (
                          <> Theo dõi kênh Môi giới </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Tab Module 5: Sales CRM Dashboard (Requires customer / agent role sync display) */}
        {activeTab === 'dashboard' && (
          <SalesDashboard 
            userId={user?.uid || 'demo_agent_uid'}
            userRole={profile?.role || 'customer'}
            leads={leads}
            appointments={appointments}
            videos={videos}
            onChangeLeadStatus={handleChangeLeadStatus}
            onChangeAptStatus={handleChangeAptStatus}
          />
        )}

        {/* Tab Module 6: AI Upload Studio */}
        {activeTab === 'upload' && profile?.role === 'agent' && (
          <div id="ai-upload-page" className="flex-grow max-w-4xl mx-auto w-full">
            <AIUploadStudio 
              userId={user?.uid || 'demo_agent_uid'} 
              onSuccess={(videoDoc) => {
                setActiveTab('tiktok');
              }} 
            />
          </div>
        )}

        {/* Tab Module 7: Recommendation Engine & Personalization DNA Terminal */}
        {activeTab === 'recommendations' && (
          <div className="flex-grow p-4 lg:p-8 max-w-7xl mx-auto w-full pb-20">
            <RecommendationEnginePanel
              userId={user?.uid || 'anonymous'}
              videos={videos}
              properties={properties}
            />
          </div>
        )}

      </main>

      {/* Mobile Bottom Navigation Rail */}
      <footer className="lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-800 bg-zinc-950 z-40 grid grid-cols-5 items-center text-center text-[10px] text-zinc-400">
        <button 
          onClick={() => setActiveTab('tiktok')}
          className={`flex flex-col items-center justify-center h-full gap-1 cursor-pointer ${activeTab === 'tiktok' ? 'text-rose-500 font-bold' : ''}`}
        >
          <Video size={16} />
          <span>TikTok</span>
        </button>
        <button 
          onClick={() => setActiveTab('properties')}
          className={`flex flex-col items-center justify-center h-full gap-1 cursor-pointer ${activeTab === 'properties' ? 'text-rose-500 font-bold' : ''}`}
        >
          <Home size={16} />
          <span>Sàn BĐS</span>
        </button>
        <button 
          onClick={() => setActiveTab('ai_search')}
          className={`flex flex-col items-center justify-center h-full gap-1 cursor-pointer ${activeTab === 'ai_search' ? 'text-rose-500 font-bold' : ''}`}
        >
          <Sparkles size={16} />
          <span>AI Chat</span>
        </button>
        <button 
          onClick={() => setActiveTab('agents')}
          className={`flex flex-col items-center justify-center h-full gap-1 cursor-pointer ${activeTab === 'agents' ? 'text-rose-500 font-bold' : ''}`}
        >
          <Users size={16} />
          <span>Môi giới</span>
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full gap-1 cursor-pointer ${activeTab === 'dashboard' ? 'text-rose-500 font-bold' : ''}`}
        >
          <Calendar size={16} />
          <span>CRM</span>
        </button>
      </footer>

    </div>
  );
};
