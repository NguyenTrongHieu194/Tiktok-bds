import { 
  collection, doc, getDocs, setDoc, addDoc, query, where, orderBy, 
  limit, startAfter, deleteDoc, runTransaction, getDoc, updateDoc, 
  increment, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { PropertyDoc, VideoDoc, CommentDoc } from '../types/tiktok';

// Local Mock Data of elegant properties & TikTok-style vertical videos 
export const MOCK_PROPERTIES: PropertyDoc[] = [
  {
    id: "prop_dalat_villa",
    agentId: "agent_minh_quan",
    title: "Biệt thự Luxury View Đồi Thông Đà Lạt",
    price: 18500, // 18.5 Billion VND
    priceFormatted: "18.5 Tỷ",
    transactionType: "sale",
    propertyType: "villa",
    bedrooms: 5,
    bathrooms: 6,
    areaSqM: 350,
    images: [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800"
    ],
    status: "available",
    location: {
      address: "Đường Khởi Nghĩa Bắc Sơn, Phường 10",
      city: "Đà Lạt",
      ward: "Phường 10",
      district: "TP. Đà Lạt"
    },
    description: "Siêu biệt thự nghỉ dưỡng tọa lạc đỉnh đồi thông, view bao trọn thung lũng sương mù Đà Lạt. Thiết kế kính tràn hiện đại đón trọn ánh sáng tự nhiên, bể bơi vô cực nước ấm độc bản, nội thất nhập khẩu Ý đẳng cấp.",
    viewCount: 14200,
    likeCount: 840
  },
  {
    id: "prop_thaodien_penthouse",
    agentId: "agent_thu_hang",
    title: "Penthouse Thông Tầng Thảo Điền Quận 2 Marina",
    price: 32000, // 32 Billion VND
    priceFormatted: "32 Tỷ",
    transactionType: "sale",
    propertyType: "apartment",
    bedrooms: 4,
    bathrooms: 5,
    areaSqM: 280,
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&q=80&w=800"
    ],
    status: "available",
    location: {
      address: "Xuan Thuy Road, Thảo Điền",
      city: "Hồ Chí Minh",
      ward: "Thảo Điền",
      district: "Quận 2"
    },
    description: "Căn hộ Penthouse cực thượng hoàng gia với tầm view ngắm sông Sài Gòn và Landmark 81 đắt giá. Có thang máy riêng biệt, bể bơi trời tràn bờ và sân vườn riêng lên tới 60m² lý tưởng cho những bữa tiệc BBQ xa hoa.",
    viewCount: 9540,
    likeCount: 620
  },
  {
    id: "prop_studio_vinhomes",
    agentId: "agent_khanh_vy",
    title: "Căn Hộ Studio Cao Cấp Landmark 81 Vinhomes",
    price: 15, // 15M VND/month
    priceFormatted: "15 Triệu/tháng",
    transactionType: "rent",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    areaSqM: 45,
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800"
    ],
    status: "available",
    location: {
      address: "208 Nguyễn Hữu Cảnh, Phường 22",
      city: "Hồ Chí Minh",
      ward: "Phường 22",
      district: "Bình Thạnh"
    },
    description: "Căn hộ dịch vụ tiện nghi đầy đủ chuẩn 5 sao tại tháp Landmark 81 kiêu hãnh. Hệ sinh thái hoàn hảo: gym công nghệ, bể bơi bơi bốn mùa ngoài trời, rạp chiếu phim sang trọng, mua sắm ẩm thực ngay bên dưới tòa nhà.",
    viewCount: 6810,
    likeCount: 310
  },
  {
    id: "prop_shophouse_grandpark",
    agentId: "agent_minh_quan",
    title: "Shophouse Block Origami Trục Đường Chính 24m",
    price: 14200, // 14.2 Billion VND
    priceFormatted: "14.2 Tỷ",
    transactionType: "sale",
    propertyType: "house",
    bedrooms: 4,
    bathrooms: 4,
    areaSqM: 120,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800"
    ],
    status: "available",
    location: {
      address: "Phân khu Origami, Vinhomes Grand Park",
      city: "Hồ Chí Minh",
      ward: "Long Thạnh Mỹ",
      district: "Quận 9 (TP. Thủ Đức)"
    },
    description: "Nhà phố thương mại Shophouse Origami 1 trệt 4 lầu nằm ngay trục giao thông sầm uất nhất. Vị trí vàng kết nối trực tiếp công viên 36ha châu Á, vỉa hè rộng 6m để xe thoải mái, thích hợp để ở kết hợp kinh doanh spa, ngân hàng, Highland.",
    viewCount: 11050,
    likeCount: 490
  },
  {
    id: "prop_skyvilla_serene",
    agentId: "agent_thu_hang",
    title: "Sky Villa Duplex Đỉnh Cao Thượng Lưu Serene",
    price: 45000, // 45 Billion VND
    priceFormatted: "45 Tỷ",
    transactionType: "sale",
    propertyType: "villa",
    bedrooms: 4,
    bathrooms: 5,
    areaSqM: 320,
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800"
    ],
    status: "available",
    location: {
      address: "Đông Tây Đại lộ ngắm sông, Quận 1",
      city: "Hồ Chí Minh",
      ward: "Bến Nghé",
      district: "Quận 1"
    },
    description: "Biệt thự trên không - Sky Villa siêu cao cấp với thiết kế của các kiến trúc sư Singapore lừng danh. Tầm nhìn panorama 270 độ không giới hạn ra bến du thuyền và sông Sài Gòn thơ mộng, mang đến cuộc sống đẳng cấp đầy riêng tư.",
    viewCount: 18230,
    likeCount: 978
  }
];

