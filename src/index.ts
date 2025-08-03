#!/usr/bin/env node

import { TripAdvisorScraper } from './scraper/tripadvisorScraper';
import { DataExporter } from './utils/dataExporter';
import { ReviewCache } from './utils/reviewCache';
import { config, validateConfig } from './config';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

async function handleCacheCommand() {
  const action = process.argv[3];
  const url = process.argv[4];

  switch (action) {
    case 'stats':
      if (url) {
        const cache = new ReviewCache(url);
        const stats = cache.getStats();
        console.log(chalk.blue.bold('📊 Cache Statistics'));
        console.log(chalk.blue('=================='));
        console.log(chalk.green(`🏨 Hotel URL: ${stats.hotelUrl}`));
        console.log(chalk.green(`📝 Total Reviews: ${stats.total}`));
        console.log(chalk.green(`📅 Last Updated: ${new Date(stats.lastUpdated).toLocaleString()}`));
      } else {
        console.log(chalk.yellow('Usage: npm run scrape cache stats <url>'));
      }
      break;
      
    case 'clear':
      if (url) {
        const cache = new ReviewCache(url);
        cache.clearCache();
        console.log(chalk.green('✅ Cache cleared successfully'));
      } else {
        console.log(chalk.yellow('Usage: npm run scrape cache clear <url>'));
      }
      break;
      
    default:
      console.log(chalk.yellow('Available cache commands:'));
      console.log(chalk.yellow('  stats <url> - Show cache statistics'));
      console.log(chalk.yellow('  clear <url> - Clear cache for specific URL'));
  }
}

async function main() {
  console.log(chalk.blue.bold('🏨 TripAdvisor Review Scraper'));
  console.log(chalk.blue('=====================================\n'));

  // Validate configuration
  if (!validateConfig()) {
    console.error(chalk.red('❌ Configuration validation failed'));
    process.exit(1);
  }

  // Get command and arguments
  const command = process.argv[2];
  
  // Handle cache commands
  if (command === 'cache') {
    await handleCacheCommand();
    return;
  }
  
  // Check if it's multiple URLs (comma-separated or file)
  const urlInput = command;
  const maxReviews = process.argv[3] ? parseInt(process.argv[3]) : undefined;
  const profileName = process.argv[4];

  if (!urlInput) {
    console.log(chalk.yellow('Usage:'));
    console.log(chalk.yellow('  npm run scrape <url> [maxReviews] [profileName]'));
    console.log(chalk.yellow('  npm run scrape <url1,url2,url3> [maxReviews] [profileName]'));
    console.log(chalk.yellow('  npm run scrape file:<path-to-urls.txt> [maxReviews] [profileName]'));
    console.log(chalk.yellow('  npm run scrape cache <action> [url]'));
    console.log(chalk.yellow(''));
    console.log(chalk.yellow('Examples:'));
    console.log(chalk.yellow('  npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..." 100 "MyProfile"'));
    console.log(chalk.yellow('  npm run scrape "url1,url2,url3" 50 "MyProfile"'));
    console.log(chalk.yellow('  npm run scrape file:urls.txt 100 "MyProfile"'));
    console.log(chalk.yellow('  npm run scrape cache stats'));
    console.log(chalk.yellow('  npm run scrape cache clear <url>'));
    process.exit(1);
  }

  // Parse URLs from input
  const urls = await parseUrlInput(urlInput);

async function parseUrlInput(input: string): Promise<string[]> {
  // If input starts with "file:", read URLs from file
  if (input.startsWith('file:')) {
    const filePath = input.substring(5); // Remove "file:" prefix
    try {
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`❌ File not found: ${filePath}`));
        return [];
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const urls = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Filter empty lines and comments
      
      console.log(chalk.blue(`📁 Loaded ${urls.length} URLs from file: ${filePath}`));
      return urls;
    } catch (error) {
      console.error(chalk.red(`❌ Error reading file ${filePath}:`), error);
      return [];
    }
  }
  
  // If input contains commas, split by comma
  if (input.includes(',')) {
    const urls = input.split(',').map(url => url.trim()).filter(url => url);
    console.log(chalk.blue(`📋 Parsed ${urls.length} URLs from comma-separated input`));
    return urls;
  }
  
  // Single URL
  return [input.trim()];
}
  
  if (urls.length === 0) {
    console.error(chalk.red('❌ No valid URLs found'));
    process.exit(1);
  }

  // Validate URLs
  for (const url of urls) {
    if (!url.includes('tripadvisor.')) {
      console.error(chalk.red(`❌ Invalid TripAdvisor URL: ${url}`));
      process.exit(1);
    }
  }

  const scraper = new TripAdvisorScraper();
  const exporter = new DataExporter(config.scraper.outputDir);

  try {
    // Initialize scraper
    await scraper.initialize(profileName);

    if (maxReviews) {
      console.log(chalk.blue(`📊 Max Reviews per URL: ${maxReviews}`));
    }
    console.log('');

    let results: any;
    
    if (urls.length === 1) {
      // Single URL - use existing logic
      console.log(chalk.blue(`🎯 Target URL: ${urls[0]}`));
      results = await scraper.scrapeReviews(urls[0], maxReviews);
      
      // Display results for single URL
      console.log('\n' + chalk.green.bold('📊 Scraping Results:'));
      console.log(chalk.green(`✅ Business: ${results.businessName || 'Unknown'}`));
      console.log(chalk.green(`📍 Location: ${results.businessLocation || 'Unknown'}`));
      console.log(chalk.green(`⭐ Overall Rating: ${results.overallRating || 'Unknown'}`));
      console.log(chalk.green(`📝 Reviews Scraped: ${results.scrapedReviews}`));
      
    } else {
      // Multiple URLs - use batch processing
      console.log(chalk.blue(`🎯 Target URLs: ${urls.length} URLs`));
      results = await scraper.scrapeMultipleUrls(urls, maxReviews);
      
      // Display summary for multiple URLs
      console.log('\n' + chalk.green.bold('📊 Batch Scraping Results:'));
      const totalReviews = results.reduce((sum: number, result: any) => sum + result.scrapedReviews, 0);
      const successfulUrls = results.filter((result: any) => !result.error).length;
      console.log(chalk.green(`✅ Successfully processed: ${successfulUrls}/${urls.length} URLs`));
      console.log(chalk.green(`📝 Total reviews scraped: ${totalReviews}`));
    }

    // Export data
    console.log('\n' + chalk.blue('💾 Exporting data...'));
    const exports = await exporter.exportAll(results);

    console.log('\n' + chalk.green.bold('🎉 Export Complete!'));
    console.log(chalk.green(`📄 JSON: ${exports.json}`));
    console.log(chalk.green(`📊 CSV: ${exports.csv}`));
    console.log(chalk.green(`📋 Summary: ${exports.summary}`));

  } catch (error) {
    console.error(chalk.red('\n❌ Scraping failed:'), error);
    process.exit(1);
  } finally {
    // Cleanup
    await scraper.cleanup();
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n⚠️  Received SIGINT, cleaning up...'));
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n⚠️  Received SIGTERM, cleaning up...'));
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Unhandled error:'), error);
    process.exit(1);
  });
}