import { existsSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { Anthropic } from '@anthropic-ai/sdk';

// -----------------------------------------------------------------------------------
// Configuration (adjust as needed)
const REPORT_PATH = process.argv[2];
const SCORE_THRESHOLD = 0.6;
const MAX_RECENT_RUNS = 5; // how many recent runs to consider
// -----------------------------------------------------------------------------------

// 1️⃣ Load Playwright JSON report
if (!REPORT_PATH || !existsSync(REPORT_PATH)) {
  console.error('Usage: ts-node flaky-detector.ts <path-to-playwright-report.json>');
  process.exit(1);
}
const report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));

// 2️⃣ Extract failures (status === 'failed')
interface Failure {
  testId: string;
  title: string;
  file: string;
  line: number;
  error: string;
  commit: string;
  timestamp: number;
}
const failures: Failure[] = [];
report.tests
  .filter((t: any) => t.status === 'failed')
  .forEach((t: any) => {
    failures.push({
      testId: t.id,
      title: t.title,
      file: t.location.file,
      line: t.location.line,
      error: t.error.message,
      commit: '', // will fill later
      timestamp: Date.now(),
    });
  });

// 3️⃣ Populate commit SHA for each failure
const commitSha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout.trim();
failures.forEach(f => (f.commit = commitSha));

// 4️⃣ Load existing flaky history from a JSON file (history persists across runs)
const HISTORY_JSON = 'flaky-history.json';
let history: { testId: string; commit: string; timestamp: number; error: string }[] = [];
if (existsSync(HISTORY_JSON)) {
  try {
    const raw = readFileSync(HISTORY_JSON, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) history = parsed;
  } catch (e) {
    console.warn('Failed to parse flaky history JSON, starting fresh');
  }
}

// 5️⃣ Append new failure records to history
failures.forEach(f => history.push(f));

// 6️⃣ Truncate to recent runs (keep only last N entries per testId)
const grouped: Record<string, any[]> = {};
history.forEach(h => {
  const arr = grouped[h.testId] ?? [];
  arr.push(h);
  grouped[h.testId] = arr;
});
const recentEntries: any[] = [];
Object.entries(grouped).forEach(([testId, entries]) => {
  // sort by timestamp desc
  entries.sort((a, b) => b.timestamp - a.timestamp);
  // keep only MAX_RECENT_RUNS latest
  recentEntries.push(...entries.slice(0, MAX_RECENT_RUNS));
});
recentEntries.sort((a, b) => b.timestamp - a.timestamp);

// 7️⃣ Compute flakiness score per testId
interface ScoreResult {
  testId: string;
  title: string;
  score: number;
  pattern: string;
  suggestion?: string;
}
const scoreResults: ScoreResult[] = [];

// Helper: simple pattern detection
function detectPattern(errorMsg: string): string {
  const lowered = errorMsg.toLowerCase();
  if (/timeout|waiting for selector/.test(lowered)) return 'timeout';
  if (/element not attached/.test(lowered)) return 'detached';
  if (/unexpected status/.test(lowered)) return 'status';
  return 'other';
}

// Simple scoring function (same heuristic discussed earlier)
function computeScore(entries: any[]): number {
  if (entries.length === 0) return 0;
  const total = entries.length;
  const failures = entries.filter(e => e.error !== undefined && e.error !== null && e.error !== '');
  const recentSlice = entries.slice(0, MAX_RECENT_RUNS);
  const recentFailures = recentSlice.filter(e => e.error !== undefined && e.error !== null && e.error !== '');
  const recentRate = recentFailures.length / Math.max(recentSlice.length, 1);
  const baseRate = failures.length / total;
  // Fixed weights (tuned for now)
  const score = 0.5 * baseRate + 0.4 * recentRate;
  return score;
}

// Detect pattern for each entry and compute score
recentEntries.forEach(entry => {
  const score = computeScore(recentEntries);
  if (score >= SCORE_THRESHOLD) {
    const pattern = detectPattern(entry.error);
    scoreResults.push({
      testId: entry.testId,
      title: entry.title,
      score,
      pattern,
    });
  }
});

// 8️⃣ Optional: Ask LLM for concrete suggestion (requires ANTHROPIC_API_KEY)
async function getLLFSuggestion(entry: any): Promise<string | undefined> {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `You are a QA engineer. Given the following Playwright failure, suggest a concise code change (max 2 lines) that likely removes the flakiness.\n\nTest: ${entry.title}\nFile: ${entry.file}:${entry.line}\nError: ${entry.error}\nRecent runs: ${recentEntries.slice(0, 5).map(e => `${e.timestamp}`).join(', ')}`;
  const resp = await client.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });
  const content = resp.content?.[0];
  return 'text' in content ? (content.text as string).trim() : undefined;
}

// 9️⃣ Generate suggestions (fallback to heuristic)
scoreResults.forEach(async (sr) => {
  const entry = recentEntries.find(e => e.testId === sr.testId);
  const suggestion = await getLLFSuggestion(entry);
  if (suggestion) sr.suggestion = suggestion;
});

// 10️⃣ Output results
if (scoreResults.length === 0) {
  console.log('✅ No flaky tests detected (all scores below threshold).');
  process.exit(0);
}

// Print summary
console.log('⚡ Flaky‑test detection report (score ≥ 0.6)');
scoreResults.forEach(sr => {
  const emoji = sr.suggestion ? '💡' : '⚠️';
  console.log(`${emoji} ${sr.title} – score ${(sr.score * 100).toFixed(0)}`);
  if (sr.suggestion) console.log(`   Suggestion: ${sr.suggestion}`);
});

// 11️⃣ Persist updated history back to the JSON file
writeFileSync(HISTORY_JSON, JSON.stringify(recentEntries, null, 2));

// Exit with non‑zero if any flaky tests were found (so CI can fail or flag)
process.exit(1);