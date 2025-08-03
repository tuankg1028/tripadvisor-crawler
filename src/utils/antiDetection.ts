import { Page } from 'playwright';

export class AntiDetectionUtils {
  static async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  static async humanLikeTyping(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await this.randomDelay(100, 300);
    
    for (const char of text) {
      await page.keyboard.type(char);
      await this.randomDelay(50, 150);
    }
  }

  static async humanLikeMouseMovement(page: Page): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) return;
    
    // Generate random mouse movements
    const movements = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < movements; i++) {
      const x = Math.floor(Math.random() * viewport.width);
      const y = Math.floor(Math.random() * viewport.height);
      
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
      await this.randomDelay(100, 500);
    }
  }

  static async naturalScrolling(page: Page, direction: 'down' | 'up' = 'down'): Promise<void> {
    const scrollAmount = Math.floor(Math.random() * 500) + 200;
    const scrollSteps = Math.floor(Math.random() * 5) + 3;
    const stepAmount = scrollAmount / scrollSteps;
    
    for (let i = 0; i < scrollSteps; i++) {
      const delta = direction === 'down' ? stepAmount : -stepAmount;
      await page.mouse.wheel(0, delta);
      await this.randomDelay(100, 300);
    }
  }

  static async simulateReading(page: Page, element?: string): Promise<void> {
    // Simulate reading time based on content length
    if (element) {
      try {
        const textContent = await page.textContent(element);
        const wordCount = textContent ? textContent.split(' ').length : 50;
        const readingTime = Math.max(wordCount * 100, 2000); // ~100ms per word, min 2s
        await this.randomDelay(readingTime * 0.8, readingTime * 1.2);
      } catch {
        await this.randomDelay(2000, 5000);
      }
    } else {
      await this.randomDelay(2000, 5000);
    }
  }

  static async randomPageInteraction(page: Page): Promise<void> {
    const actions = [
      () => this.humanLikeMouseMovement(page),
      () => this.naturalScrolling(page, 'down'),
      () => this.naturalScrolling(page, 'up'),
      () => this.randomDelay(1000, 3000)
    ];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    await randomAction();
  }

  static async waitForPageStability(page: Page, timeout: number = 5000): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch {
      // Fallback to domcontentloaded if networkidle fails
      await page.waitForLoadState('domcontentloaded', { timeout: timeout / 2 });
    }
  }

  static async handleCaptcha(page: Page): Promise<boolean> {
    // Check for common captcha indicators
    const captchaSelectors = [
      '.g-recaptcha',
      '#captcha',
      '[data-sitekey]',
      '.captcha',
      'iframe[src*="recaptcha"]',
      '.hcaptcha',
      '.cf-challenge'
    ];

    for (const selector of captchaSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 })) {
        console.log('🔒 Captcha detected. Manual intervention may be required.');
        return true;
      }
    }

    return false;
  }

  static async bypassCommonBlocks(page: Page): Promise<void> {
    try {
      // Handle CloudFlare challenge
      const cfChallenge = page.locator('.cf-challenge, .cf-checking');
      if (await cfChallenge.isVisible({ timeout: 3000 })) {
        console.log('⏳ CloudFlare challenge detected, waiting...');
        await page.waitForSelector('.cf-challenge', { state: 'hidden', timeout: 30000 });
      }

      // Handle rate limiting notices
      const rateLimitSelectors = [
        ':text("too many requests")',
        ':text("rate limit")',
        ':text("slow down")',
        ':text("try again later")'
      ];

      for (const selector of rateLimitSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          console.log('⚠️ Rate limiting detected');
          await this.randomDelay(10000, 20000);
          break;
        }
      }

    } catch (error) {
      // Ignore errors in block detection
    }
  }

  static getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  static async injectAntiDetectionScripts(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override chrome property
      (window as any).chrome = {
        runtime: {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
  }
}