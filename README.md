# TripAdvisor Review Scraper

A robust TripAdvisor review scraper built with Playwright and AdsPower anti-detection technology. Supports both Hotel and Attraction pages with intelligent pagination and caching.

## Features

- **🔄 Multi-URL Batch Processing**: Process multiple TripAdvisor URLs in one run
- **🏨 Hotel & Attraction Support**: Works with both Hotel_Review and Attraction_Review pages
- **📄 Intelligent Pagination**: Automatically collects reviews across all pages
- **💾 Smart Caching**: Avoids re-scraping already collected reviews
- **⚡ Parallel Processing**: Processes review cards concurrently for speed
- **🛡️ Anti-Detection**: Uses AdsPower browser profiles for stealth scraping
- **🤖 Human-like Behavior**: Implements random delays, natural scrolling, and mouse movements
- **📊 Complete Review Data**: Extracts reviewer info, ratings, text, dates, and helpful votes
- **📁 Multiple Export Formats**: JSON, CSV, and summary reports (single & batch)
- **🔧 Error Handling**: Robust error handling and retry mechanisms
- **⚙️ Configuration**: Flexible configuration via environment variables

## Supported TripAdvisor Pages

- ✅ **Hotel Reviews**: `Hotel_Review-g{location_id}-d{hotel_id}-Reviews-{hotel_name}.html`
- ✅ **Attraction Reviews**: `Attraction_Review-g{location_id}-d{attraction_id}-Reviews-{attraction_name}.html`
- ✅ **Multi-Page Pagination**: Automatically processes all review pages
- ✅ **International Domains**: Works with .com, .co.nz, .co.uk, etc.

## Prerequisites

1. **AdsPower**: Install and configure AdsPower on your system
2. **Node.js**: Version 16 or higher
3. **TypeScript**: For development

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Configure your `.env` file:
   ```env
   ADSPOWER_BASE_URL=http://local.adspower.net:50325
   ADSPOWER_GROUP_ID=your_group_id_here
   HIDE_CHROME=0
   MAX_REVIEWS_PER_PAGE=50
   DELAY_MIN=1000
   DELAY_MAX=3000
   OUTPUT_FORMAT=json
   ```

## Usage

### Single URL Scraping

```bash
# Basic hotel scraping
npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..."

# Attraction scraping
npm run scrape "https://www.tripadvisor.co.nz/Attraction_Review-g..."

# With maximum reviews limit
npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..." 100

# With custom profile name
npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..." 100 "MyCustomProfile"
```

### Multi-URL Batch Processing

```bash
# Multiple URLs (comma-separated)
npm run scrape "url1,url2,url3" 50 "MyProfile"

# URLs from file
npm run scrape "file:urls.txt" 100 "MyProfile"

# Mixed Hotel and Attraction URLs
npm run scrape "https://tripadvisor.com/Hotel_Review-g123,https://tripadvisor.com/Attraction_Review-g456" 75
```

### URL File Format (urls.txt)

```
https://www.tripadvisor.com/Hotel_Review-g123456...
https://www.tripadvisor.co.nz/Attraction_Review-g789...
# Comments start with # and are ignored

https://www.tripadvisor.com/Hotel_Review-g987...
```

### Cache Management

```bash
# View cache statistics for a URL
npm run scrape cache stats "https://www.tripadvisor.com/Hotel_Review-g..."

# Clear cache for a specific URL
npm run scrape cache clear "https://www.tripadvisor.com/Hotel_Review-g..."
```

### Development Mode

```bash
npm run dev
```

### Build Project

```bash
npm run build
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADSPOWER_BASE_URL` | AdsPower API base URL | `http://local.adspower.net:50325` |
| `ADSPOWER_GROUP_ID` | AdsPower group ID | `3760701` |
| `HIDE_CHROME` | Hide browser window (0=show, 1=hide) | `0` |
| `MAX_REVIEWS_PER_PAGE` | Maximum reviews per scraping session | `50` |
| `DELAY_MIN` | Minimum delay between actions (ms) | `1000` |
| `DELAY_MAX` | Maximum delay between actions (ms) | `3000` |
| `OUTPUT_FORMAT` | Default output format | `json` |
| `OUTPUT_DIR` | Output directory for exported files | `./output` |

## Output

The scraper generates different output formats depending on whether you're scraping single or multiple URLs:

### Single URL Output
1. **JSON File**: Complete structured data with all review information
2. **CSV File**: Tabular format suitable for spreadsheet applications  
3. **Summary File**: Human-readable summary with statistics and analysis

### Batch URL Output
1. **Batch JSON**: Combined results from all URLs with batch metadata
2. **Batch CSV**: All reviews from all URLs with source URL column
3. **Batch Summary**: Comprehensive statistics across all hotels/attractions

