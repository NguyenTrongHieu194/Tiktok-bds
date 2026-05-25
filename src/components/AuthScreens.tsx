import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthMode } from '../types';
import { Mail, Lock, User, Sparkles, HelpCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AuthScreens: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail, resetPassword, error, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    clearError();
    setLocalError(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setSuccessMsg(null);

    if (isLoading) return;

    if (!email) {
      setLocalError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }
    if (!validateEmail(email)) {
      setLocalError('Địa chỉ email không đúng định dạng.');
      return;
    }

    if (mode !== 'forgot_password') {
      if (!password) {
        setLocalError('Vui lòng nhập mật khẩu.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Mật khẩu phải tối thiểu 6 ký tự.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'signup') {
        if (!name.trim()) {
          setLocalError('Vui lòng nhập họ và tên của bạn.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setLocalError('Mật khẩu nhập lại không trùng khớp.');
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name.trim());
      } else if (mode === 'forgot_password') {
        await resetPassword(email);
        setSuccessMsg('Hệ thống đã gửi liên kết đặt lại mật khẩu về email của bạn. Vui lòng kiểm tra inbox.');
        setEmail('');
      }
    } catch (err: any) {
      // Errors are handled and set in context state
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      // Error is set in the context
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div id="auth-screen-container" className="min-h-screen w-full flex items-center justify-center bg-radial from-[#121214] to-[#040405] text-[#f4f4f5] p-4 lg:p-8">
      {/* Visual background decorations - Elegant glassmorphism shapes */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-rose-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden"
      >
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1 bg-zinc-800/80 border border-zinc-700/60 rounded-full mb-3 text-rose-500 font-mono text-xs tracking-wider">
            <Sparkles size={13} className="animate-spin-slow text-rose-400" />
            NỀN TẢNG BẤT ĐỘNG SẢN THẾ HỆ MỚI
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white select-none">
            AI <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">BĐS</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Kết nối TikTok, tư vấn AI & Môi giới chuyên nghiệp</p>
        </div>

        {/* Auth Error/Success Alerts */}
        <AnimatePresence mode="popLayout">
          {displayError && (
            <motion.div 
              initial={{ opacity: 0, h: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-start gap-2.5"
            >
              <div className="bg-red-500/20 text-red-400 p-1 rounded-md mt-0.5 font-bold">!</div>
              <p className="font-medium leading-relaxed flex-1">{displayError}</p>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mb-4 p-3.5 bg-green-950/40 border border-green-800/60 rounded-xl text-green-300 text-xs flex items-start gap-2.5"
            >
              <div className="bg-green-500/20 text-green-400 p-1 rounded-md mt-0.5 font-bold">✓</div>
              <p className="font-medium leading-relaxed flex-1">{successMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Selection */}
        {mode !== 'forgot_password' && (
          <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl mb-6 border border-zinc-800">
            <button
              onClick={() => handleModeChange('login')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => handleModeChange('signup')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Đăng ký
            </button>
          </div>
        )}

        {/* Password Reset Title */}
        {mode === 'forgot_password' && (
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <HelpCircle className="text-rose-500" size={18} />
              Quên mật khẩu?
            </h3>
            <p className="text-xs text-zinc-400">
              Nhập email đăng ký của bạn. Hệ thống sẽ gửi cho bạn một đường dẫn bảo mật để cấp lại mật khẩu mới.
            </p>
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleAction} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Họ và Tên</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <User size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Địa chỉ Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Mail size={15} />
              </span>
              <input
                type="text"
                placeholder="developer@aibds.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
              />
            </div>
          </div>

          {mode !== 'forgot_password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-400">Mật khẩu</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleModeChange('forgot_password')}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-all"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Lock size={15} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Xác nhận mật khẩu</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Lock size={15} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 text-white rounded-xl py-2.5 text-xs font-bold hover:scale-[1.01] active:opacity-95 shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : mode === 'login' ? (
              <>
                Đăng nhập ngay
                <ArrowRight size={13} />
              </>
            ) : mode === 'signup' ? (
              <>
                Bắt đầu Đăng ký
                <ArrowRight size={13} />
              </>
            ) : (
              <> Gửi mã xác nhận </>
            )}
          </button>
        </form>

        {mode === 'forgot_password' && (
          <button
            onClick={() => handleModeChange('login')}
            className="mt-4 text-center text-xs text-zinc-400 hover:text-white transition-all font-semibold"
          >
            Quay lại Đăng nhập
          </button>
        )}

        {/* Divider line */}
        {mode !== 'forgot_password' && (
          <>
            <div className="relative my-5 flex items-center">
              <div className="flex-grow border-t border-zinc-800/80"></div>
              <span className="flex-shrink mx-3 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Hoặc tiếp tục với</span>
              <div className="flex-grow border-t border-zinc-800/80"></div>
            </div>

            {/* Google provider login */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              type="button"
              className="w-full border border-zinc-800 bg-zinc-950/70 text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-zinc-900 shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="#ea4335" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Kết nối Tài khoản Google
            </button>
          </>
        )}

        {/* Adblocker or Safari Iframe Warning Banner helper */}
        <div className="mt-5 p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl flex flex-col items-center text-center">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            💡 Gặp lỗi xác thực <code className="text-rose-400 font-mono">network-request-failed</code>? Hãy click nút dưới đây để mở ứng dụng trong Tab mới (bỏ chặn cookie / bảo vệ chéo trang của Safari)!
          </p>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/20 transition-all cursor-pointer"
          >
            Mở trong Tab mới ↗
          </a>
        </div>
      </motion.div>
    </div>
  );
};
