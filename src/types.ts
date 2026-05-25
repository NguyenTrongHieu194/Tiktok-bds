export type UserRole = 'customer' | 'agent' | 'admin';

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  avatarUrl?: string;
  phoneNumber?: string;
  bio?: string;
  agencyName?: string;
  isVerifiedAgent?: boolean;
  isOnboarded: boolean; // Flag indicating if user completed the role-selection onboarding
}

export type AuthMode = 'login' | 'signup' | 'forgot_password';

export interface AuthContextType {
  user: any | null; // Firebase User
  profile: UserProfile | null; // Firestore Profile
  loading: boolean;
  onboardingLoading: boolean;
  error: string | null;
  clearError: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeOnboarding: (role: UserRole, extraData?: { phoneNumber?: string; bio?: string; agencyName?: string }) => Promise<void>;
}
