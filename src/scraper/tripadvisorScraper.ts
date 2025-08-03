import { chromium, Browser, Page } from 'playwright';
import { openBrowser, closeBrowser, getOrCreateProfile } from '../services/adpowerService';
import { Review, ScrapingResult } from '../types';
import { ReviewCache } from '../utils/reviewCache';
import chalk from 'chalk';

export class TripAdvisorScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private profileId: string | null = null;
  private cache: ReviewCache | null = null;

  async initialize(profileId: string): Promise<void> {
    try {
      console.log(chalk.blue('🚀 Initializing TripAdvisor scraper...'));
      
      console.log(chalk.green(`📋 Using profile: (${profileId})`));
      
      // Start browser through AdsPower
      const { wsEndpoint } = await openBrowser(profileId);
      
      // Connect Playwright to AdsPower browser
      this.browser = await chromium.connectOverCDP(wsEndpoint);
      
      // Get existing context or create new one
      const contexts = this.browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();
      
      // Create new page
      this.page = await context.newPage();
      
      console.log(chalk.green('✅ Browser initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize browser:'), error);
      throw error;
    }
  }

  async scrapeMultipleUrls(urls: string[], maxReviewsPerUrl?: number): Promise<ScrapingResult[]> {
    const allResults: ScrapingResult[] = [];
    
    console.log(chalk.blue.bold(`🚀 Starting batch scraping for ${urls.length} URLs...`));
    console.log(chalk.blue('=========================================\n'));

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(chalk.cyan.bold(`\n📍 Processing URL ${i + 1}/${urls.length}`));
      console.log(chalk.cyan(`🔗 ${url}`));
      console.log(chalk.cyan('─'.repeat(80)));

      try {
        const result = await this.scrapeReviews(url, maxReviewsPerUrl);
        allResults.push(result);
        
        console.log(chalk.green(`✅ URL ${i + 1}/${urls.length} completed successfully`));
        console.log(chalk.green(`📊 Reviews collected: ${result.scrapedReviews}`));
        
        // Add delay between URLs to be respectful
        if (i < urls.length - 1) {
          console.log(chalk.yellow('⏳ Waiting before next URL...'));
          await this.randomDelay(3000, 6000);
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Error processing URL ${i + 1}/${urls.length}:`), error);
        // Continue with next URL even if one fails
        const failedResult: ScrapingResult = {
          url,
          totalReviews: 0,
          scrapedReviews: 0,
          reviews: [],
          scrapedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        allResults.push(failedResult);
      }
    }

    // Summary
    console.log(chalk.green.bold('\n🎉 Batch Scraping Complete!'));
    console.log(chalk.green('=========================================='));
    const totalReviews = allResults.reduce((sum, result) => sum + result.scrapedReviews, 0);
    const successfulUrls = allResults.filter(result => !result.error).length;
    console.log(chalk.green(`✅ Successfully processed: ${successfulUrls}/${urls.length} URLs`));
    console.log(chalk.green(`📊 Total reviews collected: ${totalReviews}`));

    if (successfulUrls < urls.length) {
      const failedUrls = allResults.filter(result => result.error).length;
      console.log(chalk.yellow(`⚠️  Failed URLs: ${failedUrls}`));
    }

    return allResults;
  }

  async scrapeReviews(url: string, maxReviews?: number): Promise<ScrapingResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    // Initialize cache for this hotel
    this.cache = new ReviewCache(url);
    const cacheStats = this.cache.getStats();
    console.log(chalk.blue(`💾 Cache: ${cacheStats.total} existing reviews found`));

    console.log(chalk.blue(`🔍 Starting to scrape reviews from: ${url}`));
    
    try {
      // Navigate to the page with load event
      await this.page.goto(url, { waitUntil: 'load', timeout: 60000 });
      
      console.log(chalk.green('✅ Page loaded successfully'));
      
      // Wait for the page to load and process any blocking screens
      await this.randomDelay(3000, 5000);
      
      // Trigger dynamic content loading
      await this.triggerContentLoading();

      // Check for and handle any blocking screens
      await this.handleBlockingScreens();
      
      // Close any popups or modals
      await this.closePopups();
      
      // Extract reviews from all pages with pagination
      const reviews = await this.extractAllReviewsWithPagination(maxReviews);
      
      // Save cache
      if (this.cache) {
        this.cache.saveCache();
      }
      
      // Get final counts including cached reviews
      const totalCachedReviews = this.cache ? this.cache.getCachedReviewCount() : reviews.length;
      
      const result: ScrapingResult = {
        url,
        totalReviews: totalCachedReviews,
        scrapedReviews: reviews.length,
        reviews,
        scrapedAt: new Date().toISOString(),
      };
      
      console.log(chalk.green(`✅ Successfully scraped ${reviews.length} reviews (${totalCachedReviews} total in cache)`));
      return result;
      
    } catch (error) {
      console.error(chalk.red('❌ Error during scraping:'), error);
      throw error;
    }
  }

  private async handleBlockingScreens(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Check for CloudFlare or other security challenges
      const cfChallenge = this.page.locator('.cf-challenge, .cf-checking, #challenge-form');
      if (await cfChallenge.isVisible({ timeout: 3000 })) {
        console.log(chalk.yellow('⏳ Security challenge detected, waiting...'));
        await this.page.waitForSelector('.cf-challenge', { state: 'hidden', timeout: 60000 });
        await this.randomDelay(2000, 4000);
      }
      
      // Check for captcha
      const captchaSelectors = ['.g-recaptcha', '#captcha', '[data-sitekey]', '.captcha', 'iframe[src*="recaptcha"]'];
      for (const selector of captchaSelectors) {
        if (await this.page.locator(selector).isVisible({ timeout: 2000 })) {
          console.log(chalk.red('🔒 Captcha detected - manual intervention may be required'));
          await this.randomDelay(10000, 15000); // Wait longer for manual solving
          break;
        }
      }
      
      // Check for rate limiting messages
      const rateLimitTexts = ['too many requests', 'rate limit', 'slow down', 'try again later'];
      for (const text of rateLimitTexts) {
        if (await this.page.locator(`:text("${text}")`).isVisible({ timeout: 2000 })) {
          console.log(chalk.yellow(`⚠️  Rate limiting detected: ${text}`));
          await this.randomDelay(15000, 25000);
          break;
        }
      }
      
    } catch (error) {
      // Ignore errors in blocking screen detection
      console.log(chalk.yellow('⚠️  Error checking for blocking screens, continuing...'));
    }
  }

  private async triggerContentLoading(): Promise<void> {
    if (!this.page) return;
    
    try {
      console.log(chalk.blue('🔄 Triggering dynamic content loading...'));
      
      // Scroll down slowly to trigger lazy loading
      for (let i = 0; i < 5; i++) {
        await this.page.mouse.wheel(0, 500);
        await this.randomDelay(1000, 2000);
      }
      
      // Try to find and click on the Reviews tab if it exists
      const reviewsTabSelectors = [
        'a[href*="#REVIEWS"]',
        'button:has-text("Reviews")',
        'a:has-text("Reviews")',
        '[data-tab="REVIEWS"]',
        '.ui_tab[href*="Reviews"]'
      ];
      
      for (const selector of reviewsTabSelectors) {
        try {
          const tab = this.page.locator(selector);
          if (await tab.isVisible({ timeout: 2000 })) {
            console.log(chalk.green(`📋 Found Reviews tab with selector: ${selector}`));
            await tab.click();
            await this.randomDelay(3000, 5000);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      // Scroll down more to load reviews section
      for (let i = 0; i < 3; i++) {
        await this.page.mouse.wheel(0, 800);
        await this.randomDelay(1500, 2500);
      }
      
      // Wait for content to stabilize
      await this.randomDelay(3000, 5000);
      
    } catch (error) {
      console.log(chalk.yellow('⚠️  Error triggering content loading, continuing...'));
    }
  }

  private async closePopups(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Close cookie popup
      const cookieButton = this.page.locator('button:has-text("Accept"), button:has-text("I Accept")');
      if (await cookieButton.isVisible({ timeout: 2000 })) {
        await cookieButton.click();
        await this.randomDelay(1000, 2000);
      }
      
      // Close any modal dialogs
      const closeButtons = this.page.locator('[aria-label="Close"], .ui_close_x, button:has-text("×")');
      const count = await closeButtons.count();
      for (let i = 0; i < count; i++) {
        const button = closeButtons.nth(i);
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          await this.randomDelay(500, 1000);
        }
      }
    } catch (error) {
      // Ignore popup closing errors
    }
  }

  private async loadAllReviews(maxReviews?: number): Promise<void> {
    if (!this.page) return;
    
    console.log(chalk.blue('📄 Loading all reviews...'));
    
    // Click on "Reviews" tab if it exists  
    const reviewsTab = this.page.getByRole('tab', { name: 'Reviews' });
    if (await reviewsTab.isVisible({ timeout: 2000 })) {
      await reviewsTab.click();
      await this.randomDelay(3000, 5000);
    }

    let totalReviewsLoaded = 0;
    let hasMorePages = true;
    
    while (hasMorePages) {
      // Extract reviews on current page
      const reviews = await this.extractReviews();
      totalReviewsLoaded += reviews.length;
      
      if (maxReviews && totalReviewsLoaded >= maxReviews) {
        console.log(chalk.green(`📄 Reached maximum reviews limit: ${maxReviews}`));
        break;
      }

      // Check for next page button
      const nextButton = this.page.locator('a[data-smoke-attr="pagination-next-arrow"]').first();
      const isNextVisible = await nextButton.isVisible();

      if (!isNextVisible) {
        hasMorePages = false;
        break;
      }

      // Click next page
      await nextButton.click();
      await this.randomDelay(3000, 5000);
      
      // Verify page changed by checking reviews loaded
      const newReviews = await this.page.locator('[data-reviewid]').count();
      if (newReviews === 0) {
        hasMorePages = false;
        break;
      }

      // Add some random scrolling to look natural
      await this.humanLikeScroll();
    }

    console.log(chalk.green(`📄 Total reviews loaded: ${totalReviewsLoaded}`));
  }

  private async extractAllReviewsWithPagination(maxReviews?: number): Promise<Review[]> {
    const allReviews: Review[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    console.log(chalk.blue('🔄 Starting multi-page review extraction...'));

    while (hasMorePages && (!maxReviews || allReviews.length < maxReviews)) {
      console.log(chalk.yellow(`📄 Processing page ${currentPage}...`));
      
      // Extract reviews from current page
      const pageReviews = await this.extractReviews();
      const newReviews = pageReviews.filter(review => 
        !allReviews.some(existing => existing.id === review.id)
      );
      
      console.log(chalk.green(`📊 Found ${pageReviews.length} reviews on page ${currentPage} (${newReviews.length} new)`));
      
      // Add to total collection (respecting maxReviews limit)
      let addedCount = 0;
      for (const review of pageReviews) {
        if ((!maxReviews || allReviews.length < maxReviews) && 
            !allReviews.some(existing => existing.id === review.id)) {
          allReviews.push(review);
          addedCount++;
        }
      }

      console.log(chalk.blue(`📈 Total reviews collected: ${allReviews.length} (added ${addedCount} from this page)`));
      
      // If no new reviews found, we might have reached the end
      if (addedCount === 0) {
        console.log(chalk.yellow('⚠️ No new reviews found on this page, might have reached the end'));
      }

      // Check if we've reached the limit
      if (maxReviews && allReviews.length >= maxReviews) {
        console.log(chalk.yellow(`🎯 Reached maximum reviews limit (${maxReviews})`));
        break;
      }

      // Try to navigate to next page
      hasMorePages = await this.navigateToNextPage();
      if (hasMorePages) {
        currentPage++;
        await this.randomDelay(2000, 4000); // Delay between page loads
      } else {
        console.log(chalk.blue('📄 No more pages found'));
      }
    }

    console.log(chalk.green(`✅ Completed pagination. Total reviews: ${allReviews.length}`));
    return allReviews;
  }

  private async extractReviews(): Promise<Review[]> {
    if (!this.page) return [];
    
    console.log(chalk.blue('📝 Extracting review data...'));
    
    // Wait longer for dynamic content
    await this.randomDelay(3000, 5000);

    // Find all review cards using multiple selectors for different page types
    console.log(chalk.yellow('🔍 Looking for review cards...'));
    
    const reviewCardSelectors = [
      '[data-reviewid]',                                    // Hotel pages
      '[data-test-target="review-card"]',                   // Alternative review cards
      '.review-container',                                  // Generic review containers
      '#tab-review-content div:has(svg[aria-labelledby])',  // Divs containing rating SVGs
      '#tab-review-content div:has([href*="/Profile/"])',   // Divs containing profile links
      '#tab-review-content div:has-text("wrote a review")', // Divs containing review text
      '#tab-review-content > div > div',                   // Individual reviews within the container
      '#tab-review-content [class*="review"]',             // Reviews with "review" in class inside container
      '#tab-review-content > div',                         // Direct children of review container
      '[class*="review"]',                                  // Any element with "review" in class
      '.ui_column.is-9 > div',                             // TripAdvisor layout containers
      'article',                                            // Semantic review articles
      'div[id*="review"]',                                  // Elements with "review" in ID (fallback)
    ];
    
    let reviewCards: any[] = [];
    
    for (const selector of reviewCardSelectors) {
      try {
        const cards = await this.page.locator(selector).all();
        if (cards.length > 0) {
          console.log(chalk.green(`✅ Found ${cards.length} review cards with selector: ${selector}`));
          
          // Debug: Log some info about the first few cards to understand what we're getting
          if (cards.length > 0) {
            try {
              for (let i = 0; i < Math.min(3, cards.length); i++) {
                const card = cards[i];
                const cardId = await card.getAttribute('id') || 'no-id';
                const cardClass = await card.getAttribute('class') || 'no-class';
                const cardText = await card.textContent() || '';
                console.log(chalk.gray(`    🔍 Card ${i+1} debug - ID: ${cardId}, Class: ${cardClass.substring(0, 50)}...`));
                console.log(chalk.gray(`    📝 Card ${i+1} text preview: ${cardText.substring(0, 100).replace(/\s+/g, ' ')}...`));
                
                // If this looks like the main container, check its children
                if (cardId === 'tab-review-content' || cardText.includes('FiltersEnglish')) {
                  const children = await card.locator('> div').all();
                  console.log(chalk.yellow(`    🔄 Container detected, checking ${children.length} children...`));
                  for (let j = 0; j < Math.min(3, children.length); j++) {
                    const child = children[j];
                    const childClass = await child.getAttribute('class') || 'no-class';
                    const childText = await child.textContent() || '';
                    console.log(chalk.gray(`      📋 Child ${j+1} - Class: ${childClass.substring(0, 30)}...`));
                    console.log(chalk.gray(`      📝 Child ${j+1} text: ${childText.substring(0, 80).replace(/\s+/g, ' ')}...`));
                  }
                }
              }
            } catch (e) {
              console.log(chalk.gray(`    ⚠️ Error debugging cards: ${e}`));
            }
          }
          
          // Special handling: if we found the main container, look inside for individual reviews
          if (cards.length === 1) {
            const card = cards[0];
            const cardId = await card.getAttribute('id') || '';
            const cardText = await card.textContent() || '';
            
            if (cardId === 'tab-review-content' || cardText.includes('FiltersEnglish')) {
              console.log(chalk.yellow(`    🔄 Detected main review container, looking for individual reviews inside...`));
              
              // Try to find individual review elements inside the container
              const innerSelectors = [
                '> div > div[class*="review"]',
                '> div > div',
                '> div',
                'div[data-automation]',
                'div[class*="ui_column"]',
              ];
              
              for (const innerSelector of innerSelectors) {
                try {
                  const innerCards = await card.locator(innerSelector).all();
                  if (innerCards.length > 1) { // We want multiple reviews, not just one container
                    console.log(chalk.green(`    ✅ Found ${innerCards.length} individual reviews with: ${innerSelector}`));
                    reviewCards = innerCards;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
              
              if (reviewCards.length > 1) {
                break; // We found individual reviews
              } else {
                console.log(chalk.yellow(`    ⚠️ Could not find individual reviews inside container, using container`));
                reviewCards = cards;
                break;
              }
            } else {
              reviewCards = cards;
              break;
            }
          } else {
            reviewCards = cards;
            break;
          }
        } else {
          console.log(chalk.gray(`    ⚪ No cards found with: ${selector}`));
        }
      } catch (error) {
        console.log(chalk.gray(`    ❌ Error with selector ${selector}:`, error));
        continue;
      }
    }
    
    console.log(chalk.green(`📊 Total review cards found: ${reviewCards.length}`));
    
    // If no review cards found, debug the page structure
    if (reviewCards.length === 0) {
      await this.debugPageStructure();
    }

    // Process review cards in parallel with concurrency control
    const reviews = await this.processReviewCardsInParallel(reviewCards);
    console.log(chalk.green(`✅ Completed parallel processing. Total reviews: ${reviews.length}`));

    return reviews;
  }

  private async processReviewCardsInParallel(reviewCards: any[]): Promise<Review[]> {
    const reviews: Review[] = [];
    const concurrencyLimit = 10; // Process 5 reviews at a time to avoid overwhelming the page
    
    console.log(chalk.blue(`🚀 Processing ${reviewCards.length} review cards in parallel (${concurrencyLimit} at a time)...`));

    // Process cards in batches
    for (let i = 0; i < reviewCards.length; i += concurrencyLimit) {
      const batch = reviewCards.slice(i, i + concurrencyLimit);
      const batchNumber = Math.floor(i / concurrencyLimit) + 1;
      const totalBatches = Math.ceil(reviewCards.length / concurrencyLimit);
      
      console.log(chalk.yellow(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} cards)...`));

      // Process current batch in parallel
      const batchPromises = batch.map((card, batchIndex) => 
        this.processSingleReviewCard(card, i + batchIndex + 1, reviewCards.length)
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful results
        let successCount = 0;
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            reviews.push(result.value);
            successCount++;
          } else if (result.status === 'rejected') {
            console.error(chalk.red(`❌ Error processing review ${i + index + 1}:`), result.reason);
          }
        });

        console.log(chalk.green(`✅ Batch ${batchNumber} completed: ${successCount}/${batch.length} reviews extracted`));
        
        // Small delay between batches to be respectful
        if (i + concurrencyLimit < reviewCards.length) {
          await this.randomDelay(500, 1000);
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error processing batch ${batchNumber}:`), error);
      }
    }

    return reviews;
  }

  private async processSingleReviewCard(card: any, index: number, total: number): Promise<Review | null> {
    try {
      // Try multiple methods to get review ID
      let reviewId = await card.getAttribute('data-reviewid') || '';
      
      if (!reviewId) {
        // Try to extract from id attribute
        const idAttr = await card.getAttribute('id') || '';
        if (idAttr.includes('review')) {
          reviewId = idAttr;
        } else {
          // Generate a unique ID based on content if no ID found
          const cardText = await card.textContent() || '';
          reviewId = `generated_${index}_${cardText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
      }
      
      console.log(chalk.gray(`  📋 [${index}/${total}] Review ID: ${reviewId}`));
      
      // Check if review is already cached
      if (this.cache && this.cache.hasReview(reviewId)) {
        console.log(chalk.gray(`  💾 [${index}/${total}] Review already cached, using cache...`));
        const cachedReview = this.cache.getReview(reviewId);
        return cachedReview;
      }
      
      // Extract all data in parallel
      const [reviewerName, rating, reviewTitle, reviewText, reviewDate] = await Promise.all([
        this.extractReviewerName(card),
        this.extractRatingFromCard(card),
        this.extractReviewTitle(card),
        this.extractReviewText(card),
        this.extractReviewDate(card)
      ]);

      console.log(chalk.gray(`  ✨ [${index}/${total}] Extracted: ${reviewerName} | ${rating}⭐ | "${reviewTitle ? reviewTitle.substring(0, 30) + '...' : 'No title'}"`));
      
      if (reviewerName && (reviewText || reviewTitle)) {
        const newReview: Review = {
          id: reviewId,
          reviewerName: reviewerName.trim(),
          rating,
          reviewTitle: reviewTitle.trim(),
          reviewText: reviewText.trim(),
          reviewDate: reviewDate.trim(),
          helpfulVotes: 0,
          isVerified: false
        };
        
        // Add to cache
        if (this.cache) {
          this.cache.addReview(newReview);
        }
        
        return newReview;
      } else {
        console.log(chalk.yellow(`  ⚠️  [${index}/${total}] Review skipped - missing required data`));
        return null;
      }
    } catch (error) {
      console.error(chalk.red(`❌ [${index}/${total}] Error extracting review:`), error);
      return null;
    }
  }

  private async extractRatingFromCard(card: any): Promise<number> {
    // Try multiple approaches to get rating
    
    // Method 1: Find any SVG and check its title
    try {
      const svgs = await card.locator('svg').all();
      for (const svg of svgs) {
        try {
          const title = await svg.locator('title').textContent();
          if (title && title.includes('bubble')) {
            console.log(chalk.gray(`    ✅ Found rating in SVG title: "${title}"`));
            const match = title.match(/(\d+)\s+of\s+\d+\s+bubble/i);
            if (match) {
              return parseInt(match[1]);
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Error checking SVG titles`));
    }

    // Method 2: Look for aria-label on SVG elements
    try {
      const svgWithAria = await card.locator('svg[aria-labelledby]').first();
      const ariaId = await svgWithAria.getAttribute('aria-labelledby');
      if (ariaId) {
        const titleElement = await card.locator(`title[id="${ariaId}"]`).first();
        const titleText = await titleElement.textContent();
        if (titleText && titleText.includes('bubble')) {
          console.log(chalk.gray(`    ✅ Found rating via aria-labelledby: "${titleText}"`));
          const match = titleText.match(/(\d+)\s+of\s+\d+\s+bubble/i);
          if (match) {
            return parseInt(match[1]);
          }
        }
      }
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Error checking aria-labelledby`));
    }

    // Method 3: Count filled vs empty circles/bubbles
    try {
      const filledBubbles = await card.locator('svg path[d*="12 0C5.388"]:not([d*="2a9.983"])').count();
      if (filledBubbles > 0 && filledBubbles <= 5) {
        console.log(chalk.gray(`    ✅ Found rating by counting filled bubbles: ${filledBubbles}`));
        return filledBubbles;
      }
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Error counting bubbles`));
    }

    return 0;
  }

  private async getTextContent(card: any, selector: string, timeout: number = 2000): Promise<string> {
    try {
      const element = card.locator(selector).first();
      await element.waitFor({ timeout });
      const text = await element.textContent();
      return text?.trim() || '';
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Timeout on selector: ${selector}`));
      return '';
    }
  }

  private async extractReviewerName(card: any): Promise<string> {
    // Based on the HTML structure, the reviewer name is in a specific pattern:
    // <a href="/Profile/username"><span class="CjfFL LJbhp">ActualName</span></a>
    
    // Method 1: Look for profile links that contain spans (the actual name)
    try {
      const profileLinks = await card.locator('a[href*="/Profile/"]').all();
      for (const link of profileLinks) {
        // Check if this link has a span child - that's where the name is
        const nameSpan = await link.locator('span').first();
        try {
          const text = await nameSpan.textContent();
          if (text && text.trim() && 
              !text.includes('wrote') && 
              !text.includes('Read more') &&
              !text.includes('contributions') &&
              !text.includes('helpful') &&
              !text.includes('Filters') &&
              !text.includes('Filter') &&
              !text.includes('Sort') &&
              !text.includes('Menu') &&
              !text.includes('Search') &&
              text.trim().length > 2 && 
              text.trim().length < 50) {
            console.log(chalk.gray(`    ✅ Found reviewer name in span: ${text.trim()}`));
            return text.trim();
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Error getting profile link spans`));
    }

    // Method 2: Look for the specific "wrote a review" pattern
    try {
      // Find text containing "wrote a review" and get the preceding link
      const reviewAuthorSection = await card.locator('text=/wrote a review/').first();
      const parentDiv = await reviewAuthorSection.locator('xpath=..').first();
      const authorLink = await parentDiv.locator('a[href*="/Profile/"] span').first();
      const text = await authorLink.textContent();
      if (text && text.trim()) {
        console.log(chalk.gray(`    ✅ Found reviewer name via "wrote a review": ${text.trim()}`));
        return text.trim();
      }
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Error finding via "wrote a review" pattern`));
    }

    // Method 3: Fallback patterns with pre-filtering
    const uiElementsToFilter = [
      'filters', 'filter', 'sort', 'menu', 'search', 'show more', 'show less',
      'read more', 'wrote a review', 'contributions', 'helpful votes',
      'hotel\'s favourite', 'response from', 'date of stay', 'trip type',
      'reviews', 'photos', 'location', 'contact', 'book now', 'check availability',
      'overview', 'amenities', 'policies', 'the area', 'guest reviews',
      'map', 'nearby', 'similar', 'more', 'less', 'all', 'none', 'apply',
      'clear', 'close', 'open', 'save', 'share', 'like', 'follow',
      'traveller', 'business', 'family', 'couple', 'solo', 'friends'
    ];

    // Helper function to check if text is a UI element
    const isUIElement = (text: string): boolean => {
      const lowerText = text.toLowerCase().trim();
      return uiElementsToFilter.some(uiText => lowerText === uiText || lowerText.includes(uiText));
    };

    // More targeted selectors to avoid UI elements
    const selectors = [
      // Look for spans that are direct children of profile links (most reliable)
      'a[href*="/Profile/"] > span',
      // Look for text content that looks like actual names
      'span:text-matches("^[A-Z][a-z]+\\\\s+[A-Z]")', // First Last pattern
      'span:text-matches("^[A-Z][a-z]{2,}$")',         // Single name pattern
    ];

    for (const selector of selectors) {
      try {
        const elements = await card.locator(selector).all();
        
        for (const element of elements) {
          try {
            await element.waitFor({ timeout: 1000 });
            const text = await element.textContent();
            
            if (text && text.trim() && 
                text.trim().length > 2 && 
                text.trim().length < 50 &&
                /^[A-Za-z]/.test(text.trim()) && // Must start with letter
                !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text.trim()) && // Not a month
                !isUIElement(text.trim()) // Apply UI filtering
              ) {
              console.log(chalk.gray(`    ✅ Found reviewer name with: ${selector} - "${text.trim()}"`));
              return text.trim();
            }
          } catch (e) {
            continue;
          }
        }
      } catch (error) {
        console.log(chalk.gray(`    ⏰ Timeout on reviewer selector: ${selector}`));
        continue;
      }
    }
    
    // Final fallback: look for ANY text but with strict UI filtering
    try {
      const allSpans = await card.locator('span').all();
      for (const span of allSpans) {
        try {
          const text = await span.textContent();
          if (text && text.trim() && 
              text.trim().length > 2 && 
              text.trim().length < 50 &&
              /^[A-Z][a-z]+/.test(text.trim()) && // Must be capitalized like a name
              !isUIElement(text.trim()) &&
              !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text.trim())
            ) {
            console.log(chalk.gray(`    ✅ Found reviewer name (fallback): "${text.trim()}"`));
            return text.trim();
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.log(chalk.gray(`    ⏰ Error in fallback reviewer search`));
    }
    
    return 'Anonymous';
  }

  private async extractReviewDate(card: any): Promise<string> {
    const selectors = [
      // Look for "Date of stay:" text and get following span
      'text="Date of stay:" >> xpath=following-sibling::span',
      ':text("Date of stay:") + span',
      // Find div containing "Date of stay:" then get span
      'div:has-text("Date of stay:") span:last-child',
      // Look for month/year patterns
      'span:text-matches("(January|February|March|April|May|June|July|August|September|October|November|December) \\d{4}")',
      'span:text-matches("\\w+ \\d{4}")',
      // Last resort - any span with date-like content
      'span:text-matches("\\d{4}")'
    ];

    for (const selector of selectors) {
      try {
        const element = card.locator(selector).first();
        await element.waitFor({ timeout: 2000 });
        const text = await element.textContent();
        if (text && text.trim() && !text.includes('contributions') && !text.includes('helpful votes')) {
          console.log(chalk.gray(`    ✅ Found date with: ${selector}`));
          return text.trim();
        }
      } catch (error) {
        console.log(chalk.gray(`    ⏰ Timeout on date selector: ${selector}`));
        continue;
      }
    }
    
    return '';
  }

  private async extractReviewTitle(card: any): Promise<string> {
    const selectors = [
      // Use data attribute first (most stable)
      '[data-test-target="review-title"]',
      '[data-test-target="review-title"] a',
      '[data-test-target="review-title"] span',
      // Look for heading elements
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Find clickable review title links
      'a[href*="ShowUserReviews"]',
      'a[href*="Reviews"] span',
      // Fallback to large text elements
      'span:text-matches(".{10,100}")'
    ];

    for (const selector of selectors) {
      try {
        const element = card.locator(selector).first();
        await element.waitFor({ timeout: 2000 });
        const text = await element.textContent();
        if (text && text.trim().length > 5 && text.trim().length < 200) {
          console.log(chalk.gray(`    ✅ Found title with: ${selector}`));
          return text.trim();
        }
      } catch (error) {
        console.log(chalk.gray(`    ⏰ Timeout on title selector: ${selector}`));
        continue;
      }
    }
    
    return '';
  }

  private async extractReviewText(card: any): Promise<string> {
    const selectors = [
      // Use data automation attribute (most stable)
      '[data-automation*="reviewText"]',
      '[data-automation^="reviewText"]',
      // Look for text content spans with substantial content
      'span:text-matches(".{50,}")',
      // Find divs with review content
      'div:has-text("Read more")',
      'div:text-matches(".{100,}")',
      // Last resort - any long text content
      ':text-matches(".{80,}")'
    ];

    for (const selector of selectors) {
      try {
        const element = card.locator(selector).first();
        await element.waitFor({ timeout: 2000 });
        const text = await element.textContent();
        if (text && text.trim().length > 20) {
          console.log(chalk.gray(`    ✅ Found text with: ${selector}`));
          return text.trim();
        }
      } catch (error) {
        console.log(chalk.gray(`    ⏰ Timeout on text selector: ${selector}`));
        continue;
      }
    }
    
    return '';
  }

  private async navigateToNextPage(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log(chalk.yellow('🔍 Looking for next page button...'));

      // Multiple selectors for next page button based on the HTML structure
      const nextPageSelectors = [
        // Based on the HTML you provided
        'a[data-smoke-attr="pagination-next-arrow"]',
        'a[aria-label="Next page"]',
        '.IGLCo a', // Next arrow container
        // Fallback selectors
        'a:has-text("Next")',
        'a[href*="or10-"], a[href*="or20-"], a[href*="or30-"]', // TripAdvisor pagination pattern
        '.pagination a:last-child',
        'a:has(svg):last-of-type' // Arrow SVG
      ];

      for (const selector of nextPageSelectors) {
        try {
          const nextButton = this.page.locator(selector).first();
          
          // Check if button exists and is enabled
          const isVisible = await nextButton.isVisible({ timeout: 1000 });
          if (!isVisible) continue;

          const isDisabled = await nextButton.getAttribute('disabled');
          if (isDisabled) {
            console.log(chalk.gray(`    ⚠️  Next button is disabled`));
            continue;
          }

          // Check if it's not the current page
          const href = await nextButton.getAttribute('href');
          if (href) {
            console.log(chalk.green(`    ✅ Found next page link: ${href}`));
            
            // Click the next page button
            await Promise.all([
              this.page.waitForLoadState('networkidle'),
              nextButton.click()
            ]);
            
            await this.randomDelay(3000, 5000); // Wait for page to load
            console.log(chalk.green('✅ Successfully navigated to next page'));
            return true;
          }

        } catch (error) {
          console.log(chalk.gray(`    ⏰ Selector failed: ${selector}`));
          continue;
        }
      }

      console.log(chalk.yellow('📄 No next page button found - reached end'));
      return false;

    } catch (error) {
      console.error(chalk.red('❌ Error navigating to next page:'), error);
      return false;
    }
  }

  private async humanLikeScroll(): Promise<void> {
    if (!this.page) return;
    
    // Random scroll pattern
    const scrollSteps = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < scrollSteps; i++) {
      await this.page.mouse.wheel(0, Math.random() * 500 + 200);
      await this.randomDelay(200, 800);
    }
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async debugPageStructure(): Promise<void> {
    if (!this.page) return;
    
    console.log(chalk.yellow('🔍 Debugging page structure - looking for review elements...'));
    
    try {
      // Check page title and URL to understand page type
      const title = await this.page.title();
      const url = this.page.url();
      console.log(chalk.blue(`📄 Page Title: ${title}`));
      console.log(chalk.blue(`🔗 Current URL: ${url}`));
      
      // Look for common review-related text patterns
      const reviewTexts = [
        'review', 'Review', 'REVIEW',
        'rating', 'Rating', 'RATING', 
        'wrote a review', 'reviewed',
        'star', 'stars', 'bubble', 'bubbles'
      ];
      
      for (const text of reviewTexts) {
        try {
          const elements = await this.page.locator(`:text("${text}")`).all();
          if (elements.length > 0) {
            console.log(chalk.gray(`    ✅ Found ${elements.length} elements containing "${text}"`));
          }
        } catch (e) {
          // Ignore errors for individual text searches
        }
      }
      
      // Check for any data attributes that might contain reviews
      const dataAttributes = ['data-reviewid', 'data-test', 'data-automation', 'data-track'];
      for (const attr of dataAttributes) {
        try {
          const elements = await this.page.locator(`[${attr}]`).all();
          if (elements.length > 0) {
            console.log(chalk.gray(`    📋 Found ${elements.length} elements with ${attr} attribute`));
            // Log first few attribute values for analysis
            for (let i = 0; i < Math.min(3, elements.length); i++) {
              const value = await elements[i].getAttribute(attr);
              console.log(chalk.gray(`        - ${attr}="${value}"`));
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Check for common review container classes
      const reviewClasses = [
        '.review', '.Review', '.REVIEW',
        '.ui_column', '.column',
        '.card', '.Card',
        '.container', '.Container'
      ];
      
      for (const cls of reviewClasses) {
        try {
          const elements = await this.page.locator(cls).all();
          if (elements.length > 0) {
            console.log(chalk.gray(`    🎨 Found ${elements.length} elements with class "${cls}"`));
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
    } catch (error) {
      console.log(chalk.yellow('⚠️ Error during page structure debugging'), error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      
      if (this.profileId) {
        await closeBrowser(this.profileId);
        console.log(chalk.green('✅ Browser cleanup completed'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during cleanup:'), error);
    }
  }
}