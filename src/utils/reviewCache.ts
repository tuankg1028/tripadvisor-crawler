import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Review } from '../types';

interface CacheData {
  reviews: { [reviewId: string]: Review };
  lastUpdated: string;
  hotelUrl: string;
}

export class ReviewCache {
  private cacheDir: string;
  private cacheFile: string;
  private cache: CacheData;

  constructor(hotelUrl: string) {
    this.cacheDir = path.join(process.cwd(), 'cache');
    // Create a filename based on the hotel URL
    const urlHash = this.hashUrl(hotelUrl);
    this.cacheFile = path.join(this.cacheDir, `reviews_${urlHash}.json`);
    
    this.cache = {
      reviews: {},
      lastUpdated: new Date().toISOString(),
      hotelUrl
    };

    this.ensureCacheDir();
    this.loadCache();
  }

  private hashUrl(url: string): string {
    // Extract hotel ID from TripAdvisor URL for cleaner cache filename
    const match = url.match(/d(\d+)/);
    return match ? match[1] : url.replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log(chalk.green('📁 Created cache directory'));
    }
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        this.cache = JSON.parse(data);
        console.log(chalk.blue(`💾 Loaded cache with ${Object.keys(this.cache.reviews).length} existing reviews`));
      } else {
        console.log(chalk.yellow('📄 No existing cache found, starting fresh'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error loading cache, starting fresh:'), error);
      this.cache = {
        reviews: {},
        lastUpdated: new Date().toISOString(),
        hotelUrl: this.cache.hotelUrl
      };
    }
  }

  public saveCache(): void {
    try {
      this.cache.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
      console.log(chalk.green(`💾 Cache saved with ${Object.keys(this.cache.reviews).length} reviews`));
    } catch (error) {
      console.error(chalk.red('❌ Error saving cache:'), error);
    }
  }

  public hasReview(reviewId: string): boolean {
    return reviewId in this.cache.reviews;
  }

  public getReview(reviewId: string): Review | null {
    return this.cache.reviews[reviewId] || null;
  }

  public addReview(review: Review): void {
    if (review.id) {
      this.cache.reviews[review.id] = review;
    }
  }

  public addReviews(reviews: Review[]): void {
    let newCount = 0;
    reviews.forEach(review => {
      if (review.id && !this.hasReview(review.id)) {
        this.addReview(review);
        newCount++;
      }
    });
    console.log(chalk.green(`📝 Added ${newCount} new reviews to cache`));
  }

  public getAllReviews(): Review[] {
    return Object.values(this.cache.reviews);
  }

  public getCachedReviewCount(): number {
    return Object.keys(this.cache.reviews).length;
  }

  public getStats(): { total: number; lastUpdated: string; hotelUrl: string } {
    return {
      total: this.getCachedReviewCount(),
      lastUpdated: this.cache.lastUpdated,
      hotelUrl: this.cache.hotelUrl
    };
  }

  public clearCache(): void {
    this.cache.reviews = {};
    this.cache.lastUpdated = new Date().toISOString();
    this.saveCache();
    console.log(chalk.yellow('🗑️  Cache cleared'));
  }

  public filterNewReviews(reviews: Review[]): Review[] {
    return reviews.filter(review => !this.hasReview(review.id));
  }
}