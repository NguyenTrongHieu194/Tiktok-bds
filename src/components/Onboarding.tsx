import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';
import { Sparkles, UserCheck, Phone, CheckCircle, ArrowRight, User, Home, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Onboarding: React.FC = () => {
  const { completeOnboarding, onboardingLoading, error, user, signOutUser } = useAuth();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setLocalError(null);
  };

  const handleNextStep = () => {
    if (!selectedRole) {
      setLocalError('Vui lòng chọn một vai trò để tiếp tục.');
      return;
    }
    setLocalError(null);
    setStep(2);
  };

  const handlePrevStep = () => {
    setLocalError(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Basic fields checks
    if (!phoneNumber) {
      setLocalError('Vui lòng cung cấp số điện thoại liên lạc của bạn.');
      return;
    }
    if (!/^[0-9\s+()-]{9,15}$/.test(phoneNumber.trim())) {
      setLocalError('Số điện thoại không đúng định dạng.');
      return;
    }
    if (selectedRole === 'agent' && !agencyName.trim()) {
      setLocalError('Các nhà môi giới vui lòng điền tên Sàn giao dịch hoặc Công ty.');
      return;
    }

    try {
      await completeOnboarding(selectedRole!, {
        phoneNumber: phoneNumber.trim(),
        bio: bio.trim(),
        agencyName: selectedRole === 'agent' ? agencyName.trim() : undefined,
      });
    } catch (err) {
      // Handled in Context
    }
  };

  const displayError = localError || error;

  return (
    <div id="onboarding-container" className="min-h-screen w-full flex items-center justify-center bg-radial from-[#121214] to-[#040405] text-[#f4f4f5] p-4 lg:p-8 relative">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Log out option at top-right */}
      <button 
        onClick={signOutUser}
        className="absolute top-6 right-6 text-zinc-400 hover:text-white transition-all text-xs font-semibold bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 cursor-pointer flex items-center gap-1"
      >
        <ArrowLeft size={12} /> Thôi, đăng xuất
      </button>

      <motion.div 
        key={`step-${step}`}
        initial={{ opacity: 0, x: step === 1 ? -15 : 15 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: step === 1 ? 15 : -15 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden"
      >
        {/* Progress Bar & Subtitle */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Bước {step} trên 2</span>
            <span className="text-zinc-500 text-xs">•</span>
            <span className="text-zinc-400 text-xs font-semibold">{step === 1 ? 'Chọn vai trò cốt lõi' : 'Cập nhật thông tin chi tiết'}</span>
          </div>
          <div className="w-24 bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800/60">
            <div className="bg-gradient-to-r from-rose-500 to-indigo-500 h-full transition-all duration-300" style={{ width: step === 1 ? '50%' : '100%' }}></div>
          </div>
        </div>

        {/* Greeting Banner */}
        <div className="mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="text-yellow-400" size={20} />
            Chào mừng, {user?.displayName || 'bạn'}!
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Hãy thiết lập vai trò để chúng tôi tinh chỉnh giao diện và các dịch vụ AI phù hợp nhất dành riêng cho bạn.</p>
        </div>

        {/* Alert Zone */}
        {displayError && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-start gap-2.5">
            <div className="bg-red-500/20 text-red-400 p-0.5 px-1.5 rounded-md font-bold mt-0.5">!</div>
            <p className="font-semibold leading-relaxed flex-1">{displayError}</p>
          </div>
        )}

        {/* Step 1: Role Selector Choice */}
        {step === 1 ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Option Customer */}
              <div
                onClick={() => handleSelectRole('customer')}
                className={`relative p-5 border rounded-2xl cursor-pointer select-none transition-all duration-300 flex flex-col h-full bg-zinc-950/50 ${
                  selectedRole === 'customer'
                    ? 'border-rose-500 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/30'
                    : 'border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50'
                }`}
              >
                {selectedRole === 'customer' && (
                  <span className="absolute top-4 right-4 text-rose-500">
                    <CheckCircle size={20} fill="#f43f5e" className="text-zinc-950" />
                  </span>
                )}
                <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl w-fit mb-4">
                  <User size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Tôi là Khách hàng</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mt-auto">
                  Tìm mua, thuê nhà tiện nghi, xem video TikTok phong cách sống, kiến trúc, và trao đổi với Chuyên gia AI hỗ trợ lướt tin tìm nhà tự động.
                </p>
              </div>

              {/* Option Agent */}
              <div
                onClick={() => handleSelectRole('agent')}
                className={`relative p-5 border rounded-2xl cursor-pointer select-none transition-all duration-300 flex flex-col h-full bg-zinc-950/50 ${
                  selectedRole === 'agent'
                    ? 'border-indigo-500 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500/30'
                    : 'border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50'
                }`}
              >
                {selectedRole === 'agent' && (
                  <span className="absolute top-4 right-4 text-indigo-500">
                    <CheckCircle size={20} fill="#6366f1" className="text-zinc-950" />
                  </span>
                )}
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
                  <Home size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Tôi là Nhà Môi giới (Sale)</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mt-auto">
                  Đăng tin dự án, đăng video Tiktok ngắn, AI tự động bóc băng ghi âm tạo kịch bản, và tối ưu dashboard quản lý Leads khách hàng của bạn.
                </p>
              </div>
            </div>

            <button
              onClick={handleNextStep}
              className="w-full bg-zinc-800 text-white rounded-xl py-3 text-xs font-bold hover:bg-zinc-705 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              Tiếp tục thiết lập thông tin
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          /* Step 2: Information inputs */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl mb-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg w-fit text-xs font-bold ${selectedRole === 'customer' ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                {selectedRole === 'customer' ? 'MỤC TIÊU: KHÁCH HÀNG' : 'MỤC TIÊU: MÔI GIỚI'}
              </div>
              <p className="text-xs text-zinc-400">Bạn có thể đổi mốc vai trò này bằng cách nhấp vào nút quay lại.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Số điện thoại liên lạc *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Phone size={15} />
                </span>
                <input
                  type="text"
                  placeholder="0912 345 678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {selectedRole === 'agent' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Công ty / Sàn giao dịch Bất động sản *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                    <UserCheck size={15} />
                  </span>
                  <input
                    type="text"
                    placeholder="Sàn giao dịch Tân Long Land, Đất Xanh,..."
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Mô tả bản thân hoặc nhu cầu (Bio)</label>
              <textarea
                rows={3}
                placeholder={selectedRole === 'customer' ? 'Ví dụ: Tôi muốn tìm mua căn hộ 2 ngủ tầm tài chính dưới 3 tỷ tại Hà Nội...' : 'Ví dụ: Chuyên viên tư vấn khu vực căn hộ Quận 2, Quận Bình Thạnh nhiều sản phẩm cắt lỗ tốt...'}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              ></textarea>
            </div>

            {/* Form actions navigation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={onboardingLoading}
                className="w-full bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                 Quay lại chọn vai trò
              </button>
              
              <button
                type="submit"
                disabled={onboardingLoading}
                className="w-full bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 text-white rounded-xl py-3 text-xs font-extrabold hover:scale-[1.01] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {onboardingLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    Hoàn tất thiết lập
                    <CheckCircle size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
