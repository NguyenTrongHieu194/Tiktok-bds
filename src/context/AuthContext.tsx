import React, { createContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole, AuthContextType } from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapFirebaseError = (err: any, defaultMsg: string): string => {
  const errMsg = String(err?.message || err);
  const errCode = String(err?.code || '');
  if (
    errCode === 'auth/network-request-failed' || 
    errMsg.includes('network-request-failed') || 
    errMsg.includes('fetch') || 
    errMsg.includes('Network Error') ||
    errMsg.includes('cross-origin') ||
    errMsg.includes('iframe')
  ) {
    return 'Lỗi kết nối (auth/network-request-failed). Lỗi này xảy ra do bạn đang xem app trong Iframe của AI Studio (nhất là trên trình duyệt Safari/iOS) khiến lưu trữ cookie bị chặn, hoặc do phần mềm chặn quảng cáo (AdBlocker/Brave Shields). Vui lòng nhấn vào liên kết "Mở trong Tab mới" ở cuối trang để xác thực thành công!';
  }
  return defaultMsg;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [onboardingLoading, setOnboardingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Helper to fetch/sync Firestore user profile
  const fetchUserProfile = async (uid: string, fallbackEmail: string, fallbackName: string): Promise<UserProfile | null> => {
    const path = `users/${uid}`;
    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          userId: uid,
          displayName: data.displayName || fallbackName,
          email: data.email || fallbackEmail,
          role: data.role as UserRole,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          avatarUrl: data.avatarUrl || '',
          phoneNumber: data.phoneNumber || '',
          bio: data.bio || '',
          agencyName: data.agencyName || '',
          isVerifiedAgent: data.isVerifiedAgent || false,
          isOnboarded: true, // Marked true if document exists in our users collection
        };
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return null;
    }
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);
      if (currentUser) {
        setUser(currentUser);
        // Load Firestore profile
        const userProfile = await fetchUserProfile(
          currentUser.uid, 
          currentUser.email || '', 
          currentUser.displayName || 'Người dùng'
        );
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google Login
  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const credentials = await signInWithPopup(auth, provider);
      const currentUser = credentials.user;
      
      // Fetch user profile immediately
      const userProfile = await fetchUserProfile(
        currentUser.uid,
        currentUser.email || '',
        currentUser.displayName || 'Người dùng'
      );
      setProfile(userProfile);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const localizedError = mapFirebaseError(err, err?.message || 'Có lỗi xảy ra khi đăng nhập bằng Google.');
      setError(localizedError);
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Login
  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      const currentUser = credentials.user;
      const userProfile = await fetchUserProfile(
        currentUser.uid,
        currentUser.email || '',
        currentUser.displayName || 'Đối tác'
      );
      setProfile(userProfile);
    } catch (err: any) {
      console.error('Email Sign-In Error:', err);
      let defaultError = 'Sai tài khoản hoặc mật khẩu.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        defaultError = 'Email hoặc mật khẩu không chính xác.';
      } else if (err.code === 'auth/invalid-email') {
        defaultError = 'Định dạng email không hợp lệ.';
      }
      const localizedError = mapFirebaseError(err, defaultError);
      setError(localizedError);
      throw new Error(localizedError);
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign Up
  const signUpWithEmail = async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      // Set auth profile name
      await updateProfile(credentials.user, { displayName: name });
      setUser(credentials.user);
      setProfile(null); // User is modernly registered but has not picked their onboarding role yet
    } catch (err: any) {
      console.error('Email Sign-Up Error:', err);
      let defaultError = 'Không thể tạo tài khoản.';
      if (err.code === 'auth/email-already-in-use') {
        defaultError = 'Địa chỉ email này đã được sử dụng.';
      } else if (err.code === 'auth/weak-password') {
        defaultError = 'Mật khẩu tối thiểu phải từ 6 ký tự.';
      }
      const localizedError = mapFirebaseError(err, defaultError);
      setError(localizedError);
      throw new Error(localizedError);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password
  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error('Password Reset Error:', err);
      let defaultError = 'Không thể gửi email đặt lại mật khẩu.';
      if (err.code === 'auth/user-not-found') {
        defaultError = 'Email này không tồn tại trong hệ thống.';
      }
      const localizedError = mapFirebaseError(err, defaultError);
      setError(localizedError);
      throw new Error(localizedError);
    }
  };

  // Log Out
  const signOutUser = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setProfile(null);
      setUser(null);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
      setError('Lỗi khi đăng xuất.');
    } finally {
      setLoading(false);
    }
  };

  // Complete Onboarding - Write initial user document profile inside the Firestore collections
  const completeOnboarding = async (
    role: UserRole, 
    extraData?: { phoneNumber?: string; bio?: string; agencyName?: string }
  ) => {
    if (!user) {
      setError('Vui lòng đăng nhập trước khi thiết lập vai trò.');
      return;
    }
    setOnboardingLoading(true);
    setError(null);
    const path = `users/${user.uid}`;
    try {
      const newProfile: UserProfile = {
        userId: user.uid,
        displayName: user.displayName || 'Người dùng',
        email: user.email || '',
        role: role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        avatarUrl: user.photoURL || '',
        phoneNumber: extraData?.phoneNumber || '',
        bio: extraData?.bio || '',
        agencyName: extraData?.agencyName || '',
        isVerifiedAgent: false,
        isOnboarded: true,
      };

      // Strict conform checks for schema integrity matches our firebase-blueprint.json
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        userId: newProfile.userId,
        displayName: newProfile.displayName,
        email: newProfile.email,
        role: newProfile.role,
        avatarUrl: newProfile.avatarUrl,
        phoneNumber: newProfile.phoneNumber,
        bio: newProfile.bio,
        agencyName: newProfile.agencyName,
        isVerifiedAgent: newProfile.isVerifiedAgent,
        followersCount: 0,
        followingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setProfile(newProfile);
    } catch (err) {
      console.error('Onboarding Save Error:', err);
      const localizedError = mapFirebaseError(err, 'Lỗi trong quá trình lưu hồ sơ. Vui lòng thử lại.');
      setError(localizedError);
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      onboardingLoading,
      error,
      clearError,
      loginWithGoogle,
      loginWithEmail,
      signUpWithEmail,
      signOutUser,
      resetPassword,
      completeOnboarding
    }}>
      {children}
    </AuthContext.Provider>
  );
};