export const MOCK_VIDEOS: VideoDoc[] = [
  {
    id: "vid_dalat_villa",
    agentId: "agent_minh_quan",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-luxury-resort-or-hotel-swimming-pool-and-lounge-area-41713-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&q=80&w=500",
    caption: "#DalatVilla Biệt thự nghỉ dưỡng 18.5 Tỷ đỉnh cao tại đồi thông mộng mơ. Bể bơi nước ấm độc bản tràn view, anh chị thích ngắm sương sớm ghé đây nhé! 🌲🏡 #bdsdalat #bietthudep #reviewbds",
    likesCount: 840,
    commentsCount: 124,
    sharesCount: 95,
    viewCount: 14200,
    aiTranscript: "Xin chào mọi người! Hôm nay Quân sẽ đưa các bạn đi khám phá một kiệt tác biệt thự nghỉ dưỡng Đà Lạt. Tọa lạc ngay trên một đỉnh đồi đắc địa, căn biệt thự này sở hữu diện tích đất 350m2 với cấu trúc 5 phòng ngủ hoàng gia và hệ thống kính tràn sương mù tuyệt mỹ. Điểm đặc biệt nhất chính là chiếc bể bơi bốn mùa nước ấm ngoài trời, vừa ngâm mình thư thái vừa ôm trọn thung lũng Đà Lạt thơ mộng trong tầm mắt. Hãy xem chi tiết bên dưới ngay nhé!",
    aiTags: ["Biệt thự nghỉ dưỡng", "Hồ nước ấm", "View thung lũng", "Đà Lạt thơ mộng", "BĐS Cao Cấp"],
    status: "published",
    propertyId: "prop_dalat_villa",
    agentName: "Trần Minh Quân",
    agentAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
    agentPhone: "0901 234 567"
  },
  {
    id: "vid_thaodien_penthouse",
    agentId: "agent_thu_hang",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-view-41712-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=500",
    caption: "Chiêm ngưỡng Penthouse 32 Tỷ thông tầng đẳng cấp bậc nhất Thảo Điền Q2. Toàn cảnh sông Sài Gòn lung linh về đêm. ✨🏙️ #luxuryliving #penthouse #thaodien #reviewnha",
    likesCount: 620,
    commentsCount: 86,
    sharesCount: 52,
    viewCount: 9540,
    aiTranscript: "Hằng đang đứng tại căn Penthouse Duplex bàn giao thô phân khúc siêu sang tại Thảo Điền. Với 4 phòng ngủ lớn, tất cả các cánh cửa cao từ sàn đến trần đều hướng trực diện về phía sông Sài Gòn lộng gió. Đặc biệt, khu vực sân vườn trời lên tới 60m2 được thiết kế sẵn hồ jacuzzi thủy lực vô cùng sang chảnh. Đây chính là biểu tượng thành đạt đích thực của giới thượng lưu quý tộc Sài Thành.",
    aiTags: ["Penthouse Duplex", "Thảo Điền Quận 2", "Hồ Jacuzzi", "View Landmark81", "View sông"],
    status: "published",
    propertyId: "prop_thaodien_penthouse",
    agentName: "Lê Thu Hằng",
    agentAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
    agentPhone: "0988 777 999"
  },
  {
    id: "vid_studio_vinhomes",
    agentId: "agent_khanh_vy",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-luxury-living-room-interior-design-41714-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=500",
    caption: "#Rent Studio xịn sò Vinhomes Landmark 81 giá chỉ 15 Triệu/tháng đầy đủ dịch vụ 5 sao. Nội thất thông minh, dọn vào ở ngay! 🔑🛋️ #vinhomes #bdsbinhthanh #thuenhaxin",
    likesCount: 310,
    commentsCount: 45,
    sharesCount: 18,
    viewCount: 6810,
    aiTranscript: "Vy xin mến chào cả nhà nhé! Hôm nay Vy mang đến một cơ hội thuê phòng cực kỳ hot tại trái tim Landmark 81. Studio diện tích gọn gàng 45m2 nhưng được trang bị hệ thống Smart Home điều khiển giọng nói tiên tiến, nội thất tone gỗ trầm ấm phong cách tối giản Bắc Âu vô cùng ấm cúng. Tiện ích hồ bơi và khu dạo bộ công viên Vinhomes rộng 14ha hoàn toàn miễn phí nha cả nhà ơi!",
    aiTags: ["Studio thông minh", "Landmark 81", "Giá siêu hời", "Nội thất Bắc Âu", "Vinhomes Central Park"],
    status: "published",
    propertyId: "prop_studio_vinhomes",
    agentName: "Nguyễn Khánh Vy",
    agentAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150",
    agentPhone: "0934 999 888"
  },
  {
    id: "vid_shophouse_grandpark",
    agentId: "agent_minh_quan",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-beautiful-swimming-pool-inside-a-large-property-41715-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=500",
    caption: "Mở bán Shophouse Origami Vinhomes Quận 9 vị trí đắc địa kinh doanh sầm uất. Thích hợp kinh doanh mọi ngành nghề! 💼🏬 #shophouse #origami #vinhomesgrandpark",
    likesCount: 490,
    commentsCount: 63,
    sharesCount: 34,
    viewCount: 11050,
    aiTranscript: "Chào các anh chị nhà đầu tư! Shophouse Origami chính là mảnh ghép đầu tư sinh lời an toàn nhất tại thời điểm hiện tại. Trục đại lộ Anh Đào 24m, lượng cư dân qua lại đông đúc hàng vạn lượt mỗi ngày. Kết cấu 1 trệt 4 lầu với bề ngang mặt tiền rộng rãi lên đến 6m, rất lý tưởng làm văn phòng đại diện, phòng khám nhi, spa cao cấp hoặc nhượng quyền cafe. Liên hệ Quân để đi xem thực tế căn góc nhé!",
    aiTags: ["Shophouse thương mại", "Trục chính 24m", "Origami Quận 9", "Cơ hội đầu tư", "Vinhomes"],
    status: "published",
    propertyId: "prop_shophouse_grandpark",
    agentName: "Trần Minh Quân",
    agentAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
    agentPhone: "0901 234 567"
  },
  {
    id: "vid_skyvilla_serene",
    agentId: "agent_thu_hang",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-looking-up-at-modern-skyscrapers-in-a-city-40013-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&q=80&w=500",
    caption: "Duplex Sky Villa triệu đô ngự trị trái tim Quận 1 ngắm trọn sông Sài Gòn. Độc nhất vô nhị cho 1% giới tinh hoa! 💎🌉 #skyvilla #duplexq1 #luxuryrealestate #sunsetview",
    likesCount: 978,
    commentsCount: 201,
    sharesCount: 147,
    viewCount: 18230,
    aiTranscript: "Quý vị thân mến, đây là tuyệt tác Sky Villa Duplex rộng 320m2 nằm ngay tầng cao nhất của tháp Serene Quận 1. Với chiều cao thông tầng phòng khách 7 mét mang đến một không gian thoáng đãng đỉnh cao như cung điện. Toàn bộ nội thất kim loại và sofa da bò tót đều được đo đạc đặt trước tại Đức. Bàn giao đầy đủ chìa khóa thông minh, đặc quyền tiếp khách sang xịn tại phòng rượu vang câu lạc bộ VIP.",
    aiTags: ["Sky Villa thông tầng", "Phòng khách 7m", "Bến du thuyền Quận 1", "Dành cho giới thượng lưu", "Biệt thự trên không"],
    status: "published",
    propertyId: "prop_skyvilla_serene",
    agentName: "Lê Thu Hằng",
    agentAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
    agentPhone: "0988 777 999"
  }
];

