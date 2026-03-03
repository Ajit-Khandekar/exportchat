# ExportChat

> Export any AI chat to Markdown, PDF, TXT, HTML, or JSON.
> Free. Unlimited. Works on ChatGPT, Claude, Gemini, and Perplexity.

---

## Features

- **4 Platforms** — ChatGPT, Claude, Gemini, Perplexity
- **5 Export Formats** — Markdown, PDF, Plain Text, HTML, JSON
- **100% Free** — No limits, no paywall, no account required
- **Privacy First** — Your chats never leave your browser
- **Open Source** — MIT Licensed

---

## Supported Platforms

| Platform | MD | PDF | TXT | HTML | JSON |
|---|---|---|---|---|---|
| ChatGPT | ✅ | ✅ | ✅ | ✅ | ✅ |
| Claude | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gemini | ✅ | ✅ | ✅ | ✅ | ✅ |
| Perplexity | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer Mode** (top right)
4. Click **Load unpacked**
5. Select the `exportchat` folder
6. Visit any supported AI platform and look for the
   ExportChat button on the right side of the page

---

## How It Works

1. Open any conversation on ChatGPT, Claude, Gemini, or Perplexity
2. Click the **ExportChat** button on the right side of the page
3. Choose your export format
4. File downloads instantly to your device

No sign-in. No server. No data collection.

---

## Why ExportChat?

Most AI chat exporters are either platform-specific,
paywalled, or require sending your data to a server.

ExportChat is:
- **Multi-platform** — one extension for all major AI tools
- **Unlimited** — export as many chats as you want
- **Client-side** — all processing happens in your browser
- **Open source** — inspect the code yourself

---

## Tech Stack

- Chrome Extension Manifest V3
- jsPDF (client-side PDF generation)
- Turndown.js (HTML to Markdown conversion)
- Vanilla JavaScript — no frameworks

---

## Known Limitations

- PDF export strips emojis and decorative Unicode fonts
  (jsPDF limitation — standard Latin characters work fine)
- Gemini does not expose conversation title in DOM —
  filename is generated from first message text
- Platform UI changes may require selector updates —
  open an issue if exports break after a platform update

---

## Roadmap
- [ ] Chrome Web Store listing
- [ ] Firefox support
- [ ] Copy to clipboard
- [ ] Timestamp toggle

---

## Contributing

Found a broken selector after a platform update?
Open an issue or submit a PR — contributions welcome.

---

## License

MIT License — see [LICENSE](LICENSE) file.

---

## Author

Built by [Ajit Khandekar](https://github.com/Ajit-Khandekar)
A [Solvize](https://solvize.co) project — Solutions. Optimized.


*Built using Cursor AI and Claude.*
