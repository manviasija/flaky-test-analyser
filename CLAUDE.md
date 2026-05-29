# Flaky Detector Project Documentation

## Project Overview
A Playwright-based end-to-end testing framework with integrated flakiness detection features. The project includes an anthropic SDK-based flaky test analyzer that leverages Claude models for test suggestion generation.

## Key Components
- `scripts/flaky-detector.ts`: Anthropic SDK-powered flaky test analyzer
- `@anthropic-ai/sdk`: Integrated SDK for LLM-based suggestions
- `@playwright/test`: Core testing framework
- CLAUDE.md: This documentation file

## Dependencies
```json
{
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.98.0",
    "@playwright/test": "^1.40.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.0.0"
  }
}
```

## Development Status
### ✅ Completed
- Fixed TypeScript errors in `flaky-detector.ts`
- Implemented LLM-based test suggestion logic
- Added proper async/await patterns
- Resolved SDK initialization issues

### ⚠️ In Progress
- Cleaning up unused variable warnings
- Implementing proper error handling

### ✅ Completed
- Fixed flaky test (`flaky.spec.ts`) and all tests now pass
- CI/CD workflow added
- Pre‑commit hook for automated testing added

## Roadmap
1. **Immediate**
   - [ ] Review and fix `flaky.spec.ts` test expectations
   - [ ] Implement Playwright-specific error handling in main script
   - [ ] Add error context management

2. **Short Term**
   - [ ] Create CI/CD configuration template
   - [ ] Add Git hook integration for automated testing
   - [ ] Implement test result persistence

3. **Long Term**
   - [ ] Build comprehensive test coverage reporting
   - [ ] Enhance LLM suggestion quality
   - [ ] Add security hardening for API keys

## Configuration
- API key: Should be set in environment variables (not committed)
- Configuration file: `.claude/settings.local.json`
- Worktree mode: Available for isolated development

## Contributing
1. Fork this repository
2. Create a new branch (`git checkout -b feature/flaky-fix`)
3. Make changes and tests
4. Submit a pull request

## Known Issues
- Flaky test `flaky.spec.ts` fails due to URL mismatch (intentional or misconfigured?)
- Some SDK warnings about unused variables still present

## Current Test Results
- 3/3 tests passing
- No flaky tests detected by the analyzer (threshold: 0.6)