export const MOCK_COMMENTS: Record<string, CommentDoc[]> = {
  "vid_dalat_villa": [
    {
      id: "comment_1",
      videoId: "vid_dalat_villa",
      userId: "user_lam_minh",
      userName: "Lâm Minh",
      userAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100",
      text: "Đẹp xuất sắc quá em ơi, đồi thông thơ mộng thực sự. Có hỗ trợ vay ngân hàng bao nhiêu phần trăm hả Quân?",
      createdAt: new Date(Date.now() - 3600000 * 2)
    },
    {
      id: "comment_2",
      videoId: "vid_dalat_villa",
      userId: "user_ngoc_lan",
      userName: "Ngọc Lan Nguyễn",
      userAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=100",
      text: "Cái bể bơi vô cực ngắm thung lũng sương tuyệt đỉnh ghê! Ước gì được tới đây ngắm hoàng hôn Đà Lạt.",
      createdAt: new Date(Date.now() - 3600000 * 5)
    }
  ],
  "vid_thaodien_penthouse": [
    {
      id: "comment_3",
      videoId: "vid_thaodien_penthouse",
      userId: "user_huy_hoang",
      userName: "Huy Hoàng Realty",
      userAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=100",
      text: "Penthouse Thảo Điền view sông lúc nào cũng đẳng cấp đẳng sang trọng nhất rồi. Khách của anh rất thích vị thế này.",
      createdAt: new Date(Date.now() - 3600000 * 12)
    }
  ]
};

