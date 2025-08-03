import * as fs from 'fs';
import * as path from 'path';
import * as createCsvWriter from 'csv-writer';
import { ScrapingResult, Review } from '../types';
import chalk from 'chalk';

export class DataExporter {
  private outputDir: string;

  constructor(outputDir: string = './output') {
    this.outputDir = outputDir;
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async exportToJson(data: ScrapingResult, filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `tripadvisor_reviews_${timestamp}.json`;
    const filePath = path.join(this.outputDir, outputFilename);

    try {
      const jsonData = JSON.stringify(data, null, 2);
      await fs.promises.writeFile(filePath, jsonData, 'utf8');
      
      console.log(chalk.green(`✅ JSON exported successfully: ${filePath}`));
      return filePath;
    } catch (error) {
      console.error(chalk.red('❌ Error exporting JSON:'), error);
      throw error;
    }
  }

  async exportToCsv(data: ScrapingResult, filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `tripadvisor_reviews_${timestamp}.csv`;
    const filePath = path.join(this.outputDir, outputFilename);

    try {
      const csvWriter = createCsvWriter.createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'Review ID' },
          { id: 'reviewerName', title: 'Reviewer Name' },
          { id: 'reviewerLocation', title: 'Reviewer Location' },
          { id: 'rating', title: 'Rating' },
          { id: 'reviewTitle', title: 'Review Title' },
          { id: 'reviewText', title: 'Review Text' },
          { id: 'reviewDate', title: 'Review Date' },
          { id: 'helpfulVotes', title: 'Helpful Votes' },
          { id: 'totalVotes', title: 'Total Votes' },
          { id: 'isVerified', title: 'Is Verified' },
          { id: 'tripType', title: 'Trip Type' },
          { id: 'stayDate', title: 'Stay Date' }
        ]
      });

      await csvWriter.writeRecords(data.reviews);
      
      console.log(chalk.green(`✅ CSV exported successfully: ${filePath}`));
      return filePath;
    } catch (error) {
      console.error(chalk.red('❌ Error exporting CSV:'), error);
      throw error;
    }
  }

  async exportSummary(data: ScrapingResult, filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `scraping_summary_${timestamp}.txt`;
    const filePath = path.join(this.outputDir, outputFilename);

    try {
      const summary = this.generateSummaryText(data);
      await fs.promises.writeFile(filePath, summary, 'utf8');
      
      console.log(chalk.green(`✅ Summary exported successfully: ${filePath}`));
      return filePath;
    } catch (error) {
      console.error(chalk.red('❌ Error exporting summary:'), error);
      throw error;
    }
  }

  private generateSummaryText(data: ScrapingResult): string {
    const ratingDistribution = this.calculateRatingDistribution(data.reviews);
    const avgRating = this.calculateAverageRating(data.reviews);
    const reviewLengthStats = this.calculateReviewLengthStats(data.reviews);

    return `
TripAdvisor Scraping Summary
============================

Business Information:
- Name: ${data.businessName || 'N/A'}
- Location: ${data.businessLocation || 'N/A'}
- Overall Rating: ${data.overallRating || 'N/A'}

Scraping Details:
- URL: ${data.url}
- Scraped At: ${data.scrapedAt}
- Total Reviews Found: ${data.totalReviews}
- Successfully Scraped: ${data.scrapedReviews}

Review Statistics:
- Average Rating: ${avgRating.toFixed(2)}
- Rating Distribution:
  ${Object.entries(ratingDistribution)
    .map(([rating, count]) => `  ${rating} stars: ${count} reviews (${((count / data.reviews.length) * 100).toFixed(1)}%)`)
    .join('\n  ')}

Review Text Analysis:
- Average Review Length: ${reviewLengthStats.average} characters
- Shortest Review: ${reviewLengthStats.min} characters
- Longest Review: ${reviewLengthStats.max} characters

Top Reviewers (by helpful votes):
${this.getTopReviewers(data.reviews).map((review, i) => 
  `${i + 1}. ${review.reviewerName} - ${review.helpfulVotes || 0} helpful votes`
).join('\n')}

Recent Reviews (last 5):
${data.reviews.slice(0, 5).map((review, i) => 
  `${i + 1}. ${review.reviewerName} (${review.rating}★) - ${review.reviewDate}`
).join('\n')}
`;
  }

  private calculateRatingDistribution(reviews: Review[]): Record<string, number> {
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    
    reviews.forEach(review => {
      const rating = Math.floor(review.rating).toString();
      if (distribution[rating] !== undefined) {
        distribution[rating]++;
      }
    });

    return distribution;
  }

  private calculateAverageRating(reviews: Review[]): number {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviews.length;
  }

  private calculateReviewLengthStats(reviews: Review[]): { average: number; min: number; max: number } {
    if (reviews.length === 0) return { average: 0, min: 0, max: 0 };
    
    const lengths = reviews.map(review => review.reviewText.length);
    const sum = lengths.reduce((acc, length) => acc + length, 0);
    
    return {
      average: Math.round(sum / lengths.length),
      min: Math.min(...lengths),
      max: Math.max(...lengths)
    };
  }

  private getTopReviewers(reviews: Review[]): Review[] {
    return reviews
      .filter(review => review.helpfulVotes && review.helpfulVotes > 0)
      .sort((a, b) => (b.helpfulVotes || 0) - (a.helpfulVotes || 0))
      .slice(0, 5);
  }

  async exportAll(data: ScrapingResult | ScrapingResult[], baseFilename?: string): Promise<{ json: string; csv: string; summary: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = baseFilename || `tripadvisor_${timestamp}`;
    
    console.log(chalk.blue('📁 Exporting data in all formats...'));
    
    if (Array.isArray(data)) {
      // Handle multiple results
      const [jsonPath, csvPath, summaryPath] = await Promise.all([
        this.exportBatchToJson(data, `${base}_batch.json`),
        this.exportBatchToCsv(data, `${base}_batch.csv`),
        this.exportBatchSummary(data, `${base}_batch_summary.txt`)
      ]);

      console.log(chalk.green('✅ All batch exports completed successfully!'));
      
      return {
        json: jsonPath,
        csv: csvPath,
        summary: summaryPath
      };
    } else {
      // Handle single result
      const [jsonPath, csvPath, summaryPath] = await Promise.all([
        this.exportToJson(data, `${base}.json`),
        this.exportToCsv(data, `${base}.csv`),
        this.exportSummary(data, `${base}_summary.txt`)
      ]);

      console.log(chalk.green('✅ All exports completed successfully!'));
      
      return {
        json: jsonPath,
        csv: csvPath,
        summary: summaryPath
      };
    }
  }

  async exportBatchToJson(dataArray: ScrapingResult[], filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `tripadvisor_batch_${timestamp}.json`;
    const filePath = path.join(this.outputDir, outputFilename);

    try {
      const jsonData = JSON.stringify({
        batchInfo: {
          totalUrls: dataArray.length,
          successfulUrls: dataArray.filter(result => !result.error).length,
          failedUrls: dataArray.filter(result => result.error).length,
          totalReviews: dataArray.reduce((sum, result) => sum + result.scrapedReviews, 0),
          scrapedAt: new Date().toISOString()
        },
        results: dataArray
      }, null, 2);
      
      await fs.promises.writeFile(filePath, jsonData, 'utf8');
      
      console.log(chalk.green(`✅ Batch JSON exported successfully: ${filePath}`));
      return filePath;
    } catch (error) {
      console.error(chalk.red('❌ Error exporting batch JSON:'), error);
      throw error;
    }
  }

  async exportBatchToCsv(dataArray: ScrapingResult[], filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `tripadvisor_batch_${timestamp}.csv`;
    const filePath = path.join(this.outputDir, outputFilename);

    try {
      // Combine all reviews from all results
      const allReviews: Array<Review & { sourceUrl: string }> = [];
      
      dataArray.forEach(result => {
        result.reviews.forEach(review => {
          allReviews.push({
            ...review,
            sourceUrl: result.url
          });
        });
      });

      const csvWriter = createCsvWriter.createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'sourceUrl', title: 'Source URL' },
          { id: 'id', title: 'Review ID' },
          { id: 'reviewerName', title: 'Reviewer Name' },
          { id: 'reviewerLocation', title: 'Reviewer Location' },
          { id: 'rating', title: 'Rating' },
          { id: 'reviewTitle', title: 'Review Title' },
          { id: 'reviewText', title: 'Review Text' },
          { id: 'reviewDate', title: 'Review Date' },
          { id: 'helpfulVotes', title: 'Helpful Votes' },
          { id: 'totalVotes', title: 'Total Votes' },
          { id: 'isVerified', title: 'Is Verified' },
          { id: 'tripType', title: 'Trip Type' },
          { id: 'stayDate', title: 'Stay Date' }
        ]
      });

      await csvWriter.writeRecords(allReviews);
      
      console.log(chalk.green(`✅ Batch CSV exported successfully: ${filePath}`));
      return filePath;
    } catch (error) {
      console.error(chalk.red('❌ Error exporting batch CSV:'), error);
      throw error;
    }
  }

  async exportBatchSummary(dataArray: ScrapingResult[], filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `batch_summary_${timestamp}.txt`;
    const filePath = path.join(this.outputDir, outputFilename);

    try {
      const summary = this.generateBatchSummaryText(dataArray);
      await fs.promises.writeFile(filePath, summary, 'utf8');
      
      console.log(chalk.green(`✅ Batch summary exported successfully: ${filePath}`));
      return filePath;
    } catch (error) {
      console.error(chalk.red('❌ Error exporting batch summary:'), error);
      throw error;
    }
  }

  private generateBatchSummaryText(dataArray: ScrapingResult[]): string {
    const totalReviews = dataArray.reduce((sum, result) => sum + result.scrapedReviews, 0);
    const successfulUrls = dataArray.filter(result => !result.error).length;
    const failedUrls = dataArray.filter(result => result.error).length;
    
    // Combine all reviews for overall statistics
    const allReviews = dataArray.flatMap(result => result.reviews);
    const avgRating = allReviews.length > 0 ? this.calculateAverageRating(allReviews) : 0;
    const ratingDistribution = this.calculateRatingDistribution(allReviews);

    return `
TripAdvisor Batch Scraping Summary
==================================

Batch Information:
- Total URLs Processed: ${dataArray.length}
- Successful URLs: ${successfulUrls}
- Failed URLs: ${failedUrls}
- Success Rate: ${((successfulUrls / dataArray.length) * 100).toFixed(1)}%
- Total Reviews Scraped: ${totalReviews}
- Scraped At: ${new Date().toISOString()}

Overall Review Statistics:
- Average Rating Across All Hotels: ${avgRating.toFixed(2)}
- Combined Rating Distribution:
  ${Object.entries(ratingDistribution)
    .map(([rating, count]) => `  ${rating} stars: ${count} reviews (${allReviews.length > 0 ? ((count / allReviews.length) * 100).toFixed(1) : 0}%)`)
    .join('\n  ')}

Individual Hotel Results:
${dataArray.map((result, index) => `
${index + 1}. ${result.businessName || 'Unknown Hotel'}
   URL: ${result.url}
   Status: ${result.error ? 'FAILED' : 'SUCCESS'}
   ${result.error ? `Error: ${result.error}` : `Reviews Scraped: ${result.scrapedReviews}`}
   ${result.businessLocation ? `Location: ${result.businessLocation}` : ''}
   ${result.overallRating ? `Overall Rating: ${result.overallRating}` : ''}
`).join('')}

${failedUrls > 0 ? `
Failed URLs:
${dataArray.filter(result => result.error).map((result, index) => `
${index + 1}. ${result.url}
   Error: ${result.error}
`).join('')}
` : ''}
`;
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }

  async cleanOldFiles(daysOld: number = 7): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.outputDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.promises.unlink(filePath);
          console.log(chalk.yellow(`🗑️  Cleaned old file: ${file}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error cleaning old files:'), error);
    }
  }
}