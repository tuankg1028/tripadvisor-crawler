# TripAdvisor Review Scraper

A robust TripAdvisor review scraper built with Playwright and AdsPower anti-detection technology.

## Features

- **Anti-Detection**: Uses AdsPower browser profiles for stealth scraping
- **Human-like Behavior**: Implements random delays, natural scrolling, and mouse movements
- **Complete Review Data**: Extracts reviewer info, ratings, text, dates, and helpful votes
- **Multiple Export Formats**: JSON, CSV, and summary reports
- **Error Handling**: Robust error handling and retry mechanisms
- **Configuration**: Flexible configuration via environment variables

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

### Basic Usage

```bash
npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..."
```

### With Maximum Reviews Limit

```bash
npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..." 100
```

### With Custom Profile Name

```bash
npm run scrape "https://www.tripadvisor.com/Hotel_Review-g..." 100 "MyCustomProfile"
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

The scraper generates three types of output files in the `./output` directory:

1. **JSON File**: Complete structured data with all review information
2. **CSV File**: Tabular format suitable for spreadsheet applications
3. **Summary File**: Human-readable summary with statistics and analysis

### Sample Output Structure

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
      "id": "review_0",
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

## Anti-Detection Features

- **AdsPower Integration**: Uses real browser profiles with unique fingerprints
- **Human-like Timing**: Random delays between actions
- **Natural Scrolling**: Simulates human scrolling patterns
- **Mouse Movements**: Random mouse movements across the page
- **Reading Simulation**: Pauses to simulate reading time
- **Captcha Detection**: Identifies and handles captcha challenges
- **Rate Limit Handling**: Detects and waits for rate limiting

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

2. **No Reviews Found**
   - Verify the TripAdvisor URL is correct
   - Check if the page structure has changed
   - Ensure the page has reviews

3. **Browser Launch Failed**
   - Check AdsPower profile status
   - Ensure sufficient system resources
   - Try creating a new profile

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