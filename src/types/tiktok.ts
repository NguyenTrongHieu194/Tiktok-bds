import { UserRole } from '../types';

export interface PropertyDoc {
  id: string;
  agentId: string;
  title: string;
  price: number; // in Millions VND or Dollars
  priceFormatted?: string;
  transactionType: 'sale' | 'rent';
  propertyType: 'apartment' | 'house' | 'land' | 'villa' | 'office';
  bedrooms: number;
  bathrooms: number;
  areaSqM: number;
  images: string[];
  status: string;
  location: {
    address: string;
    city: string;
    ward?: string;
    district?: string;
  };
  description?: string;
  viewCount: number;
  likeCount: number;
  createdAt?: any;
}

export interface VideoDoc {
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
  propertyId: string; // Refers to PropertyDoc
  
  // Flattened Agent info for easy access (fallback or cached)
  agentName?: string;
  agentAvatar?: string;
  agentPhone?: string;
}

export interface CommentDoc {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: any;
}

export interface LikeRelation {
  id: string;
  userId: string;
  videoId: string;
  createdAt: any;
}

export interface FollowRelation {
  id: string;
  followerUid: string;
  followedUid: string;
  createdAt: any;
}

export interface SaveRelation {
  id: string;
  userId: string;
  propertyId: string;
  createdAt: any;
}
