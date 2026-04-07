# LinkedIn Shield

Block LinkedIn's hidden extension scanning, device fingerprinting, and tracker probes.

**Open-source. No tracking. No account required.**

## What LinkedIn Does

Every time you visit linkedin.com, hidden JavaScript:

- Probes **6,236 browser extensions** by ID to detect what you have installed
- Collects **48+ device data points** (CPU cores, memory, screen, battery, timezone)
- Injects a **zero-pixel invisible iframe** from HUMAN Security (li.protechts.net)
- Sends it all encrypted to LinkedIn servers — no consent, no opt-out

Source: [BrowserGate investigation](https://www.bleepingcomputer.com/news/security/linkedin-secretly-scans-for-6-000-plus-chrome-extensions-collects-data/) (April 2026)

## What LinkedIn Shield Does

### Standalone Mode (no LLM needed)

- Blocks extension probing (intercepts `chrome-extension://` URL checks)
- Blocks tracker endpoints (`/li/track`, `/sensorCollect`, `protechts.net`)
- Randomizes device fingerprint data (CPU cores, memory, battery)
- Removes hidden tracking iframes
- Shows real-time badge count of blocked probes

### AI Analysis Mode (optional)

- Click "Analyze with AI" to get a plain-English explanation of what was blocked
- Supports Claude (Anthropic), OpenAI, QMax, or any OpenAI-compatible provider
- BYOLLM — bring your own API key, stored locally in browser storage

## Install

### From Source (Developer)

1. Clone this repo
2. Open `chrome://extensions/` → Enable Developer Mode
3. Click "Load unpacked" → Select the `linkedin-shield` folder
4. Visit linkedin.com and check the shield badge

### Chrome Web Store

Coming soon.

## How It Works

**Layer 1: Declarative Net Request Rules** (`rules.json`)

- Blocks tracking endpoints at the network level before JavaScript runs
- Blocks `protechts.net` iframe, `sensorCollect`, `/li/track`, `spectroscopy`

**Layer 2: Content Script** (`content.js`)

- Intercepts `fetch()` and `XMLHttpRequest` to block `chrome-extension://` probes
- Overrides `performance.getEntriesByName()` to prevent timing-based detection
- Randomizes `navigator.hardwareConcurrency` and `navigator.deviceMemory`
- Blocks `navigator.getBattery()` API
- MutationObserver removes hidden iframes as they're injected

**Layer 3: AI Analysis** (optional)

- Background service worker sends blocked stats to your chosen LLM
- Returns a plain-English privacy risk assessment
- No data leaves your machine unless you click "Analyze"

## Privacy

- Zero telemetry. Zero analytics. Zero tracking.
- AI analysis is opt-in and uses YOUR API key — we never see your data.
- All blocking happens locally in your browser.
- Open-source — audit every line.

## Supported Browsers

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Brave (already blocks some endpoints — this adds extension probe protection)
- Firefox: Manifest V2 port planned

## Contributing

PRs welcome. Key areas:

- Add more LinkedIn tracking endpoints as they're discovered
- Firefox Manifest V2 port
- Better fingerprint randomization
- UI improvements

## License

MIT

---

Built by [QualityMax](https://qualitymax.io) — AI-native test automation for engineering teams.
