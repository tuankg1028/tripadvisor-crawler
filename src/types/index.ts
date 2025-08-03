export interface ApiResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

export interface Profile {
  user_id: string;
  name: string;
  group_id: string;
}

export interface BrowserData {
  ws: {
    puppeteer: string;
  };
  debug_port: string;
}

export interface Review {
  id: string;
  reviewerName: string;
  reviewerLocation?: string;
  rating: number;
  reviewTitle: string;
  reviewText: string;
  reviewDate: string;
  helpfulVotes?: number;
  totalVotes?: number;
  isVerified?: boolean;
  tripType?: string;
  stayDate?: string;
}

export interface ScrapingResult {
  url: string;
  totalReviews: number;
  scrapedReviews: number;
  reviews: Review[];
  scrapedAt: string;
  businessName?: string;
  businessLocation?: string;
  overallRating?: string;
  error?: string;
}