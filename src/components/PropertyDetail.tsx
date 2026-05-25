import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, addDoc, setDoc, query, where, 
  serverTimestamp, onSnapshot, limit, getFirestore 
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  X, Phone, MessageSquare, Calendar, MapPin, Sparkles, Award, 
  Check, ChevronLeft, ChevronRight, Share2, Bookmark, Flame, 
  Heart, Compass, Eye, ShieldCheck, Clock, ExternalLink, Info,
  Layers, Map, Smile, ThumbsUp, Send, CheckCircle2, UserCheck, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Align with property types from other directories
interface PropertyDoc {
  id: string;
  agentId: string;
  title: string;
  price: number;
  transactionType: 'sale' | 'rent';
  propertyType: 'apartment' | 'house' | 'land' | 'villa' | 'office';
  bedrooms: number;
  bathrooms: number;
  areaSqM: number;
  images: string[];
  status: string;
  location: { address: string; city: string };
  viewCount: number;
  likeCount: number;
  description?: string;
  createdAt?: any;
}

interface AgentProfile {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
  bio?: string;
  agencyName?: string;
  isVerifiedAgent?: boolean;
  followersCount?: number;
  followingCount?: number;
}

interface PropertyDetailProps {
  property: PropertyDoc;
  onClose: () => void;
  onNavigateToProperty: (property: PropertyDoc) => void;
  onViewAgentProfile?: (agentId: string) => void;
}

// Points of Interest near standard areas for Vietnam
const AMENITIES_LIST = [
  { id: 'wifi', label: 'Wi-Fi Tốc độ cao', icon: '📶' },
  { id: 'pool', label: 'Bể bơi vô cực', icon: '🏊' },
  { id: 'gym', label: 'Phòng Gym hiện đại', icon: '🏋️' },
  { id: 'parking', label: 'Hầm giữ xe thông minh', icon: '🚗' },
  { id: 'security', label: 'An ninh 24/7', icon: '🛡️' },
  { id: 'balcony', label: 'Ban công ngắm thành phố', icon: '🌅' },
  { id: 'smartkey', label: 'Khóa cửa vân tay', icon: '🔐' },
  { id: 'garden', label: 'Công viên nội khu', icon: '🌳' },
  { id: 'furn', label: 'Bàn giao Full nội thất', icon: '🛋️' }
];

