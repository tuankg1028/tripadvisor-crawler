import dotenv from 'dotenv';

dotenv.config();

export const config = {
  adspower: {
    baseUrl: process.env.ADSPOWER_BASE_URL || 'http://local.adspower.net:50325',
    groupId: process.env.ADSPOWER_GROUP_ID || '3760701',
    hideChrome: process.env.HIDE_CHROME === '1',
  },
  scraper: {
    maxReviewsPerPage: parseInt(process.env.MAX_REVIEWS_PER_PAGE || '50'),
    delayMin: parseInt(process.env.DELAY_MIN || '1000'),
    delayMax: parseInt(process.env.DELAY_MAX || '3000'),
    outputFormat: process.env.OUTPUT_FORMAT || 'json',
    outputDir: process.env.OUTPUT_DIR || './output',
  },
  browser: {
    timeout: 30000,
    navigationTimeout: 30000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
};

export const validateConfig = (): boolean => {
  const required = [
    'ADSPOWER_BASE_URL',
    'ADSPOWER_GROUP_ID'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }

  return true;
};