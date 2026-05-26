import { 
  collection, doc, getDoc, setDoc, getDocs, query, where, orderBy, limit, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PropertyDoc, VideoDoc } from '../types/tiktok';

// ==========================================
// FIRESTORE STRUCTURE (RECOMMENDATION SCHEMA)
// ==========================================
/*
1. Collection: "/userPreferences/{userId}"
   Structure:
   {
     userId: string,
     preferredCity: string,      // E.g., "Hồ Chí Minh", "Đà Lạt"
     preferredDistrict: string,  // E.g., "Quận 2", "Phường 10"
     preferredMinPrice: number,  // in Millions/Billions VND
     preferredMaxPrice: number,  // in Millions/Billions VND
     tagWeights: {               // Jaccard tags list with dynamic frequency multipliers
       "Biệt thự nghỉ dưỡng": number,
       "Đà Lạt thơ mộng": number,
       "View sông": number,
       ...
     },
     totalWatchTimeSec: number,   // Sum of overall watch sessions
     lastUpdated: timestamp
   }

2. Collection: "/videoInteractions/{userId_videoId}"
   Structure:
   {
     id: string,                 // "${userId}_${videoId}"
     userId: string,
     videoId: string,
     watchTimeSec: number,       // cumulative watch time in seconds
     totalDuration: number,      // video total duration
     watchRatio: number,         // watchTimeSec / totalDuration (0.0 to N)
     completed: boolean,         // watched > 80%
     liked: boolean,
     saved: boolean,
     lastWatched: timestamp
   }
*/

export interface UserPreferences {
  userId: string;
  preferredCity: string;
  preferredDistrict: string;
  preferredMinPrice: number;
  preferredMaxPrice: number;
  tagWeights: Record<string, number>;
  totalWatchTimeSec: number;
  lastUpdated?: any;
}

export interface VideoInteraction {
  id: string;
  userId: string;
  videoId: string;
  watchTimeSec: number;
  totalDuration: number;
  watchRatio: number;
  completed: boolean;
  liked: boolean;
  saved: boolean;
  lastWatched?: any;
}

export interface RecommendationWeightConfig {
  locationWeight: number;    // default: 35%
  priceWeight: number;       // default: 30%
  tagWeight: number;         // default: 25%
  interactionWeight: number; // default: 10%
  recencyWeight: number;     // boost on top
}

export interface ScoredVideo {
  video: VideoDoc;
  property: PropertyDoc | null;
  finalScore: number;
  breakdown: {
    locationScore: number;
    priceScore: number;
    tagScore: number;
    interactionScore: number;
    recencyScore: number;
  };
}

export const DEFAULT_WEIGHT_CONFIG: RecommendationWeightConfig = {
  locationWeight: 35,
  priceWeight: 30,
  tagWeight: 25,
  interactionWeight: 10,
  recencyWeight: 5
};

export const DEFAULT_PREFERENCES = (userId: string): UserPreferences => ({
  userId,
  preferredCity: 'Hồ Chí Minh',
  preferredDistrict: '',
  preferredMinPrice: 0,
  preferredMaxPrice: 50000, // 50 Billion or max
  tagWeights: {
    "Biệt thự nghỉ dưỡng": 1.0,
    "Penthouse Duplex": 1.0,
    "Studio thông minh": 0.5,
  },
  totalWatchTimeSec: 0
});

