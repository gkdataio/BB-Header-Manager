# BB Header Manager

![BB Header Manager V2](screenshot2.png)

A simple, open-source Chrome extension for bug bounty hunters to inject custom headers into HTTP requests.

## Why?

Most bug bounty programs ask researchers to identify their traffic with a header like `X-Bug-Bounty: username`. This helps security teams distinguish legitimate testing from malicious activity.

Existing extensions have had issues with tracking, affiliate injection, and sketchy ownership changes. This extension does one thing well with zero BS.

## Features

**Core**
- Add/remove custom HTTP headers
- One-click global toggle
- Per-header enable/disable
- Quick presets (X-Bug-Bounty, X-HackerOne, X-Bugcrowd, X-Security-Research)
- Headers persist across browser restarts

**Profiles**
- Multiple profiles for different programs
- Switch between targets instantly
- Import/export configs as JSON

**Domain Filtering**
- Wildcard target domains (*.example.com)
- Exclude list (never inject on google.com, banks, etc.)
- No targets = inject on all domains

**Request Filtering**
- Filter by HTTP method (GET, POST, PUT, DELETE, etc.)
- Empty = all methods

**Safety & Monitoring**
- Auto-disable timer (30min, 1hr, 2hr, 4hr, 8hr)
- Request counter badge
- Click counter to reset

**Privacy**
- No tracking, no analytics, no external requests
- Fully open source

## Installation

### Chrome Web Store (Recommended)

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/llpjjjjocdmaeknobpfdjojdamaplfii)

### Manual Install

1. Download the latest release or clone this repo
2. Go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder

## Usage

1. Click the extension icon in your toolbar
2. Create a profile for your target program
3. Add target domains (e.g., `*.example.com`)
4. Add your headers
5. Toggle ON

Headers only inject on matching targets. Badge shows request count.

## Verify It's Working

1. Open DevTools (F12) on any website
2. Go to the Network tab
3. Reload the page
4. Click any request and check Request Headers
5. Your custom headers should be listed

Or use [webhook.site](https://webhook.site) to inspect the exact headers being sent.

## Permissions

| Permission | Why |
|------------|-----|
| `declarativeNetRequest` | Modify HTTP request headers |
| `declarativeNetRequestFeedback` | Count modified requests for badge |
| `storage` | Save configs locally |
| `alarms` | Auto-disable timer |
| `<all_urls>` | Inject headers on any target you're testing |

## Privacy

- Zero data collection
- Zero analytics
- Zero external network requests
- All data stored locally in your browser
- No remote code execution

## Changelog

### v2.0.0
- Added profiles for switching between programs
- Added wildcard domain targeting
- Added exclude list
- Added request method filter
- Added auto-disable timer
- Added request counter badge
- Added per-header toggle
- Added import/export configs

### v1.0.0
- Initial release

## License

MIT

## Author

GKData + Claude

Built by a bug bounty hunter, for bug bounty hunters.
