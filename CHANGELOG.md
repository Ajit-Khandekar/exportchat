# Changelog

All notable changes to ExportChat are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.3] - 2026-03-05

### Fixed
- Duplicate language label appearing before code fences in all export formats — now reads from `<code>` element only and removes sibling label elements
- Code indentation lost in PDF exports — code block lines now skip sanitization and render in Courier font with whitespace preserved
- Applied code block and paragraph break extraction fixes to all 4 platform content scripts

---

## [1.0.2] - 2026-03-05

### Fixed
- Removed unused `background.js` service worker (was not registered in manifest)
- Code blocks and paragraph breaks now preserved during message extraction across all platforms
- Gemini title no longer prefixed with "You said" — strips from both `document.title` and first-message fallback
- Claude title detection now uses `document.title` and skips generic labels ("Claude", "New chat") before falling back to first user message

### Changed
- Extension name updated to "ExportChat – Export AI Chats" with `short_name` added
- Extension description updated to "Export AI chat conversations to Markdown, PDF, HTML, TXT or JSON."
- Attribution footer updated across all 5 export formats to "Saved via ExportChat · exportchat.pages.dev"
- Removed Solvize references from all JS file headers and README
- Author link updated to LinkedIn profile

### Added
- `icon32.png` added to icons
- `web_accessible_resources` added to manifest so `icon48.png` loads correctly in content scripts

---

## [1.0.1] - 2026-03-05

### Fixed
- Floating button icon now loads correctly via `chrome.runtime.getURL`
- Button background set to transparent (icon has built-in blue circle)
- Icon sized to 40px to fill button area; `border-radius: 50%` clips square PNG canvas
- `img.alt` set to empty string to prevent broken-image alt text ("Expo...") showing in button

### Changed
- Replaced vertical tab button design with 48×48px floating circle button
- Button positioned at `right: 2px`, `top: 25vh`
- Buzz/shake animation on hover via `@keyframes exportchat-buzz`
- Dropdown menu opens to the left of the button

---

## [1.0.0] - 2026-03-05

### Added
- Initial release — Claude.ai, ChatGPT, Gemini, Perplexity export support
- Export formats: Markdown, PDF, Plain Text, HTML, JSON
- Floating ExportChat button injected into all supported platforms
- Attribution footer added to all export formats