export const recommendationService = {
  /**
   * Fetches the user personalization DNA portrait from Firestore or returns reasonable default
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    if (!userId) return DEFAULT_PREFERENCES('anonymous');
    try {
      const docRef = doc(db, 'userPreferences', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          userId,
          preferredCity: data.preferredCity || 'Hồ Chí Minh',
          preferredDistrict: data.preferredDistrict || '',
          preferredMinPrice: Number(data.preferredMinPrice ?? 0),
          preferredMaxPrice: Number(data.preferredMaxPrice ?? 50000),
          tagWeights: data.tagWeights || {},
          totalWatchTimeSec: Number(data.totalWatchTimeSec ?? 0),
        };
      }
      return DEFAULT_PREFERENCES(userId);
    } catch (err) {
      console.warn("Firestore error reading userPreferences, using safe local preferences:", err);
      return DEFAULT_PREFERENCES(userId);
    }
  },

  /**
   * Safe save preferences
   */
  async saveUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
    if (!userId || userId === 'anonymous') return;
    try {
      const docRef = doc(db, 'userPreferences', userId);
      await setDoc(docRef, {
        ...prefs,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn("Unable to write userPreferences to Firestore:", err);
    }
  },

  /**
   * Tracks video view micro-interactions to construct Content-Based recommendation models
   */
  async logVideoInteraction(params: {
    userId: string;
    videoId: string;
    videoTags: string[];
    propertyPrice?: number;
    propertyCity?: string;
    propertyDistrict?: string;
    watchTimeSec: number;
    totalDuration: number;
    liked?: boolean;
    saved?: boolean;
  }): Promise<UserPreferences> {
    const {
      userId, videoId, videoTags, propertyPrice, propertyCity, propertyDistrict,
      watchTimeSec, totalDuration, liked = false, saved = false
    } = params;

    if (!userId || userId === 'anonymous') return DEFAULT_PREFERENCES('anonymous');

    const interactionId = `${userId}_${videoId}`;
    const intRef = doc(db, 'videoInteractions', interactionId);

    try {
      // 1. Read existing interaction to check incremental changes
      let existingInt: VideoInteraction = {
        id: interactionId,
        userId,
        videoId,
        watchTimeSec: 0,
        totalDuration: totalDuration || 15,
        watchRatio: 0,
        completed: false,
        liked: false,
        saved: false
      };

      const intSnap = await getDoc(intRef);
      if (intSnap.exists()) {
        existingInt = { ...existingInt, ...intSnap.data() as VideoInteraction };
      }

      // Compute new stats
      const newWatchTime = existingInt.watchTimeSec + watchTimeSec;
      const watchRatio = totalDuration > 0 ? newWatchTime / totalDuration : 0;
      const completed = watchRatio >= 0.8;

      const updatedInt: VideoInteraction = {
        id: interactionId,
        userId,
        videoId,
        watchTimeSec: newWatchTime,
        totalDuration: totalDuration || 15,
        watchRatio,
        completed,
        liked: liked || existingInt.liked,
        saved: saved || existingInt.saved
      };

      // Set interaction document
      await setDoc(intRef, {
        ...updatedInt,
        lastWatched: serverTimestamp()
      }, { merge: true });

      // 2. Adjust User Preference Portrait (Reinforcement feedback loop)
      const currentPrefs = await this.getUserPreferences(userId);

      // Mutate tags dynamically
      const updatedWeights = { ...currentPrefs.tagWeights };
      
      // Multipliers: Like (+2.0), Save (+3.0), Complete view (+1.5), Normal view (+0.2 * watchTimeSec)
      let resonanceScore = 0.1;
      if (liked) resonanceScore += 2.0;
      if (saved) resonanceScore += 3.0;
      if (completed) resonanceScore += 1.5;
      resonanceScore += Math.min(watchTimeSec * 0.15, 3.0); // Caps watch time impact per interaction to 3.0

      videoTags.forEach(tag => {
        if (!updatedWeights[tag]) {
          updatedWeights[tag] = 0;
        }
        updatedWeights[tag] = Number((updatedWeights[tag] + resonanceScore).toFixed(2));
      });

      // Normalize weights so they do not spiral out of bounds
      const allValues = Object.values(updatedWeights);
      if (allValues.length > 50) {
        // Drop lowest weights to keep Firestore footprint tiny
        const sortedTags = Object.entries(updatedWeights).sort((a, b) => (b[1] as number) - (a[1] as number));
        const truncated = sortedTags.slice(0, 30);
        const nextWeights: Record<string, number> = {};
        truncated.forEach(([k, v]) => { nextWeights[k] = v as number; });
        currentPrefs.tagWeights = nextWeights;
      } else {
        currentPrefs.tagWeights = updatedWeights;
      }

      // Update location preference if they spend positive watch time on it
      if (propertyCity && watchTimeSec > 3) {
        currentPrefs.preferredCity = propertyCity;
        if (propertyDistrict) {
          currentPrefs.preferredDistrict = propertyDistrict;
        }
      }

      // Dynamically refine preferred price range
      if (propertyPrice && propertyPrice > 0 && watchTimeSec > 5) {
        const devPrice = propertyPrice;
        // Moving average preferred price bounds
        const minBound = Math.max(0, Math.round(devPrice * 0.6));
        const maxBound = Math.round(devPrice * 1.5);
        currentPrefs.preferredMinPrice = Math.round((currentPrefs.preferredMinPrice * 0.7) + (minBound * 0.3));
        currentPrefs.preferredMaxPrice = Math.round((currentPrefs.preferredMaxPrice * 0.7) + (maxBound * 0.3));
      }

      currentPrefs.totalWatchTimeSec += watchTimeSec;

      // Save user feedback portrait
      await this.saveUserPreferences(userId, currentPrefs);

      return currentPrefs;
    } catch (err) {
      console.warn("Unable to process micro-interaction feedback cycle:", err);
      return DEFAULT_PREFERENCES(userId);
    }
  },

  /**
   * RANKING FORMULA ENGINE
   * Scoring functions to quantify dynamic personalization & match weights
   */
  calculateProfileMatch(
    video: VideoDoc,
    property: PropertyDoc | null,
    profile: UserPreferences,
    config: RecommendationWeightConfig = DEFAULT_WEIGHT_CONFIG
  ): ScoredVideo {
    // 1. LOCATION SCORING (Max 100)
    let locationScore = 40; // baseline if unknown
    if (property) {
      const cityMatch = property.location?.city?.toLowerCase() === profile.preferredCity?.toLowerCase();
      const distMatch = property.location?.district?.toLowerCase() === profile.preferredDistrict?.toLowerCase();
      
      if (cityMatch && distMatch) {
        locationScore = 100;
      } else if (cityMatch) {
        locationScore = 80;
      } else if (profile.preferredCity) {
        locationScore = 20; // major city mismatch penalty
      }
    }

    // 2. PRICE AFFINITY SCORING (Max 100)
    // Uses Exponential Decay Gaussian formula: score = 100 * exp(- (price - prefMid)^2 / (2 * sigma^2))
    let priceScore = 50; // baseline
    if (property && property.price) {
      const price = property.price;
      const prefMin = profile.preferredMinPrice || 0;
      const prefMax = profile.preferredMaxPrice || 50000;
      const prefMid = (prefMin + prefMax) / 2;
      const range = (prefMax - prefMin) || 10000;
      const sigma = range / 2;

      if (price >= prefMin && price <= prefMax) {
        priceScore = 100; // inside preferred sweet spot
      } else {
        const distanceFromRange = price < prefMin ? prefMin - price : price - prefMax;
        // Exponential decay penalty
        priceScore = Math.max(10, Math.round(100 * Math.exp(-0.4 * (distanceFromRange / (sigma || 1000)))));
      }
    }

    // 3. TAG VECTOR SIMILARITY COEFF (Max 100)
    // Jaccard similarity / TF-IDF: Dot product of video active tags with user interest vector weights
    let tagScore = 30; // base value
    const vTags = video.aiTags || [];
    if (vTags.length > 0) {
      let matchedCount = 0;
      let matchedWeightSum = 0;
      
      vTags.forEach(t => {
        if (profile.tagWeights[t]) {
          matchedCount++;
          matchedWeightSum += profile.tagWeights[t];
        }
      });

      if (matchedCount > 0) {
        // Boost similarity based on interests
        const meanWeight = matchedWeightSum / matchedCount;
        tagScore = Math.min(100, Math.round(50 + (meanWeight * 20)));
      }
    }

    // 4. INTERACTION HISTORY BOOST / PENALTY (Max 100)
    // High premium if users didn't dismiss, penalty if watched less than 2s inside session loops
    let interactionScore = 50; // baseline
    if (video.likesCount > 500) interactionScore += 10;
    if (video.viewCount > 10000) interactionScore += 10;
    interactionScore = Math.min(100, interactionScore);

    // 5. RECENCY DECAY SCORING (Max 100)
    let recencyScore = 100;
    if (video.createdAt) {
      const vidDate = video.createdAt instanceof Date ? video.createdAt : new Date(video.createdAt);
      const daysElapsed = Math.max(0, (Date.now() - vidDate.getTime()) / (1000 * 3600 * 24));
      // Lambda = 0.05 exponential decay
      recencyScore = Math.round(100 * Math.exp(-0.05 * daysElapsed));
    }

    // 6. WEIGHT COMBINATORICS
    const weightedLoc = (locationScore * config.locationWeight) / 100;
    const weightedPri = (priceScore * config.priceWeight) / 100;
    const weightedTag = (tagScore * config.tagWeight) / 100;
    const weightedInt = (interactionScore * config.interactionWeight) / 100;
    const weightedRec = (recencyScore * config.recencyWeight) / 100;

    const finalRaw = weightedLoc + weightedPri + weightedTag + weightedInt + weightedRec;
    const finalScore = Number(Math.min(100, Math.max(10, finalRaw)).toFixed(1));

    return {
      video,
      property,
      finalScore,
      breakdown: {
        locationScore,
        priceScore,
        tagScore,
        interactionScore,
        recencyScore
      }
    };
  },

  /**
   * Sorts entire dataset feeds into a personalized output stream
   */
  async getPersonalizedFeed(params: {
    userId: string;
    videos: VideoDoc[];
    properties: PropertyDoc[];
    config?: RecommendationWeightConfig;
  }): Promise<ScoredVideo[]> {
    const { userId, videos, properties, config = DEFAULT_WEIGHT_CONFIG } = params;
    
    // Retrieve latest preference profiles
    const userProfile = await this.getUserPreferences(userId);

    const scoredFeed = videos.map(vid => {
      const associatedProp = properties.find(p => p.id === vid.propertyId) || null;
      return this.calculateProfileMatch(vid, associatedProp, userProfile, config);
    });

    // Rank scored feed descending
    return scoredFeed.sort((a, b) => b.finalScore - a.finalScore);
  },

  /**
   * Reset Recommendation Profile to clear weights
   */
  async resetPreferences(userId: string): Promise<UserPreferences> {
    if (!userId || userId === 'anonymous') return DEFAULT_PREFERENCES('anonymous');
    const fresh = DEFAULT_PREFERENCES(userId);
    await this.saveUserPreferences(userId, fresh);
    return fresh;
  }
};