export const tiktokService = {
  /**
   * Helper to seed original mock data to Firestore collections to ensure real-world app compilation
   */
  async seedInitialDataIfDocsEmpty() {
    try {
      const q = query(collection(db, 'videos'), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        console.log("Firebase already contains data. Skipping seed.");
        return;
      }
      
      console.log("Firestore is empty. Seeding initial beautiful Properties and TikTok videos!");
      
      const batch = writeBatch(db);
      
      // Save properties
      for (const prop of MOCK_PROPERTIES) {
        const propRef = doc(db, 'properties', prop.id);
        batch.set(propRef, {
          ...prop,
          createdAt: serverTimestamp()
        });
      }
      
      // Save videos
      for (const vid of MOCK_VIDEOS) {
        const vidRef = doc(db, 'videos', vid.id);
        batch.set(vidRef, {
          ...vid,
          createdAt: serverTimestamp()
        });
      }
      
      // Seed some comments
      for (const [vidId, commentList] of Object.entries(MOCK_COMMENTS)) {
        for (const comment of commentList) {
          const commentRef = doc(db, 'comments', comment.id);
          batch.set(commentRef, {
            ...comment,
            createdAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      console.log("Firestore successfully bootstrapped with premium Real Estate TikTok feed database!");
    } catch (err) {
      console.warn("Failed to seed initial Firestore data (might be security rules blocked/unauthenticated yet):", err);
    }
  },

  /**
   * Fetches video feed from Firestore safely, falls back to rich Mock Data on empty/errors
   */
  async getVideosFeed(lastDocSnap: any = null, limitCount: number = 5): Promise<{ videos: VideoDoc[]; lastDoc: any; totalCount: number }> {
    try {
      const videosCollection = collection(db, 'videos');
      let fbQuery;
      
      if (lastDocSnap) {
        fbQuery = query(
          videosCollection,
          where('status', '==', 'published'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocSnap),
          limit(limitCount)
        );
      } else {
        fbQuery = query(
          videosCollection,
          where('status', '==', 'published'),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
      }
      
      const snapshot = await getDocs(fbQuery).catch((err) => {
        // Safe catch for Firestore initialization / Security Rules block
        console.warn("Firestore collection fetching threw error or blocked. Triaging fallback to robust mock data.", err);
        return null;
      });

      if (!snapshot || snapshot.empty) {
        // Fallback to offline mock data when Firebase is empty or permissions missing
        console.log("Returning high fidelity fallback mock properties & video models.");
        return {
          videos: MOCK_VIDEOS,
          lastDoc: null,
          totalCount: MOCK_VIDEOS.length
        };
      }

      const videos: VideoDoc[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        videos.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as VideoDoc);
      });

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      return {
        videos,
        lastDoc: lastVisible,
        totalCount: videos.length
      };
    } catch (error) {
      console.warn("getVideosFeed encountered error, falling back to static mock database.", error);
      return {
        videos: MOCK_VIDEOS,
        lastDoc: null,
        totalCount: MOCK_VIDEOS.length
      };
    }
  },

  /**
   * Gets specific property detail tied to a TikTok Video overlay
   */
  async getPropertyById(propertyId: string): Promise<PropertyDoc | null> {
    try {
      const docRef = doc(db, 'properties', propertyId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          id: snapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as PropertyDoc;
      }
      
      // Fallback
      const localProp = MOCK_PROPERTIES.find(p => p.id === propertyId);
      return localProp || null;
    } catch (error) {
      const localProp = MOCK_PROPERTIES.find(p => p.id === propertyId);
      return localProp || null;
    }
  },

  /**
   * Liking/unliking full logic with transactions/increments
   */
  async toggleLikeVideo(videoId: string, userId: string, isCurrentlyLiked: boolean): Promise<boolean> {
    if (!userId) throw new Error("Thao tác yêu cầu đăng nhập tài khoản!");
    
    const likeDocId = `${userId}_${videoId}`;
    const likeRef = doc(db, 'likes', likeDocId);
    const videoRef = doc(db, 'videos', videoId);
    
    try {
      if (isCurrentlyLiked) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(videoRef, {
          likesCount: increment(-1)
        }).catch(() => {});
        return false;
      } else {
        // Like
        await setDoc(likeRef, {
          likeId: likeDocId,
          userId,
          targetId: videoId,
          targetType: 'video',
          createdAt: serverTimestamp()
        });
        await updateDoc(videoRef, {
          likesCount: increment(1)
        }).catch(() => {});
        return true;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `likes/${likeDocId}`);
      return !isCurrentlyLiked;
    }
  },

  /**
   * Bookmarking/saving/unsaving complete logic
   */
  async toggleBookmarkProperty(propertyId: string, userId: string, isCurrentlyBookmarked: boolean): Promise<boolean> {
    if (!userId) throw new Error("Thao tác yêu cầu đăng nhập tài khoản!");
    
    const savedDocId = `${userId}_${propertyId}`;
    const savedRef = doc(db, 'savedProperties', savedDocId);
    
    try {
      if (isCurrentlyBookmarked) {
        // Unsave
        await deleteDoc(savedRef);
        return false;
      } else {
        // Save
        await setDoc(savedRef, {
          savedId: savedDocId,
          userId,
          propertyId,
          createdAt: serverTimestamp()
        });
        return true;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `savedProperties/${savedDocId}`);
      return !isCurrentlyBookmarked;
    }
  },

  /**
   * Following/unfollowing complete logic
   */
  async toggleFollowAgent(agentId: string, userId: string, isCurrentlyFollowing: boolean): Promise<boolean> {
    if (!userId) throw new Error("Thao tác yêu cầu đăng nhập tài khoản!");
    
    const followDocId = `${userId}_${agentId}`;
    const followRef = doc(db, 'followers', followDocId);
    
    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        await deleteDoc(followRef);
        return false;
      } else {
        // Follow
        await setDoc(followRef, {
          followerId: followDocId,
          followerUid: userId,
          followedUid: agentId,
          createdAt: serverTimestamp()
        });
        return true;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `followers/${followDocId}`);
      return !isCurrentlyFollowing;
    }
  },

  /**
   * Submits a comments on a specific Tiktok Video
   */
  async addComment(videoId: string, userId: string, userName: string, userAvatar: string, text: string): Promise<CommentDoc> {
    if (!userId) throw new Error("Vui lòng đăng nhập để bình luận!");
    if (!text.trim()) throw new Error("Nội dung không thể để trống!");

    const commentRef = doc(collection(db, 'comments'));
    const commentId = commentRef.id;
    const commentData = {
      commentId,
      videoId,
      userId,
      userName,
      userAvatar: userAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100",
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(commentRef, commentData);
      
      const videoRef = doc(db, 'videos', videoId);
      await updateDoc(videoRef, {
        commentsCount: increment(1)
      }).catch(() => {});

      return {
        id: commentId,
        videoId,
        userId,
        userName,
        userAvatar: commentData.userAvatar,
        text,
        createdAt: new Date()
      };
    } catch (error) {
      // Offline/Error recovery
      return {
        id: commentId || Math.random().toString(),
        videoId,
        userId,
        userName,
        userAvatar: commentData.userAvatar,
        text,
        createdAt: new Date()
      };
    }
  },

  /**
   * Fetches comment lists
   */
  async getComments(videoId: string): Promise<CommentDoc[]> {
    try {
      const commentsCollection = collection(db, 'comments');
      const fbQuery = query(
        commentsCollection,
        where('videoId', '==', videoId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(fbQuery).catch(() => null);
      if (!snapshot || snapshot.empty) {
        // Return matching local mock comments
        return MOCK_COMMENTS[videoId] || [];
      }
      
      const comments: CommentDoc[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        comments.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as CommentDoc);
      });
      return comments;
    } catch (error) {
      return MOCK_COMMENTS[videoId] || [];
    }
  }
};
