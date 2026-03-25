import { extractSocialFeeds } from './lib/agent/tools/socialExtractor.js';
import { analyzeSentiment } from './lib/agent/sentiment.js';
import { fetchDailyNews } from './lib/agent/tools/newsFetcher.js';
import dotenv from 'dotenv';
dotenv.config();

async function testMonth2() {
  console.log("==================================================");
  console.log("🕵️‍♂️ TESTING A2UI & DATA GATHERING (MONTH 2)");
  console.log("==================================================\n");

  console.log("--- 1. MCP NEWS SCRAPER (Tavily) ---");
  const news = await fetchDailyNews("technology and positive AI news");
  console.log(`Fetched ${news.length} articles.`);
  if (news.length > 0) {
    console.log(`Headline 1: ${news[0].title}`);
  } else {
    console.log("⚠️ No news fetched. Check TAVILY_API_KEY.");
  }
  
  console.log("\n--- 2. A2UI BROWSER EXTRACTOR ---");
  console.log("Launching headless Playwright to scrape social data...");
  // Use a safe, public fallback URL for testing instead of real LinkedIn to avoid login blocking in quick test
  const testUrl = "https://example.com"; 
  const feeds = await extractSocialFeeds('linkedin', testUrl);
  
  console.log(`Extracted ${feeds.length} dummy social posts!`);
  
  console.log("\n--- 3. NLP SENTIMENT & BURNOUT PIPELINE ---");
  for (const post of feeds) {
    console.log(`\nAnalyzing Post: "${post.content}"`);
    const sentiment = await analyzeSentiment(post.content);
    if (sentiment.needsHelp) {
      console.log(`🚨 ALERT: User needs Empathy Intervention! (Score: ${sentiment.score})`);
      console.log(`   Triggers Found: ${sentiment.triggers.join(', ')}`);
    } else {
      console.log(`✅ Post is stable. Positivity Score: ${sentiment.score}`);
    }
  }

  console.log("\n==================================================");
  console.log("✅ MONTH 2 DATA GATHERING TEST COMPLETE");
  console.log("==================================================");
}

testMonth2().catch(console.error);
