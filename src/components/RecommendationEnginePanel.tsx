import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dna, Sliders, Play, RotateCcw, MapPin, 
  DollarSign, Hash, Heart, Bookmark, Eye, Clock, Sparkles, Check, Info, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  recommendationService, UserPreferences, ScoredVideo, RecommendationWeightConfig, DEFAULT_WEIGHT_CONFIG
} from '../services/recommendationService';
import { VideoDoc, PropertyDoc } from '../types/tiktok';

interface RecommendationEnginePanelProps {
  userId: string;
  videos: VideoDoc[];
  properties: PropertyDoc[];
  onApplyPersonalizedFeed?: (scoredVideos: ScoredVideo[]) => void;
  activeVideoId?: string;
}

export const RecommendationEnginePanel: React.FC<RecommendationEnginePanelProps> = ({
  userId,
  videos,
  properties,
  onApplyPersonalizedFeed,
  activeVideoId
}) => {
  // Recommendation system state
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [weights, setWeights] = useState<RecommendationWeightConfig>(DEFAULT_WEIGHT_CONFIG);
  const [scoredFeed, setScoredFeed] = useState<ScoredVideo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Manual Preference Adjustment inputs
  const [manualCity, setManualCity] = useState<string>('Hồ Chí Minh');
  const [manualMinPrice, setManualMinPrice] = useState<number>(0);
  const [manualMaxPrice, setManualMaxPrice] = useState<number>(50000);

  // Simulation controls
  const [selectedSimVideoId, setSelectedSimVideoId] = useState<string>('');
  const [simWatchTime, setSimWatchTime] = useState<number>(10);
  const [simLiked, setSimLiked] = useState<boolean>(false);
  const [simSaved, setSimSaved] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Load Preferences initially
  const loadPreferencesAndFeed = async () => {
    setIsLoading(true);
    try {
      const prefs = await recommendationService.getUserPreferences(userId);
      setPreferences(prefs);
      
      // Update manual field placeholders
      setManualCity(prefs.preferredCity);
      setManualMinPrice(prefs.preferredMinPrice);
      setManualMaxPrice(prefs.preferredMaxPrice);

      // Calculate feed
      const result = await recommendationService.getPersonalizedFeed({
        userId,
        videos,
        properties,
        config: weights
      });
      setScoredFeed(result);
      if (onApplyPersonalizedFeed) {
        onApplyPersonalizedFeed(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPreferencesAndFeed();
    if (videos.length > 0) {
      setSelectedSimVideoId(activeVideoId || videos[0].id);
    }
  }, [userId, videos, properties]);

  // Recalculate feed layout whenever slider weights change
  useEffect(() => {
    if (preferences) {
      const result = videos.map(vid => {
        const associatedProp = properties.find(p => p.id === vid.propertyId) || null;
        return recommendationService.calculateProfileMatch(vid, associatedProp, preferences, weights);
      }).sort((a, b) => b.finalScore - a.finalScore);
      
      setScoredFeed(result);
      if (onApplyPersonalizedFeed) {
        onApplyPersonalizedFeed(result);
      }
    }
  }, [weights, preferences]);

  // Save modified manual filter boxes
  const handleUpdateManualPref = async () => {
    if (!preferences) return;
    const updated = {
      ...preferences,
      preferredCity: manualCity,
      preferredMinPrice: Number(manualMinPrice),
      preferredMaxPrice: Number(manualMaxPrice),
    };
    await recommendationService.saveUserPreferences(userId, updated);
    setPreferences(updated);
    setSuccessMsg('Đã cập nhật bộ lọc gu BĐS thành công!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Run watch-time feedback simulation
  const handleRunSimulation = async () => {
    if (!preferences || !selectedSimVideoId) return;
    setIsSimulating(true);
    
    try {
      const targetVid = videos.find(v => v.id === selectedSimVideoId);
      if (!targetVid) return;

      const propObj = properties.find(p => p.id === targetVid.propertyId);

      // Fire simulation service call (triggers update loop)
      const nextPrefs = await recommendationService.logVideoInteraction({
        userId,
        videoId: selectedSimVideoId,
        videoTags: targetVid.aiTags || [],
        propertyPrice: propObj?.price,
        propertyCity: propObj?.location?.city,
        propertyDistrict: propObj?.location?.district,
        watchTimeSec: Number(simWatchTime),
        totalDuration: 15,
        liked: simLiked,
        saved: simSaved
      });

      setPreferences(nextPrefs);
      setManualCity(nextPrefs.preferredCity);
      setManualMinPrice(nextPrefs.preferredMinPrice);
      setManualMaxPrice(nextPrefs.preferredMaxPrice);

      // Trigger recalculation of feed
      const result = await recommendationService.getPersonalizedFeed({
        userId,
        videos,
        properties,
        config: weights
      });
      setScoredFeed(result);
      if (onApplyPersonalizedFeed) {
        onApplyPersonalizedFeed(result);
      }

      setSuccessMsg(`🚀 Mô phỏng thành công! Đã ghi nhận xem ${simWatchTime}s${simLiked ? ' + Thả tim' : ''}${simSaved ? ' + Lưu tin' : ''}. DNA Sở thích đã tự động tiến hóa!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetPreferences = async () => {
    if (window.confirm('Bạn muốn khôi phục DNA hồ sơ sở thích về trạng thái mặc định chứ?')) {
      const fresh = await recommendationService.resetPreferences(userId);
      setPreferences(fresh);
      setWeights(DEFAULT_WEIGHT_CONFIG);
      setManualCity(fresh.preferredCity);
      setManualMinPrice(fresh.preferredMinPrice);
      setManualMaxPrice(fresh.preferredMaxPrice);
      setSuccessMsg('Đã khôi phục DNA thuật toán về mặc định!');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Sortable representation of user interest cloud tags
  const tagsSortedByWeights = useMemo(() => {
    if (!preferences?.tagWeights) return [];
    return Object.entries(preferences.tagWeights)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 15);
  }, [preferences?.tagWeights]);

  return (
    <div id="ai-recs-dashboard" className="bg-zinc-950 border border-zinc-850 p-6 rounded-3xl space-y-6 text-zinc-300">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div className="space-y-1">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 text-rose-500">
            <Dna size={16} className="animate-pulse" />
            AI Recommendation Engine & Tuning Terminal
          </h2>
          <p className="text-xs text-zinc-400">Trải nghiệm cách thuật toán học sâu hành vi (Watch Time, Views, Saves) để cá nhân hóa bảng tin Feed.</p>
        </div>
        <button 
          onClick={handleResetPreferences}
          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white border border-zinc-800 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all self-start md:self-auto"
        >
          <RotateCcw size={12} /> Reset DNA
        </button>
      </div>

      {preferences ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT 5 COLUMNS: PERSONALIZATION INTEREST PORTRAIT & CONFIG */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* PORTRAIT CARD */}
            <div className="bg-zinc-905 border border-zinc-900 p-4 rounded-2xl relative overflow-hidden space-y-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Hồ sơ DNA Sở Thích Thuật Toán</h3>
              </div>

              {/* Tag Cloud Visualizer */}
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Hash size={11} /> Bản đồ Trọng số Hash-Tags (Từ khóa Ưu tiên)
                </p>
                {tagsSortedByWeights.length === 0 ? (
                  <div className="text-xs text-zinc-550 py-3 italic">
                    Chưa có hành vi. Bấm mô phỏng xem hoặc thả tim video để sinh trọng số!
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {tagsSortedByWeights.map(([tag, val]) => {
                      // Dynamically calculate font-size and color intensity based on value
                      const scale = Math.min(1.5, Math.max(0.85, 0.8 + (val * 0.15)));
                      const isHigh = val >= 2.0;
                      return (
                        <div 
                          key={tag} 
                          className={`px-2 py-1 rounded-lg border text-[10px] font-mono select-none transition-all flex items-center gap-1 ${
                            isHigh 
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-black' 
                              : 'bg-zinc-900/60 border-zinc-850 text-zinc-400'
                          }`}
                          style={{ fontSize: `${scale * 10}px` }}
                        >
                          #{tag}
                          <span className={`${isHigh ? 'text-rose-500' : 'text-zinc-550'} text-[9px] font-bold`}>
                            +{val.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Geographic preference & Price spectrum */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-850">
                  <p className="text-[9px] text-zinc-500 font-extrabold flex items-center gap-0.5 uppercase mb-1">
                    <MapPin size={10} /> Địa bàn quan tâm nhất
                  </p>
                  <p className="font-bold text-zinc-200">{preferences.preferredCity || 'Chưa rõ'}</p>
                  <p className="text-[9px] text-zinc-500">{preferences.preferredDistrict ? `Huyện: ${preferences.preferredDistrict}` : 'Tất cả các quận'}</p>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-850">
                  <p className="text-[9px] text-zinc-500 font-extrabold flex items-center gap-0.5 uppercase mb-1">
                    <DollarSign size={10} /> Phân khúc ngân sách
                  </p>
                  <p className="font-bold text-zinc-200">
                    {preferences.preferredMinPrice === 0 
                      ? `Dưới ${(preferences.preferredMaxPrice / 1000).toFixed(0)} Tỷ`
                      : `${(preferences.preferredMinPrice / 1000).toFixed(1)} - ${(preferences.preferredMaxPrice / 1000).toFixed(1)} Tỷ`
                    }
                  </p>
                  <p className="text-[9px] text-zinc-500">Tự co giãn theo BĐS hay xem</p>
                </div>
              </div>

              {/* Total watch session stats */}
              <div className="flex justify-between items-center bg-zinc-950 px-3 py-1.5 rounded-xl text-[10px] font-mono text-zinc-400 border border-zinc-900">
                <span className="flex items-center gap-1 text-zinc-500"><Clock size={11} /> Tổng Watch-Time tích lũy:</span>
                <span className="text-zinc-200 font-bold">{preferences.totalWatchTimeSec || 0} giây</span>
              </div>
            </div>

            {/* TUNING WEIGHS MODULE (Interactive Multipliers) */}
            <div className="bg-zinc-905 border border-zinc-900 p-4 rounded-2xl space-y-4">
              <div className="flex items-center gap-1.5">
                <Sliders size={14} className="text-rose-500 animate-pulse" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Hiệu Chỉnh Trọng Số Thuật Toán</h3>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">Thay đổi các hệ số ưu tiên bên dưới để chứng kiến tác động sắp xếp lại bảng tin BĐS cá nhân hóa theo thời gian thực.</p>

              <div className="space-y-3.5">
                {/* 1. Location Weight slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium font-sans">1. Địa lý So khớp ({manualCity})</span>
                    <span className="font-mono font-bold text-rose-400">{weights.locationWeight}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="5"
                    value={weights.locationWeight}
                    onChange={(e) => setWeights({ ...weights, locationWeight: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
                  />
                </div>

                {/* 2. Price Affinity Weight slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">2. Ngân sách Khớp Gu</span>
                    <span className="font-mono font-bold text-rose-400">{weights.priceWeight}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="5"
                    value={weights.priceWeight}
                    onChange={(e) => setWeights({ ...weights, priceWeight: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
                  />
                </div>

                {/* 3. Tag Similarity Weight slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">3. Thói quen HashTag Tags</span>
                    <span className="font-mono font-bold text-rose-400">{weights.tagWeight}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="5"
                    value={weights.tagWeight}
                    onChange={(e) => setWeights({ ...weights, tagWeight: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
                  />
                </div>

                {/* 4. Interaction Weight slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">4. Tương Tác Hành Vi</span>
                    <span className="font-mono font-bold text-rose-400">{weights.interactionWeight}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="5"
                    value={weights.interactionWeight}
                    onChange={(e) => setWeights({ ...weights, interactionWeight: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
                  />
                </div>

                {/* 5. Recency boost slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">5. Xu hướng Gần đây (Freshness)</span>
                    <span className="font-mono font-bold text-rose-400">{weights.recencyWeight}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="5"
                    value={weights.recencyWeight}
                    onChange={(e) => setWeights({ ...weights, recencyWeight: parseInt(e.target.value) })}
                    className="w-full accent-rose-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
                  />
                </div>
              </div>

              {/* Manual adjustment section */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 space-y-2.5">
                <p className="text-[10px] text-zinc-550 font-black uppercase">Chỉnh Khẩu vị Thủ Công</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-zinc-500 block mb-0.5">Tỉnh thành</label>
                    <select 
                      value={manualCity} 
                      onChange={(e) => setManualCity(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-[11px] rounded text-zinc-200 p-1 font-semibold"
                    >
                      <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                      <option value="Đà Lạt">Đà Lạt</option>
                      <option value="Hà Nội">Hà Nội</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] text-zinc-500 block mb-0.5">Giá tối đa (Tỷ)</label>
                    <input 
                      type="number" 
                      value={manualMaxPrice / 1000} 
                      onChange={(e) => setManualMaxPrice(Math.round(Number(e.target.value) * 1000))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-[11px] rounded text-white p-1 font-mono font-semibold"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleUpdateManualPref}
                  className="w-full py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                >
                  Áp dụng Khẩu vị mới
                </button>
              </div>
            </div>

            {/* REAL-TIME INTERACTION SIMULATOR PLAYGROUND */}
            <div className="bg-zinc-905 border border-zinc-900 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-yellow-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Mô Phỏng Trực Tiếp Hành Vi Xem</h3>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">Chọn một video để tiêm tín hiệu giả lập (Watch Time, Likes, Saves) và xem DNA hồ sơ cập nhật tức thì.</p>

              <div className="space-y-3 text-xs">
                
                {/* 1. Target Selector */}
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Chọn Video để xem:</label>
                  <select 
                    value={selectedSimVideoId}
                    onChange={(e) => setSelectedSimVideoId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 p-1.5 rounded-lg text-white font-medium"
                  >
                    {videos.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.caption ? v.caption.substring(0, 45) + '...' : v.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Set Watch Time Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-550">Thời gian xem (Watch Time)</span>
                    <span className="font-mono text-zinc-300 font-bold">{simWatchTime} giây</span>
                  </div>
                  <input 
                    type="range" min="1" max="30" 
                    value={simWatchTime}
                    onChange={(e) => setSimWatchTime(parseInt(e.target.value))}
                    className="w-full accent-rose-500 h-1 bg-zinc-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[8px] text-zinc-650 font-mono">
                    <span>Lướt qua (1s)</span>
                    <span>Hết video (~15s)</span>
                    <span>Cày đi cày lại (30s)</span>
                  </div>
                </div>

                {/* 3. Action Checkboxes */}
                <div className="flex gap-4 items-center pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none hover:text-white">
                    <input 
                      type="checkbox" checked={simLiked} 
                      onChange={(e) => setSimLiked(e.target.checked)}
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <Heart size={14} className={simLiked ? "text-rose-500 fill-rose-500" : "text-zinc-400"} />
                    Bấm Thích (Like)
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none hover:text-white">
                    <input 
                      type="checkbox" checked={simSaved} 
                      onChange={(e) => setSimSaved(e.target.checked)}
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <Bookmark size={14} className={simSaved ? "text-teal-400 fill-teal-400" : "text-zinc-400"} />
                    Bấm Lưu (Save)
                  </label>
                </div>

                {/* Submit simulation */}
                <button 
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="w-full py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow transition-all duration-300 disabled:opacity-50"
                >
                  {isSimulating ? (
                    'Đang xử lý thuật toán...'
                  ) : (
                    <>
                      <Play size={12} className="fill-white" /> Khởi Chạy Tín Hiệu Feedback Loop
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT 7 COLUMNS: TRANSPARENT EXPLAINABLE RECOMMENDATION LIST & FEED */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="flex justify-between items-center bg-zinc-905 border border-zinc-900 px-4 py-3 rounded-2xl">
              <div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-rose-500" />
                  Bảng Tin Cá Nhân Hóa (Xếp hạng bởi Recs-Engine)
                </h3>
                <p className="text-[10px] text-zinc-550">Sắp xếp các tin đăng & video dựa trên phân tích giải thích điểm số (Explainable AI)</p>
              </div>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-bold font-mono">
                {scoredFeed.length} ĐÃ SCORING OK
              </span>
            </div>

            {/* Error notifications or feedback success */}
            <AnimatePresence>
              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-emerald-950/40 border border-emerald-900/30 p-3 rounded-xl text-emerald-400 text-xs flex items-start gap-2"
                >
                  <Check size={14} className="shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List */}
            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1 scrollbar-thin">
              {scoredFeed.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 italic text-xs">
                  Không tìm thấy video nào để xếp hạng/đề xuất. Vui lòng tải thêm.
                </div>
              ) : (
                scoredFeed.map((sf, index) => {
                  const isCurActive = activeVideoId === sf.video.id;
                  return (
                    <div 
                      key={sf.video.id} 
                      className={`bg-zinc-900/40 border p-4 rounded-2xl flex flex-col sm:flex-row gap-4 transition-all hover:bg-zinc-900/70 ${
                        isCurActive ? 'border-rose-500/60 ring-1 ring-rose-500/20 bg-rose-950/5' : 'border-zinc-850'
                      }`}
                    >
                      {/* Video graphic preview with badge and rank */}
                      <div className="relative w-full sm:w-28 h-32 bg-zinc-900 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                        <img 
                          src={sf.video.thumbnailUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=200'} 
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/45 flex flex-col justify-between p-2">
                          <span className="bg-rose-500 text-white font-mono font-black text-[9px] px-2 py-0.5 rounded-full w-fit">
                            RANK {index + 1}
                          </span>
                          
                          <div className="text-[10px] text-white flex items-center gap-0.5">
                            <Eye size={10} /> {(sf.video.viewCount || 0).toLocaleString()} views
                          </div>
                        </div>
                      </div>

                      {/* Score metrics & breakdowns */}
                      <div className="flex-1 space-y-3.5">
                        
                        {/* Title Caption line */}
                        <div>
                          <p className="text-xs font-bold text-white leading-normal line-clamp-1">{sf.video.caption}</p>
                          <p className="text-[10px] text-indigo-400 mt-1">
                            {sf.property?.title ? `${sf.property.title} | ${sf.property.priceFormatted}` : 'Bất động sản cao cấp'}
                          </p>
                        </div>

                        {/* Recommendation Explainable Bar chart */}
                        <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850/60 space-y-2">
                          
                          {/* Score heading */}
                          <div className="flex justify-between items-center text-xs pb-1.5 border-b border-zinc-900/60">
                            <span className="font-semibold text-zinc-400 flex items-center gap-1">
                              Trực quan Điểm Số phù hợp
                              <HelpCircle size={11} className="text-zinc-650" title="Chi tiết lượng đóng góp từ gu của bạn vào thuật toán đề xuất" />
                            </span>
                            <span className="font-mono text-xs font-black text-rose-400 bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded">
                              MATCH {sf.finalScore}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                            {/* 1. Location Bar */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-zinc-500 font-medium">
                                <span>Khu vực ({sf.property?.location?.city || 'Chưa rõ'}):</span>
                                <span className="font-mono font-bold text-zinc-300">{sf.breakdown.locationScore}/100</span>
                              </div>
                              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: `${sf.breakdown.locationScore}%` }}></div>
                              </div>
                            </div>

                            {/* 2. Price Bar */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-zinc-500 font-medium">
                                <span>Khớp giá ({sf.property?.priceFormatted || 'Thỏa thuận'}):</span>
                                <span className="font-mono font-bold text-zinc-300">{sf.breakdown.priceScore}/100</span>
                              </div>
                              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${sf.breakdown.priceScore}%` }}></div>
                              </div>
                            </div>

                            {/* 3. Tag similarity Bar */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-zinc-500 font-medium">
                                <span>Độ khớp Thẻ Tag:</span>
                                <span className="font-mono font-bold text-zinc-300">{sf.breakdown.tagScore}/100</span>
                              </div>
                              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${sf.breakdown.tagScore}%` }}></div>
                              </div>
                            </div>

                            {/* 4. Recency decay bar */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-zinc-500 font-medium">
                                <span>Độ mới Freshness:</span>
                                <span className="font-mono font-bold text-zinc-300">{sf.breakdown.recencyScore}/100</span>
                              </div>
                              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: `${sf.breakdown.recencyScore}%` }}></div>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Interactive trigger to feed */}
                        {isCurActive && (
                          <div className="text-[9.5px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold px-2.5 py-1 rounded w-fit flex items-center gap-1">
                            <Clock size={11} className="animate-spin text-rose-400" /> Bạn đang cày xem video này ngoài bảng tin!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-12 text-zinc-500 text-xs italic">
          Khởi tạo thông số thuật toán... Vui lòng chờ.
        </div>
      )}

    </div>
  );
};
