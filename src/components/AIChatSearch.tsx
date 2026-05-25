import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Brain, MapPin, BadgePercent, ArrowRight, 
  HelpCircle, ChevronRight, Calculator, Check, AlertCircle, Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  analysis?: {
    location?: string;
    maxPrice?: number | null;
    transactionType?: 'sale' | 'rent' | null;
    features?: string[];
  };
  matchedIds?: string[];
  matchedProperties?: PropertyDoc[];
  notes?: string;
  isError?: boolean;
}

interface AIChatSearchProps {
  properties: PropertyDoc[];
  onSelectProperty: (property: PropertyDoc) => void;
}

export const AIChatSearch: React.FC<AIChatSearchProps> = ({ properties = [], onSelectProperty }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Xin chào! Tôi là **Trợ lý Tìm kiếm AI Bất Động Sản**. \n\nHãy mô tả mong muốn tìm nhà của bạn bằng ngôn ngữ tự nhiên (Ví dụ: *"Dưới 2 tỷ gần trường học tại Dĩ An"*, hoặc *"Cần thuê chung cư 2 phòng ngủ giá rẻ Thuận An"*). Tôi sẽ phân tích ý định, sàng lọc giỏ hàng thời gian thực và đề xuất những căn phù hợp nhất kèm mô tả chi tiết lý do chuyên môn!'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest chats
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Fast click prompt chips
  const sampleSuggestions = [
    { label: 'Dĩ An dưới 2 tỷ gần trường', text: 'Tôi muốn tìm nhà gần trường học dưới 2 tỷ tại Dĩ An' },
    { label: 'Thuê chung cư Thuận An giá rẻ', text: 'Tôi cần tìm thuê chung cư giá rẻ tiện nghi tại Thuận An' },
    { label: 'Đất nền thổ cư sổ hồng 1.5 - 3 tỷ', text: 'Tìm đất nền thổ cư có sổ hồng riêng mức giá tầm 1.5 đến 3 tỷ tại Bình Dương' },
    { label: 'Căn hộ Studio cao cấp view đẹp', text: 'Tìm căn hộ studio cao cấp thiết kế hiện đại view đẹp thoáng đãng' }
  ];

  // Helper format currency standard Vietnamese VND
  const formatVND = (price: number, type: 'sale' | 'rent') => {
    if (type === 'rent') {
      return `${(price / 1000000).toFixed(0)} Triệu/tháng`;
    }
    if (price >= 1000000000) {
      return `${(price / 1000000000).toFixed(2)} Tỷ`;
    }
    return `${(price / 1000000).toFixed(0)} Triệu`;
  };

  // Safe client-side message renderer matching bold markings
  const renderFormattedText = (rawText: string) => {
    if (!rawText) return null;
    return rawText.split('\n').map((line, lIdx) => {
      // Parse **bold** parts
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const processedElements = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={pIdx} className="font-extrabold text-white text-[12.5px] bg-white/5 px-1 rounded">
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      });

      return (
        <div key={lIdx} className="min-h-[1.125rem] text-zinc-300 tracking-wide text-xs leading-relaxed mb-1.5">
          {processedElements}
        </div>
      );
    });
  };

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMessageId,
      sender: 'user',
      text: queryText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      // Hit real backend full-stack node proxy /api/ai-search
      const response = await fetch('/api/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: queryText,
          // Only send active status houses for fast high precision AI matches
          properties: properties.filter(p => p.status === 'active' || p.status === 'pending')
        })
      });

      if (!response.ok) {
        throw new Error('Đường truyền mạng hoặc máy chủ AI đang bận.');
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Map matching property IDs back to real client PropertyDocs
      const matchedPropertiesList: PropertyDoc[] = [];
      if (Array.isArray(result.matchedIds)) {
        result.matchedIds.forEach((id: string) => {
          const match = properties.find(p => p.id === id);
          if (match) {
            matchedPropertiesList.push(match);
          }
        });
      }

      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: result.explanation || 'Tôi đã xử lý yêu cầu của bạn thành công.',
        analysis: result.analysis,
        matchedIds: result.matchedIds,
        matchedProperties: matchedPropertiesList,
        notes: result.notes
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err: any) {
      console.error('AI Search Trigger Failure:', err);
      setMessages(prev => [...prev, {
        id: `ai-err-${Date.now()}`,
        sender: 'assistant',
        text: `❌ Đã có lỗi xảy ra trong quá trình xứ lý trí tuệ nhân tạo: ${err?.message || 'Lỗi không xác định.'} \n\nBạn có thể thử nhập lại nội dung tìm kiếm đơn giản hơn hoặc kiểm tra cấu hình khóa ở Settings.`,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendQuery(inputVal);
  };

  return (
    <div className="w-full flex flex-col h-[580px] bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl relative">
      
      {/* ChatGPT style active header with pulse animation */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500/10 to-indigo-500/10 text-rose-400 rounded-xl border border-rose-500/20 relative">
            <Brain size={18} className="animate-pulse" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-zinc-100">Cố Vấn Nhà Đất AI</h3>
              <span className="text-[8px] tracking-widest font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                Gemini Multi-Modal
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Kết nối cơ sở dữ liệu giỏ hàng sàn BĐS ({properties.length} tin đăng thực tế)
            </p>
          </div>
        </div>

        {/* Floating helper stats count */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-850 rounded-xl text-[10px] text-zinc-500 font-mono">
          <BadgePercent size={11} className="text-yellow-400" /> Đối soát thông tin 100%
        </div>
      </div>

      {/* ChatGPT-like Chat logs area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 custom-scroll scroll-smooth bg-gradient-to-b from-zinc-950 via-zinc-900/30 to-zinc-950"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            
            return (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Profile circular visual portrait logos */}
                {!isUser ? (
                  <div className="w-8 h-8 rounded-full gradient-avatar bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-rose-400 text-xs shrink-0 font-extrabold shadow-lg shadow-indigo-500/5">
                    <Sparkles size={13} className="text-rose-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 text-[10px] shrink-0 font-bold font-mono shadow-md">
                    KH
                  </div>
                )}

                {/* Message Speech bubble */}
                <div className="space-y-3">
                  <div className={`p-4 rounded-2xl relative shadow-lg ${
                    isUser 
                      ? 'bg-rose-600 border border-rose-500 text-white rounded-tr-none' 
                      : m.isError 
                        ? 'bg-rose-950/20 border border-rose-900/40 rounded-tl-none text-rose-200'
                        : 'bg-zinc-900/90 border border-zinc-800 rounded-tl-none'
                    }`}
                  >
                    {/* Render formatted message lines */}
                    {isUser ? (
                      <p className="text-xs font-medium leading-relaxed">{m.text}</p>
                    ) : (
                      renderFormattedText(m.text)
                    )}

                    {/* AI analytical filter feedback tags */}
                    {!isUser && m.analysis && (
                      <div className="mt-3.5 pt-2.5 border-t border-zinc-800/60 flex flex-wrap gap-2 items-center text-[10px]">
                        <span className="text-zinc-500 font-mono uppercase tracking-wider font-bold">🔍 Ý định phân tách:</span>
                        {m.analysis.location && (
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-medium">
                            📍 Vị trí: {m.analysis.location}
                          </span>
                        )}
                        {m.analysis.maxPrice && (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md font-mono font-bold">
                            💰 Giá trần: {formatVND(m.analysis.maxPrice, m.analysis.transactionType || 'sale')}
                          </span>
                        )}
                        {m.analysis.features && m.analysis.features.map((tag, tIdx) => (
                          <span key={tIdx} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommended matched properties carousel / cards (Highly Interactive response card requested) */}
                  {!isUser && m.matchedProperties && m.matchedProperties.length > 0 && (
                    <motion.div 
                      initial={{ scale: 0.98, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-2.5"
                    >
                      <h4 className="text-[10px] text-zinc-400 font-bold tracking-wider font-mono uppercase flex items-center gap-1">
                        📦 SẢN PHẨM KHỚP TIÊU CHÍ ({m.matchedProperties.length}):
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-2xl">
                        {m.matchedProperties.map((p) => (
                          <div 
                            key={p.id}
                            onClick={() => onSelectProperty(p)}
                            className="bg-zinc-900 hover:bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group shadow-md"
                          >
                            <div className="flex gap-3">
                              {/* Left Thumbnail visual aspect */}
                              <div className="w-16 h-16 rounded-lg bg-zinc-950 overflow-hidden shrink-0 relative border border-zinc-800">
                                <img 
                                  src={p.images?.[0] || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=150&q=80'} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                  alt=""
                                />
                                <div className="absolute top-1 left-1 bg-black/80 text-[7px] font-black px-1 py-0.5 rounded text-rose-400">
                                  {p.transactionType === 'sale' ? 'BÁN' : 'THUÊ'}
                                </div>
                              </div>

                              {/* Right main parameters information */}
                              <div className="space-y-1 overflow-hidden flex-1">
                                <h5 className="font-extrabold text-[11px] text-zinc-200 line-clamp-1 leading-snug group-hover:text-rose-400 transition-colors">
                                  {p.title}
                                </h5>
                                <p className="text-[9px] text-zinc-500 truncate flex items-center gap-0.5">
                                  <MapPin size={8} /> {p.location.address}
                                </p>
                                <p className="text-xs font-black text-rose-500 font-mono">
                                  {formatVND(p.price, p.transactionType)}
                                </p>
                              </div>
                            </div>

                            {/* Footer specifications row */}
                            <div className="border-t border-zinc-800/60 pt-2.5 mt-2.5 flex items-center justify-between text-[9px] text-zinc-400">
                              <span className="font-mono">{p.areaSqM} m² • {p.bedrooms} PN / {p.bathrooms} WC</span>
                              <span className="inline-flex items-center gap-1 font-bold font-mono text-zinc-500 group-hover:text-rose-400 transition-colors">
                                Xem chi tiết <ChevronRight size={10} />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Advisor safety market summary notes overlay */}
                  {!isUser && m.notes && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 bg-zinc-950/40 border border-zinc-850/60 rounded-xl text-[10px] text-zinc-400 max-w-2xl leading-relaxed flex gap-2.5 italic"
                    >
                      <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-zinc-300 font-bold not-italic block mb-0.5">💡 Lưu ý chuyên môn & Lời khuyên thị trường:</strong>
                        {m.notes}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Glowing loader bubble */}
          {loading && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 max-w-[80%] mr-auto"
            >
              <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs shrink-0 border border-rose-500/20">
                <Brain size={13} className="animate-spin text-rose-400" />
              </div>
              <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs rounded-tl-none text-zinc-500 italic flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                Đang đối soát giỏ hàng & phân tích ý định tìm kiếm...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested Fast prompt chips container */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-850 overflow-x-auto whitespace-nowrap shrink-0 flex gap-2 custom-scroll">
        {sampleSuggestions.map((item, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSendQuery(item.text)}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-full text-[10px] font-bold border border-zinc-800 transition-all cursor-pointer whitespace-nowrap inline-block"
          >
            {item.label} ⚡
          </button>
        ))}
      </div>

      {/* Main input footer */}
      <form 
        onSubmit={onSubmitForm} 
        className="p-3.5 border-t border-zinc-800 bg-zinc-900 shrink-0 flex items-center gap-2.5 relative"
      >
        <div className="flex-1 bg-zinc-950 border border-zinc-800 hover:border-zinc-750 rounded-2xl px-3.5 flex items-center gap-2 transition-all">
          <input 
            type="text"
            placeholder="Mô tả ngôi nhà mơ ước (Ví dụ: Tìm mua nhà dưới 3 tỷ tại Dĩ An gần chợ)..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-0 stroke-none"
          />
          <button 
            type="submit"
            disabled={loading || !inputVal.trim()}
            className="p-2 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-white transition-all cursor-pointer inline-flex items-center"
          >
            <Send size={13} />
          </button>
        </div>
      </form>
    </div>
  );
};
