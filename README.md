# @synoppy/mcp

[![npm](https://img.shields.io/npm/v/@synoppy/mcp.svg)](https://www.npmjs.com/package/@synoppy/mcp) [![license](https://img.shields.io/npm/l/@synoppy/mcp.svg)](./LICENSE)

**Give your AI agent the whole web.** An [MCP](https://modelcontextprotocol.io) server for [Synoppy](https://synoppy.com) — drop it into Claude Desktop, Cursor, or any MCP client and your agent gets tools to **read, crawl, map, extract, classify, enrich**, screenshot, and pull images from the live web.

[**Get a free key →**](https://synoppy.com/dashboard) · [Docs](https://synoppy.com/docs/mcp) · [synoppy.com](https://synoppy.com)

Every tool returns the full JSON response, including the metered billing fields `creditsUsed` and `creditsRemaining`.

## Tools

| Tool | Endpoint | Inputs |
| --- | --- | --- |
| `synoppy_read` | `POST /api/scrape` | `url`, `formats?` (`markdown`\|`html`\|`text`), `onlyMainContent?`, `timeoutMs?`, `render?` (`boolean`\|`"auto"`), `waitMs?` |
| `synoppy_screenshot` | `POST /api/screenshot` | `url`, `fullPage?`, `waitMs?`, `timeoutMs?` |
| `synoppy_crawl` | `POST /api/crawl` | `url`, `limit?` (1-25, default 10) |
| `synoppy_map` | `GET/POST /api/map` | `url` |
| `synoppy_extract` | `POST /api/extract` | `url`, `prompt?` (alias `instruction?`) |
| `synoppy_classify` | `POST /api/classify` | `url`, `labels?` (omit for NAICS/SIC) |
| `synoppy_enrich` | `GET/POST /api/brand` | one of `url`, `domain`, or `email` |
| `synoppy_images` | `POST /api/images` | `url` |

- `synoppy_read` — URL → clean markdown / HTML / text plus page metadata (title, description, language, statusCode, wordCount, rendered, bytesIn…). Pass `render: "auto"` to render JS-heavy pages on demand.
- `synoppy_screenshot` — full-page or viewport PNG as a data URL. Requires rendering credits; may return `RENDER_UNAVAILABLE`.
- `synoppy_crawl` — crawl a site, read each page (`pages[]`, `discovered`, `count`).
- `synoppy_map` — every URL on a domain (`source: "sitemap" | "links"`).
- `synoppy_extract` — AI structured-JSON extraction. Returns `data`, `usage` tokens, `truncated`, and `model`.
- `synoppy_classify` — industry (NAICS/SIC) by default, or custom `labels` mode (`{ label, matched, confidence, reasoning }`).
- `synoppy_enrich` — brand profile (name, logo, colors, fonts, socials, address) from a URL, bare domain, or work email.
- `synoppy_images` — every image with `src`, `alt`, `width`, `height`.

> Not live yet (coming soon): `/api/act`. This is intentionally not exposed as a tool.

## Setup

### Claude Desktop — `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "synoppy": {
      "command": "npx",
      "args": ["-y", "@synoppy/mcp"],
      "env": { "SYNOPPY_API_KEY": "syn_xxxxxxxxxxxx" }
    }
  }
}
```

### Cursor — `~/.cursor/mcp.json` (same shape)

Create a key in the [dashboard](https://synoppy.com/dashboard). The server reads
`SYNOPPY_API_KEY` (auth header `Authorization: Bearer syn_...`) from its
environment; set `SYNOPPY_BASE_URL` to point at a self-hosted instance.

## Credits

Synoppy is metered. Every successful response carries `creditsUsed` (number) and
`creditsRemaining` (number or `null`), and the tools surface them verbatim. For
example, `synoppy_read` returns:

```json
{
  "success": true,
  "metadata": { "title": "Example", "statusCode": 200, "wordCount": 412, "rendered": false, "bytesIn": 18233 },
  "markdown": "# Example...",
  "latencyMs": 284,
  "creditsUsed": 1,
  "creditsRemaining": 4999
}
```

Watch `creditsRemaining` to track your balance as you go.

## Local dev

```bash
npm install
npm run build
SYNOPPY_API_KEY=syn_... npm start
```

The published package ships a single bundled, minified `dist/index.js` (with the
`#!/usr/bin/env node` shebang preserved) plus generated `dist/index.d.ts` types —
no readable source.

MIT licensed.