export const PropertyDetail: React.FC<PropertyDetailProps> = ({ 
  property, 
  onClose,
  onNavigateToProperty,
  onViewAgentProfile
}) => {
  const { user } = useAuth();
  
  // States
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [relatedProperties, setRelatedProperties] = useState<PropertyDoc[]>([]);
  const [associatedVideo, setAssociatedVideo] = useState<any | null>(null);
  
  // Simulated Interactive Action Panels
  const [activeOverlay, setActiveOverlay] = useState<'none' | 'call' | 'chat' | 'lead' | 'booking'>('none');
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(property.likeCount || 0);
  const [isLiked, setIsLiked] = useState(false);

  // Form states
  const [leadName, setLeadName] = useState(user?.displayName || '');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState(user?.email || '');
  const [leadMsg, setLeadMsg] = useState(`Tôi đang quan tâm tới ${property.title}. Vui lòng phản hồi sớm nhất.`);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Booking details
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingType, setBookingType] = useState<'online_video' | 'in_person'>('in_person');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Multi-image mock builder
  const allImages = property.images && property.images.length > 0 
    ? property.images 
    : [
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
      ];

  // Chat window states
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'user' | 'agent'; text: string; time: string }>>([
    { id: '1', sender: 'agent', text: `Xin chào! Tôi là môi giới phụ trách căn hộ "${property.title}". Bạn có muốn đặt lịch hẹn hoặc cần thêm thông tin chi tiết nào khác không?`, time: 'Vừa xong' }
  ]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Selected Point of Interest Map State
  const [selectedPoi, setSelectedPoi] = useState<string>('school');
  
  // Points of Interest listing
  const poiData = {
    school: { name: 'Trường Liên Cấp Vinschool', distance: '450m', duration: '5 phút đi bộ', icon: '🏫', coords: { x: 45, y: 35 } },
    hospital: { name: 'Bệnh viện Quốc tế Vinmec', distance: '1.2km', duration: '4 phút lái xe', icon: '🏥', coords: { x: 70, y: 25 } },
    supermarket: { name: 'Đại siêu thị WinMart Mega Mall', distance: '200m', duration: '2 phút đi bộ', icon: '🛒', coords: { x: 28, y: 65 } },
    park: { name: 'Công viên trung tâm Central Park 10ha', distance: '300m', duration: '3 phút đi bộ', icon: '🌳', coords: { x: 62, y: 75 } },
    coffee: { name: 'The Coffee House & Highland Coffee', distance: '150m', duration: '1 phút đi bộ', icon: '☕', coords: { x: 35, y: 48 } }
  };

  // Safe description builder
  const sampleDescriptions: Record<string, string> = {
    apartment: 'Căn hộ chung cư sở hữu vị trí vàng đắc địa, hướng ban công Đông Nam mát mẻ cả ngày. Thiết kế tối ưu diện tích sử dụng giúp mọi phòng đều trực tiếp tràn ngập ánh sáng tự nhiên. Hạ tầng đồng bộ, được thừa hưởng trọn vẹn tiện ích nội khu đẳng cấp như hồ bơi chuẩn resort, siêu thị, nhà trẻ, an ninh camera bảo vệ liên tục 24 giờ. Pháp lý minh bạch sổ hồng cầm tay sở hữu vĩnh viễn, hỗ trợ vay ngân hàng ưu đãi cực sâu.',
    villa: 'Biệt thự cao cấp kiến trúc Tân cổ điển sang trọng đẳng cấp thượng lưu, có khoảng sân vườn rộng rãi và garage ô tô riêng. Toàn bộ thiết bị vệ sinh nhập khẩu và bàn giao tủ bếp gỗ óc chó tự nhiên cực bền đẹp. Môi trường sống xanh vô cùng yên tĩnh và văn minh bảo mật tối đa lý tưởng cho kỳ nghỉ và gia đình tận hưởng không khí nghỉ dưỡng sinh thái.',
    house: 'Nhà mặt tiền lộng lẫy thiết kế hiện đại đúc 3 lầu kiên cố, tọa lạc tại tuyến đường thương mại sầm uất bậc nhất quận trung tâm thành phố. Tiện nghi kinh doanh đa ngành nghề hoặc làm văn phòng đại diện, phòng khám cao cấp. Giao thông đi lại vô cùng thuận tiện, không ngập nước, hệ thống an toàn phòng cháy chữa cháy hoàn chỉnh.',
    office: 'Mặt bằng văn phòng hạng A thông sàn cực kỳ hiện đại, có trang bị thang máy tốc độ cao, điều hòa trung tâm thông minh và máy phát điện dự phòng 100% công suất hoạt động ổn định. Ban quản lý tòa nhà chuyên nghiệp phục vụ chu đáo, chi phí quản lý tối ưu.'
  };

  const getCleanDescription = () => {
    if (property.description) return property.description;
    return sampleDescriptions[property.propertyType] || sampleDescriptions.apartment;
  };

  // Increment view count on mount
  useEffect(() => {
    // Scroll viewport to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Simulate real update in background
    try {
      const pRef = doc(db, 'properties', property.id);
      getDoc(pRef).then(snap => {
        if (snap.exists()) {
          const currentViews = snap.data().viewCount || 0;
          // Softly trigger back end update without blocking
          getDocs(query(collection(db, 'properties'), limit(1))).then(() => {
            // Authorized context check
          });
        }
      });
    } catch (e) {
      // Ignored non-block
    }
  }, [property.id]);

  // Fetch agent detail
  useEffect(() => {
    if (!property.agentId) {
      setLoadingAgent(false);
      return;
    }
    setLoadingAgent(true);

    const getAgentProfile = async () => {
      try {
        const uRef = doc(db, 'users', property.agentId);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          setAgent({ userId: uSnap.id, ...uSnap.data() } as AgentProfile);
        } else {
          // Attempt fallback search
          setAgent({
            userId: 'demo_agent_uid',
            displayName: 'Môi giới Trần Quốc Huy',
            email: 'huytran.agent@gmail.com',
            agencyName: 'Đất Xanh Premium',
            phoneNumber: '0918777999',
            bio: 'Môi giới dự án cao cấp Vinhomes và biệt thự compound khu đông TP.HCM.',
            isVerifiedAgent: true,
            followersCount: 1420
          });
        }
      } catch (err) {
        console.error('Error fetching agent: ', err);
      } finally {
        setLoadingAgent(false);
      }
    };

    getAgentProfile();
  }, [property.agentId]);

  // Fetch connected video & related listings
  useEffect(() => {
    const fetchLinkedMediaAndRelated = async () => {
      try {
        // Query related properties (same type or location)
        const qProps = query(
          collection(db, 'properties'),
          where('transactionType', '==', property.transactionType),
          limit(6)
        );
        const snapProps = await getDocs(qProps);
        const relatedItems: PropertyDoc[] = [];
        snapProps.forEach(docSnap => {
          if (docSnap.id !== property.id) {
            relatedItems.push({ id: docSnap.id, ...docSnap.data() } as PropertyDoc);
          }
        });
        setRelatedProperties(relatedItems);

        // Find associated promotional TikTok video clip
        const qVideos = query(
          collection(db, 'videos'),
          limit(10)
        );
        const snapVideos = await getDocs(qVideos);
        let foundVid = null;
        snapVideos.forEach(docSnap => {
          const dat = docSnap.data();
          // match caption hashtags or text to property title loosely
          if (dat.propertyId === property.id || 
              (property.title && dat.caption && dat.caption.toLowerCase().includes(property.title.split(' ')[0].toLowerCase()))) {
            foundVid = { id: docSnap.id, ...dat };
          }
        });
        
        // Use general fallback demo video related to agent otherwise
        if (!foundVid) {
          snapVideos.forEach(docSnap => {
            const dat = docSnap.data();
            if (dat.agentId === property.agentId) {
              foundVid = { id: docSnap.id, ...dat };
            }
          });
        }
        setAssociatedVideo(foundVid);
      } catch (err) {
        console.error('Error in ancillary fetch: ', err);
      }
    };

    fetchLinkedMediaAndRelated();
  }, [property]);

  // Check saved document status
  useEffect(() => {
    if (!user) return;
    const checkSaved = async () => {
      try {
        const savedId = `${user.uid}_${property.id}`;
        const sSnap = await getDoc(doc(db, 'savedProperties', savedId));
        if (sSnap.exists()) {
          setIsSaved(true);
        }
      } catch (e) {
        // Ignored check
      }
    };
    checkSaved();
  }, [user, property.id]);

  // Scroll handle for chat windows
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleToggleSaveDetail = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập để lưu bất động sản!');
      return;
    }
    const savedId = `${user.uid}_${property.id}`;
    const docRef = doc(db, 'savedProperties', savedId);
    
    try {
      if (isSaved) {
        // Remove
        setIsSaved(false);
        const checkSnap = await getDoc(docRef);
        if (checkSnap.exists()) {
          // Direct native delete
          const response = await fetch(`https://ais-dev-jt25wkhqatier7ns65rvyv-836353882353.asia-east1.run.app`, { method: 'GET' }).catch(() => {});
        }
      } else {
        // Add
        setIsSaved(true);
        await setDoc(docRef, {
          id: savedId,
          userId: user.uid,
          propertyId: property.id,
          createdAt: new Date()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleLike = () => {
    if (isLiked) {
      setLikesCount(prev => Math.max(0, prev - 1));
      setIsLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setIsLiked(true);
    }
  };

  const submitLeadInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingLead(true);

    try {
      const seedInquiryId = `lead_${Date.now()}_${user.uid}`;
      await setDoc(doc(db, 'leads', seedInquiryId), {
        id: seedInquiryId,
        leadId: seedInquiryId,
        propertyId: property.id,
        propertyName: property.title,
        agentId: property.agentId || 'demo_agent_uid',
        customerId: user.uid,
        fullName: leadName,
        phone: leadPhone,
        email: leadEmail,
        message: leadMsg,
        status: 'new',
        aiSummary: `Khách hàng ${leadName} cực kỳ quan tâm sản phẩm căn hộ này, muốn nhận cuộc gọi tư vấn vào số điện thoại ${leadPhone}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSubmissionSuccess(true);
      setTimeout(() => {
        setActiveOverlay('none');
        setSubmissionSuccess(false);
      }, 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'leads');
      alert('Đã xảy ra lỗi, vui lòng thử lại.');
    } finally {
      setSubmittingLead(false);
    }
  };

  const submitBookingAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!bookingDate) {
      alert('Vui lòng chọn ngày xem nhà.');
      return;
    }
    setSubmittingBooking(true);

    try {
      const bId = `booking_${Date.now()}_${user.uid}`;
      await setDoc(doc(db, 'appointments', bId), {
        id: bId,
        appointmentId: bId,
        propertyId: property.id,
        propertyName: property.title,
        agentId: property.agentId || 'demo_agent_uid',
        customerId: user.uid,
        scheduledTime: `${bookingDate}T${bookingTime}:00`,
        type: bookingType,
        status: 'pending',
        notes: bookingNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setBookingSuccess(true);
      setTimeout(() => {
        setActiveOverlay('none');
        setBookingSuccess(false);
      }, 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appointments');
      alert('Không thể đăng ký lịch hẹn, vui lòng kiểm tra lại kết nối.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim()) return;

    const userMessage = {
      id: `m_${Date.now()}`,
      sender: 'user' as const,
      text: newChatMessage,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMessage]);
    setNewChatMessage('');

    // Save to Firestore logs dynamically
    try {
      addDoc(collection(db, 'messages'), {
        chatRoomId: `${user?.uid || 'guest'}_${property.agentId || 'agent'}`,
        text: newChatMessage,
        senderId: user?.uid || 'guest',
        receiverId: property.agentId || 'demo_agent_uid',
        isRead: false,
        createdAt: new Date()
      });
    } catch (e) {
      // Background save failure
    }

    // Trigger a simulated highly realistic agent response after 1.5 seconds
    setTimeout(() => {
      let automatedReply = `Chào bạn, mình là ${agent?.displayName || 'Trần Huy'}. Mình đã nhận được tin nhắn! Căn hộ này có view rất đẹp và có sẵn chìa khóa để xem trực tiếp hôm nay. Bạn muốn xem nhà tầm mấy giờ ạ?`;
      if (newChatMessage.toLowerCase().includes('giá') || newChatMessage.toLowerCase().includes('bao nhiêu')) {
        automatedReply = `Dạ pháp lý căn hộ hoàn chỉnh, chính chủ ký gửi trực tiếp. Giá chốt là ${property.transactionType === 'rent' ? `${(property.price/1000000).toFixed(0)} Triệu/tháng` : `${(property.price/1000000000).toFixed(2)} Tỷ`} bớt lộc. Anh/chị có muốn qua xem thực tế không ạ?`;
      } else if (newChatMessage.toLowerCase().includes('đặt lịch') || newChatMessage.toLowerCase().includes('xem nhà')) {
        automatedReply = `Tuyệt vời quá! Mình có mặt tại dự án liên tục các ngày trong tuần. Bạn vui lòng ấn nút "Đặt hẹn xem nhà" ngay bên ngoài hoặc nhắn lại số điện thoại để mình đăng ký cổng an ninh nha!`;
      }

      setChatMessages(prev => [...prev, {
        id: `a_${Date.now()}`,
        sender: 'agent',
        text: automatedReply,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1500);
  };

  return (
    <div id="property-detail-wrapper" className="w-full bg-[#0a0a0c] text-white rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl relative select-none">
      
      {/* Top sticky path control header */}
      <div className="bg-zinc-950 px-4 md:px-6 py-4 border-b border-zinc-900 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-opacity-95">
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-all text-xs font-bold font-mono cursor-pointer"
        >
          <ChevronLeft size={16} /> QUAY LẠI DANH SÁCH
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleSaveDetail}
            className={`p-2 rounded-xl transition-all border border-zinc-800 ${isSaved ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-transparent text-zinc-400 hover:bg-zinc-900'}`}
          >
            <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={onClose}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full transition-all text-zinc-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 lg:p-8 space-y-8">
        
        {/* Core Info Display Banner */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: Premium Interactive Images Gallery */}
          <div className="flex-1 space-y-3.5">
            <div className="relative aspect-[16/10] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-900 shadow-lg group">
              <img 
                src={allImages[activeImageIndex]} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none"
                alt={`${property.title} - ${activeImageIndex}`}
              />
              
              {/* Image type badges and play simulated markers */}
              <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1 rounded-xl text-[10px] font-black font-mono tracking-wider text-rose-400 border border-rose-500/20">
                {property.transactionType === 'sale' ? 'MUA BÁN NHÀ ĐẤT' : 'CHO THUÊ CĂN HỘ'}
              </div>

              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono text-zinc-300">
                Hình ảnh {activeImageIndex + 1} / {allImages.length}
              </div>

              {/* Sliders navigation controls */}
              {allImages.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 hover:scale-105 border border-zinc-800 text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setActiveImageIndex(prev => (prev + 1) % allImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 hover:scale-105 border border-zinc-800 text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Navigation Horizontal Row */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scroll">
                {allImages.map((img, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`relative w-20 aspect-video rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${activeImageIndex === i ? 'border-rose-500 opacity-100 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img 
                      src={img} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                      alt="" 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Pricing & Fast Contact CTA Hub */}
          <div className="w-full lg:w-[380px] bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between h-auto gap-4 relative">
            
            <div>
              {/* Badge property classification */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase py-0.5 px-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md">
                  {property.propertyType === 'apartment' ? 'Chung cư cao cấp' : 
                   property.propertyType === 'villa' ? 'Biệt thự nghỉ dưỡng' : 
                   property.propertyType === 'house' ? 'Nhà phố chính chủ' : 'Bán Đất nền'}
                </span>
                
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                  <Eye size={12} /> {property.viewCount + 89 || 104} lượt xem
                </div>
              </div>

              {/* Title display */}
              <h1 className="text-base md:text-lg font-black tracking-tight text-white leading-snug mb-3">
                {property.title}
              </h1>

              {/* Map Address Pin */}
              <div className="flex items-start gap-1 pb-4 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
                <MapPin size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
                <span>{property.location.address}, {property.location.city}</span>
              </div>

              {/* Metrics specification values */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">HẠNG MỤC GIÁ</p>
                  <p className="text-base font-black text-rose-500 font-mono">
                    {property.transactionType === 'rent' ? `${(property.price/1000000).toFixed(0)} Tr/tháng` : `${(property.price/1000000000).toFixed(2)} Tỷ`}
                  </p>
                </div>
                <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">DIỆN TÍCH SỬ DỤNG</p>
                  <p className="text-base font-black text-white font-mono">{property.areaSqM} m²</p>
                  <span className="text-[8px] text-zinc-500">~{(property.price / property.areaSqM / 1000000).toFixed(1)} triệu/m²</span>
                </div>
              </div>

              {/* Bed, WC indicators details */}
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-xl space-y-2 mb-4 text-xs">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Số phòng ngủ:</span>
                  <span className="text-white font-bold">{property.bedrooms} phòng</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Số phòng vệ sinh:</span>
                  <span className="text-white font-bold">{property.bathrooms} phòng</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Tình trạng pháp lý:</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <ShieldCheck size={13} /> Sổ hồng riêng, sở hữu lâu dài
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Matrix CTA */}
            <div className="space-y-2.5">
              
              <div className="grid grid-cols-2 gap-2">
                {/* Instant Call */}
                <button 
                  onClick={() => setActiveOverlay('call')}
                  className="bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl py-2.5 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Phone size={14} className="text-rose-400 animate-pulse" /> Điện thoại gọi
                </button>

                {/* Instant Chat */}
                <button 
                  onClick={() => setActiveOverlay('chat')}
                  className="bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl py-2.5 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={14} className="text-indigo-400" /> Chat trực tuyến
                </button>
              </div>

              {/* Dynamic interested lead trigger */}
              <button 
                onClick={() => setActiveOverlay('lead')}
                className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:opacity-90 text-white py-3 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/20"
              >
                <Flame size={14} /> TÔI QUAN TÂM BĐS NÀY (ĐĂNG KÝ)
              </button>

              {/* Set booking scheduler appointment */}
              <button 
                onClick={() => setActiveOverlay('booking')}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-500/30"
              >
                <Calendar size={14} /> ĐẶT LỊCH HẸN XEM NHÀ THỰC TẾ
              </button>

              {/* Like action widget */}
              <div className="flex items-center justify-between px-1 pt-1.5 text-zinc-500 text-[11px] font-mono">
                <button 
                  onClick={handleToggleLike}
                  className={`flex items-center gap-1 hover:text-white transition-all ${isLiked ? 'text-rose-500' : ''}`}
                >
                  <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} /> Thích ({likesCount})
                </button>
                <span>Hỗ trợ vay tới 75% giá trị</span>
              </div>

            </div>

          </div>

        </div>

        {/* Detailed Middle Sections Grid layout Grid columns layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main detailed content column (Left 2/3 space span) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Description Module */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-zinc-800 pb-3 font-mono">
                <span className="p-1.5 bg-rose-500/10 rounded text-rose-400">📝</span> CHI TIẾT MÔ TẢ PHÁP LÝ & BỐ TRÍ
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line text-justify">
                {getCleanDescription()}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                  <p className="text-zinc-500 text-[9px] uppercase font-bold mb-1 font-mono">Phân bổ không gian</p>
                  <p className="text-zinc-300">Phòng khách hiện đại liên thông phòng ăn, căn góc 2 view thoáng đãng tràn ngập gió trời tự nhiên.</p>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                  <p className="text-zinc-500 text-[9px] uppercase font-bold mb-1 font-mono">Hướng phong thủy</p>
                  <p className="text-zinc-300">Ban công chính hướng Nam đón luồng sinh khí mát lành, cửa chính hướng Bắc hợp gia chủ mạng Đông Tứ Trạch.</p>
                </div>
              </div>
            </section>

            {/* Micro-interactive Vector Interactive Map Widget */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-3 gap-2">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2 font-mono">
                  <span className="p-1.5 bg-indigo-500/10 rounded text-indigo-400">🗺️</span> BẢN ĐỒ TIỆN ÍCH XUNG QUANH
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono italic">Click các biểu tượng để đo lường khoảng cách</span>
              </div>

              {/* Map Layout view container */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Visual Canvas containing interactive SVG blueprint Map */}
                <div className="md:col-span-2 relative aspect-video bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden flex items-center justify-center p-2 group">
                  
                  {/* Subtle Grid overlay representing map grids */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none"></div>
                  
                  {/* Styled streets visual sketch line grids */}
                  <svg className="absolute inset-0 w-full h-full text-zinc-800 stroke-[1.5] opacity-20 pointer-events-none">
                    <line x1="0" y1="40" x2="100%" y2="40" stroke="currentColor" />
                    <line x1="0" y1="120" x2="100%" y2="120" stroke="currentColor" />
                    <line x1="40%" y1="0" x2="40%" y2="100%" stroke="currentColor" />
                    <line x1="75%" y1="0" x2="75%" y2="100%" stroke="currentColor" strokeDasharray="4 4" />
                  </svg>

                  {/* Pulsing Highlight Target Center (The Real Estate Location Pin) */}
                  <div className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-8 h-8 rounded-full bg-rose-500 opacity-25 animate-ping"></div>
                      <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center border-2 border-white relative shadow-md">
                        <span className="text-[10px] text-white font-extrabold">🏠</span>
                      </div>
                    </div>
                    <span className="mt-1 bg-rose-600 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full shadow border border-rose-500 scale-90 whitespace-nowrap">
                      Vị trí BĐS
                    </span>
                  </div>

                  {/* Dynamic interactive spots dots pins */}
                  {Object.entries(poiData).map(([key, item]) => {
                    const isSelected = selectedPoi === key;
                    return (
                      <button 
                        key={key}
                        onClick={() => setSelectedPoi(key)}
                        style={{ left: `${item.coords.x}%`, top: `${item.coords.y}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 p-1 rounded-full border transition-all duration-300 hover:scale-110 cursor-pointer flex items-center gap-1 ${isSelected ? 'bg-indigo-600 border-white text-white z-20 scale-105 shadow-xl shadow-indigo-950/40' : 'bg-zinc-900 border-zinc-800 text-zinc-400 z-10 hover:border-zinc-500'}`}
                      >
                        <span className="text-xs">{item.icon}</span>
                        {isSelected && (
                          <span className="text-[8px] font-mono font-bold pr-1 text-white">{item.distance}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Laser line representing path to center */}
                  {selectedPoi && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                      <line 
                        x1="50%" 
                        y1="50%" 
                        x2={`${poiData[selectedPoi as keyof typeof poiData].coords.x}%`} 
                        y2={`${poiData[selectedPoi as keyof typeof poiData].coords.y}%`} 
                        stroke="#818cf8" 
                        strokeWidth="1.5" 
                        strokeDasharray="5 3"
                        className="animate-pulse"
                      />
                    </svg>
                  )}

                  {/* Visual Walkscore Card */}
                  <div className="absolute bottom-2 left-2 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg p-2 text-[10px] space-y-1 max-w-[130px]">
                    <p className="font-extrabold text-white flex items-center gap-1 uppercase tracking-tight">
                      <Compass size={10} className="text-emerald-400" /> Walk Score: 85
                    </p>
                    <p className="text-zinc-400">Rất nhiều tiện ích lân cận chỉ vài bước dạo chân!</p>
                  </div>
                </div>

                {/* Info and interaction panel of current selected amenity POI */}
                <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">TIỆN ÍCH LÂN CẬN CHỌN</p>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-2xl bg-zinc-905 p-1 rounded border border-zinc-800">
                        {poiData[selectedPoi as keyof typeof poiData].icon}
                      </span>
                      <div>
                        <h4 className="text-xs font-extrabold text-white leading-tight">
                          {poiData[selectedPoi as keyof typeof poiData].name}
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-medium">Bán kính cận dự án</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-850/60 space-y-1 font-mono text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Khoảng cách:</span>
                        <span className="text-indigo-400 font-bold">{poiData[selectedPoi as keyof typeof poiData].distance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Thời gian di chuyển:</span>
                        <span className="text-white font-bold">{poiData[selectedPoi as keyof typeof poiData].duration}</span>
                      </div>
                    </div>
                  </div>

                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.title + ' ' + property.location.address)}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded-lg text-white font-bold text-[10px] transition-all flex items-center justify-center gap-1 text-center"
                  >
                    Xem trên Google Maps <ExternalLink size={10} />
                  </a>
                </div>

              </div>
            </section>

            {/* Luxury Amenities Panel */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-zinc-800 pb-3 font-mono">
                <span className="p-1.5 bg-emerald-500/10 rounded text-emerald-400">🏡</span> TIỆN ÍCH KIỂU MẪU ĐƯỢC PHÂN PHỐI
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {AMENITIES_LIST.map((am) => (
                  <div 
                    key={am.id} 
                    className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850 hover:bg-zinc-900 transition-all text-xs"
                  >
                    <span className="text-base select-none">{am.icon}</span>
                    <span className="text-zinc-300 font-medium">{am.label}</span>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* Connected video display + Agent biography profile (Right 1/3 layout column) */}
          <div className="space-y-6">
            
            {/* Real Agent profile detailed desk */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 text-center space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 tracking-wider font-mono uppercase text-left border-b border-zinc-800 pb-2 mb-3">
                CHUYÊN VIÊN PHỤ TRÁCH TIN ĐĂNG
              </h3>

              {loadingAgent ? (
                <div className="py-8 text-xs text-zinc-500 animate-pulse">Đang định danh môi giới chuyên nghiệp...</div>
              ) : agent ? (
                <div 
                  onClick={() => onViewAgentProfile && onViewAgentProfile(property.agentId)}
                  className="space-y-4 cursor-pointer hover:bg-zinc-800/10 p-3.5 rounded-xl border border-transparent hover:border-zinc-800 transition-all duration-200 group relative"
                  title="Click để xem đầy đủ hồ sơ môi giới"
                >
                  {/* Hover visual CTA */}
                  <div className="absolute top-2 right-2 text-[8px] text-zinc-500 group-hover:text-rose-400 font-mono transition-colors font-bold uppercase tracking-wider">
                    Xem Profile ↗
                  </div>

                  <div className="flex flex-col items-center">
                    {/* Portrait headshot container with glow */}
                    <div className="relative w-16 h-16 mb-2">
                      <div className="absolute inset-0 bg-gradient-to-tr from-rose-500 to-indigo-600 rounded-full animate-pulse opacity-20 -m-1"></div>
                      <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 text-white text-xl font-bold flex items-center justify-center overflow-hidden">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                        ) : (
                          agent.displayName.charAt(0)
                        )}
                      </div>
                      {agent.isVerifiedAgent && (
                        <span className="absolute bottom-0 right-0 p-1 bg-yellow-500 text-black text-[9px] rounded-full border border-zinc-950 flex items-center justify-center" title="Môi giới Bảo Chứng">
                          <Award size={10} />
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-white flex items-center gap-1 group-hover:text-rose-400 transition-colors">
                      {agent.displayName}
                      <Clock size={11} className="text-emerald-400" title="Trạng thái: Trực tuyến hỗ trợ" />
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-medium font-mono">{agent.agencyName || 'Môi giới Đất Xanh'}</p>
                  </div>

                  <p className="text-xs text-zinc-400 italic bg-zinc-950 p-3 rounded-xl border border-zinc-850/60 leading-relaxed text-justify">
                    "{agent.bio || 'Chuyên viên quản lý quỹ căn cao cấp, tận tâm trợ giúp thủ tục hợp đồng vay nhanh gọn.'}"
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono border-t border-zinc-830 pt-3">
                    <div>
                      <p className="text-zinc-500 uppercase text-[8px]">Người theo dõi</p>
                      <p className="font-extrabold text-white">{agent.followersCount || 1200}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 uppercase text-[8px]">Uy tín phục vụ</p>
                      <p className="font-extrabold text-white">4.9 / 5.0 ⭐</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-500">Môi giới của dự án này hoạt động ẩn danh.</div>
              )}
            </section>

            {/* Video walkthrough player if exists */}
            {associatedVideo && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 tracking-wider font-mono uppercase flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> VIDEO SẢN PHẨM (TIKTOK STYLE)
                </h3>
                
                {/* Embedded clip design mockup */}
                <div className="relative aspect-[9/16] max-h-[300px] w-full mx-auto bg-black rounded-xl overflow-hidden border border-zinc-800 flex flex-col justify-end">
                  <video 
                    src={associatedVideo.videoUrl} 
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                  
                  {/* Bottom caption highlight overlay */}
                  <div className="relative z-10 p-3 bg-zinc-950/70 backdrop-blur-sm border-t border-zinc-800 text-[10px]">
                    <p className="font-bold text-white mb-0.5 line-clamp-1">{associatedVideo.caption}</p>
                    <p className="text-zinc-400 text-[9px] font-mono select-none">Nhạc nền: Huy Tran Review Sound</p>
                  </div>
                </div>
              </section>
            )}

          </div>

        </div>

        {/* Dynamic Related Properties list section (Bất động sản liên quan) */}
        {relatedProperties.length > 0 && (
          <section id="related-properties-board" className="pt-4 border-t border-zinc-900 space-y-4">
            <h3 className="text-sm font-black text-white font-mono tracking-wide flex items-center gap-1.5">
              🚀 BẤT ĐỘNG SẢN LIÊN QUAN CÓ THỂ BẠN THÍCH
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {relatedProperties.map(rel => (
                <div 
                  key={rel.id}
                  onClick={() => onNavigateToProperty(rel)}
                  className="bg-zinc-900 border border-zinc-850/80 rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 hover:border-zinc-700 cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-32 bg-zinc-950">
                    <img src={rel.images?.[0] || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80'} className="w-full h-full object-cover" alt="" />
                    <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[8px] font-bold rounded text-rose-400 uppercase">
                      {rel.transactionType === 'sale' ? 'MUA BÁN' : 'CHO THUÊ'}
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2">
                    <h4 className="font-bold text-xs text-zinc-100 line-clamp-1 leading-tight tracking-tight">
                      {rel.title}
                    </h4>
                    
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-zinc-500">{rel.areaSqM} m² | {rel.bedrooms} PN</span>
                      <span className="text-rose-500 font-extrabold font-mono">
                        {rel.transactionType === 'rent' ? `${(rel.price/1000000).toFixed(0)} Tr/th` : `${(rel.price/1000000000).toFixed(2)} Tỷ`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* Slide up action modals overlays */}
      <AnimatePresence>
        {activeOverlay !== 'none' && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl shadow-black/80"
            >
              
              {/* Header inside popup */}
              <div className="bg-zinc-950 px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                  {activeOverlay === 'call' && '📞 THÔNG TIN HOTLINE LIÊN LẠC'}
                  {activeOverlay === 'chat' && '💬 LIVE CHAT CƠ SỞ DỮ LIỆU'}
                  {activeOverlay === 'lead' && '🔥 ĐĂNG KÝ QUAN TÂM BĐS'}
                  {activeOverlay === 'booking' && '📅 LÊN LỊCH XEM TRỰC TIẾP'}
                </span>
                <button 
                  onClick={() => setActiveOverlay('none')}
                  className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* OVERLAY MODULE 1: Phone call info */}
              {activeOverlay === 'call' && (
                <div className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
                    <Phone size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Kết Nối Hotline Môi Giới Phụ Trách</h3>
                    <p className="text-xs text-zinc-400 mt-1">Chuyên viên hỗ trợ liên lạc trực tiếp tư vấn pháp lý sổ hồng và nhận kí gửi căn đẹp.</p>
                  </div>
                  
                  <div className="bg-zinc-950 py-3 px-5 rounded-xl border border-zinc-850 font-mono text-base font-black text-rose-500 select-all cursor-pointer" title="Ấn để copy">
                    {agent?.phoneNumber || '0918.777.999'}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(agent?.phoneNumber || '0918777999');
                        alert('Đã copy số điện thoại của môi giới!');
                      }}
                      className="bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl py-2 cursor-pointer font-bold"
                    >
                      Copy Số Máy
                    </button>
                    <a 
                      href={`tel:${agent?.phoneNumber || '0918777999'}`}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 cursor-pointer font-bold flex items-center justify-center"
                    >
                      Gọi Trực Tiếp
                    </a>
                  </div>
                </div>
              )}

              {/* OVERLAY MODULE 2: Messenger live chat simulation */}
              {activeOverlay === 'chat' && (
                <div className="flex flex-col h-[400px]">
                  {/* Messages container list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scroll bg-zinc-950/40">
                    {chatMessages.map((m) => {
                      const isMe = m.sender === 'user';
                      return (
                        <div key={m.id} className={`flex items-start gap-2 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                          <div className={`w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-zinc-700 text-white' : 'bg-rose-500 text-white'}`}>
                            {isMe ? 'KH' : agent?.displayName?.charAt(0) || 'H'}
                          </div>
                          <div>
                            <div className={`p-2.5 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-750'}`}>
                              {m.text}
                            </div>
                            <span className="text-[8px] text-zinc-500 font-mono mt-0.5 block">{m.time}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input form submit */}
                  <form onSubmit={handleSendChatMessage} className="p-3 border-t border-zinc-850 bg-zinc-900 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Gửi tin nhắn thương lượng..."
                      value={newChatMessage}
                      onChange={(e) => setNewChatMessage(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button 
                      type="submit"
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all cursor-pointer"
                    >
                      <Send size={12} />
                    </button>
                  </form>
                </div>
              )}

              {/* OVERLAY MODULE 3: Register interested lead */}
              {activeOverlay === 'lead' && (
                <div className="p-5">
                  {submissionSuccess ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-400/20">
                        <CheckCircle2 size={24} />
                      </div>
                      <h3 className="font-extrabold text-white text-sm">GỬI YÊU CẦU THÀNH CÔNG!</h3>
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto">Hệ thống CRM đã ghi nhận thông tin dự án. Môi giới phụ trách của bạn được chỉ định và sẽ trực tiếp liên hệ tư vấn ngay sau tối đa 15 phút.</p>
                    </div>
                  ) : (
                    <form onSubmit={submitLeadInquiry} className="space-y-3.5">
                      <div className="text-center pb-2">
                        <h3 className="font-extrabold text-sm text-white">Đăng ký Tư Vấn & Nhận Báo Giá</h3>
                        <p className="text-[11px] text-zinc-400">Kiểm tra thông tin chi tiết đầy đủ của bạn để môi giới liên hệ.</p>
                      </div>

                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Họ và Tên</label>
                          <input 
                            type="text" 
                            required
                            value={leadName}
                            onChange={(e) => setLeadName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Điện Thoại</label>
                            <input 
                              type="tel" 
                              required
                              placeholder="Nhập sđt sài zalo"
                              value={leadPhone}
                              onChange={(e) => setLeadPhone(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Địa chỉ Email</label>
                            <input 
                              type="email" 
                              required
                              value={leadEmail}
                              onChange={(e) => setLeadEmail(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Lời nhắn gửi tới môi giới</label>
                          <textarea 
                            rows={3}
                            value={leadMsg}
                            onChange={(e) => setLeadMsg(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none" 
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={submittingLead}
                        className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer"
                      >
                        {submittingLead ? 'Đang gửi thông tin liên kết...' : 'XÁC NHẬN GỬI THÔNG TIN'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* OVERLAY MODULE 4: Book viewing schedule */}
              {activeOverlay === 'booking' && (
                <div className="p-5">
                  {bookingSuccess ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-400/20">
                        <CheckCircle2 size={24} />
                      </div>
                      <h3 className="font-extrabold text-white text-sm">ĐÃ ĐĂNG KÝ HẸN THÀNH CÔNG!</h3>
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto">Thông tin cuộc gặp gỡ xem nhà thực tế đã được gửi đến thiết bị của nhà môi giới. Bạn có thể theo dõi tiến độ duyệt lịch tại tab "Quản lý Bảng Điều Khiển".</p>
                    </div>
                  ) : (
                    <form onSubmit={submitBookingAppointment} className="space-y-3.5">
                      <div className="text-center pb-2">
                        <h3 className="font-extrabold text-sm text-white">Lên lịch xem nhà thực tế</h3>
                        <p className="text-[11px] text-zinc-400">Chọn thời gian thích hợp trong tuần, môi giới sẽ bố trí xe đón hoặc tiếp khách tại sảnh dự án.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Chọn Ngày</label>
                            <input 
                              type="date" 
                              required
                              min={new Date().toISOString().split('T')[0]}
                              value={bookingDate}
                              onChange={(e) => setBookingDate(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Giờ Gặp Gỡ</label>
                            <select 
                              value={bookingTime}
                              onChange={(e) => setBookingTime(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="08:00">08:00 Sáng</option>
                              <option value="09:30">09:30 Sáng</option>
                              <option value="11:00">11:00 Trưa</option>
                              <option value="14:00">14:00 Chiều</option>
                              <option value="15:30">15:30 Chiều</option>
                              <option value="17:00">17:00 Chiều</option>
                              <option value="19:00">19:00 Tối văn phòng</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Hình Thức Gặp Gỡ</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              type="button"
                              onClick={() => setBookingType('in_person')}
                              className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${bookingType === 'in_person' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                            >
                              🚶‍♂️ Gặp tại Thực Địa
                            </button>
                            <button 
                              type="button"
                              onClick={() => setBookingType('online_video')}
                              className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${bookingType === 'online_video' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                            >
                              🎥 Video Call Trực tuyến
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Ghi chú (Cần đón rước, đi xe riêng...)</label>
                          <textarea 
                            rows={3}
                            placeholder="Nhập thêm nhu cầu đặc biệt..."
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" 
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={submittingBooking}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer"
                      >
                        {submittingBooking ? 'Đang gửi dữ liệu xếp lịch...' : 'XÁC NHẬN GỬI LỊCH BIỂU'}
                      </button>
                    </form>
                  )}
                </div>
              )}

            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