### Cache System
- **Individual Cache Files**: Stored in `./cache/` directory per hotel/attraction
- **Automatic Deduplication**: Prevents re-scraping already collected reviews
- **Persistent Storage**: Survives between scraping sessions

### Sample Single URL Output

```json
{
  "url": "https://www.tripadvisor.com/Hotel_Review-g...",
  "totalReviews": 150,
  "scrapedReviews": 150,
  "businessName": "Example Hotel",
  "businessLocation": "New York, NY",
  "overallRating": "4.2",
  "scrapedAt": "2024-01-01T12:00:00.000Z",
  "reviews": [
    {
      "id": "review_12345",
      "reviewerName": "John Doe",
      "reviewerLocation": "California",
      "rating": 5,
      "reviewTitle": "Amazing stay!",
      "reviewText": "Had a wonderful time...",
      "reviewDate": "January 2024",
      "helpfulVotes": 12,
      "isVerified": true,
      "tripType": "Business",
      "stayDate": "December 2023"
    }
  ]
}
```

### Sample Batch Output

```json
{
  "batchInfo": {
    "totalUrls": 3,
    "successfulUrls": 3,
    "failedUrls": 0,
    "totalReviews": 450,
    "scrapedAt": "2024-01-01T12:00:00.000Z"
  },
  "results": [
    {
      "url": "https://www.tripadvisor.com/Hotel_Review-g...",
      "totalReviews": 150,
      "scrapedReviews": 150,
      "businessName": "Hotel Example",
      "reviews": [...]
    },
    {
      "url": "https://www.tripadvisor.com/Attraction_Review-g...",
      "totalReviews": 300,
      "scrapedReviews": 300,
      "businessName": "Attraction Example",
      "reviews": [...]
    }
  ]
}
```

## Advanced Features

### Anti-Detection
- **AdsPower Integration**: Uses real browser profiles with unique fingerprints
- **Human-like Timing**: Random delays between actions (1-6 seconds)
- **Natural Scrolling**: Simulates human scrolling patterns
- **Mouse Movements**: Random mouse movements across the page
- **Reading Simulation**: Pauses to simulate reading time
- **Captcha Detection**: Identifies and handles captcha challenges
- **Rate Limit Handling**: Detects and waits for rate limiting

### Performance Optimizations
- **Parallel Processing**: Processes up to 10 review cards simultaneously
- **Smart Pagination**: Automatically navigates through all review pages
- **Content Loading**: Triggers dynamic content loading before extraction
- **Popup Handling**: Automatically closes cookie popups and modals
- **Network Optimization**: Waits for network idle state for complete page loads

### Data Quality
- **Multi-Selector Strategy**: Uses multiple fallback selectors for reliable extraction
- **UI Element Filtering**: Intelligent filtering to avoid extracting UI elements as data
- **Content Validation**: Validates extracted data before saving
- **Duplicate Prevention**: Prevents duplicate reviews across pagination
- **Error Recovery**: Continues processing even if individual reviews fail

## Error Handling

The scraper includes comprehensive error handling for:

- Network timeouts and connection issues
- Element not found scenarios
- Rate limiting and blocking
- Captcha challenges
- Browser crashes or disconnections

## Troubleshooting

### Common Issues

1. **AdsPower Connection Failed**
   - Ensure AdsPower is running
   - Check the API URL and port
   - Verify group ID exists
   - Try different browser profile

2. **No Reviews Found**
   - Verify the TripAdvisor URL is correct (Hotel_Review or Attraction_Review)
   - Check if the page structure has changed
   - Ensure the page has reviews (not just photos/Q&A)
   - Try clearing cache: `npm run scrape cache clear <url>`

3. **Browser Launch Failed**
   - Check AdsPower profile status
   - Ensure sufficient system resources
   - Try creating a new profile
   - Restart AdsPower application

4. **Extraction Errors**
   - Page structure may have changed - check debug output
   - Some elements might be loading slowly - increase delays
   - Captcha or rate limiting detected - wait and retry

5. **Cache Issues**
   - Cache files stored in `./cache/` directory
   - Use cache commands to inspect and manage
   - Clear specific URL cache if data seems outdated

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=1 npm run scrape "url"
```

## Legal Considerations

This tool is intended for:
- Educational purposes
- Research and analysis
- Personal use with publicly available data

**Important**: 
- Respect TripAdvisor's robots.txt and terms of service
- Implement appropriate delays between requests
- Use responsibly and ethically
- Consider reaching out to TripAdvisor for official API access for commercial use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review error logs in the console
3. Ensure all prerequisites are met
4. Create an issue with detailed information