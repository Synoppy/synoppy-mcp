#!/usr/bin/env node
/**
 * Synoppy MCP server — exposes the Synoppy web-data API as MCP tools so any
 * MCP client (Claude Desktop, Cursor, etc.) can read, screenshot, crawl, map,
 * extract, classify, enrich, and pull images from the live web.
 *
 * Every tool returns the full JSON response, including the metered billing
 * fields creditsUsed and creditsRemaining.
 *
 * Reads SYNOPPY_API_KEY (and optional SYNOPPY_BASE_URL) from the environment.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.SYNOPPY_API_KEY;
const BASE_URL = (process.env.SYNOPPY_BASE_URL || "https://synoppy.com").replace(/\/+$/, "");

async function call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!API_KEY) throw new Error("SYNOPPY_API_KEY is not set in the environment.");
  // Drop undefined keys so optional params are not serialized.
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (v !== undefined) payload[k] = v;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.success === false) {
    const code = json.code ? ` (${json.code})` : "";
    throw new Error(((json.error as string) || `Synoppy request failed with HTTP ${res.status}`) + code);
  }
  return json;
}

function asText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({ name: "synoppy", version: "1.1.0" });

server.tool(
  "synoppy_read",
  "Fetch a URL and return clean, LLM-ready markdown (or HTML/text) plus page metadata. Returns creditsUsed/creditsRemaining.",
  {
    url: z.string().describe("The URL to read"),
    formats: z
      .array(z.enum(["markdown", "html", "text"]))
      .optional()
      .describe("Which content formats to return (default markdown)"),
    onlyMainContent: z.boolean().optional().describe("Strip nav/footer/boilerplate and keep the main content"),
    timeoutMs: z.number().int().optional().describe("Fetch timeout in milliseconds"),
    render: z
      .union([z.boolean(), z.literal("auto")])
      .optional()
      .describe('Render JS with a headless browser. true/false, or "auto" to render only when needed'),
    waitMs: z.number().int().optional().describe("Extra time to wait after load before capturing (render only)"),
  },
  async (args) => asText(await call("/api/scrape", args)),
);

server.tool(
  "synoppy_screenshot",
  "Capture a PNG screenshot of a page (data URL). Requires rendering credits; may return RENDER_UNAVAILABLE. Returns creditsUsed/creditsRemaining.",
  {
    url: z.string().describe("The URL to screenshot"),
    fullPage: z.boolean().optional().describe("Capture the entire scrollable page (default false)"),
    waitMs: z.number().int().optional().describe("Extra time to wait after load before capturing"),
    timeoutMs: z.number().int().optional().describe("Navigation timeout in milliseconds"),
  },
  async (args) => asText(await call("/api/screenshot", args)),
);

server.tool(
  "synoppy_crawl",
  "Crawl a site and read each page it finds. Requires API credits. Returns creditsUsed/creditsRemaining.",
  {
    url: z.string(),
    limit: z.number().int().min(1).max(25).optional().describe("Max pages (1-25, default 10)"),
  },
  async (args) => asText(await call("/api/crawl", args)),
);

server.tool(
  "synoppy_map",
  "Discover every URL on a domain (sitemap or link extraction). Returns creditsUsed/creditsRemaining.",
  { url: z.string() },
  async (args) => asText(await call("/api/map", args)),
);

server.tool(
  "synoppy_extract",
  "Extract structured JSON from a page using AI. Requires API credits. Returns data, usage tokens, and creditsUsed/creditsRemaining.",
  {
    url: z.string(),
    prompt: z.string().optional().describe("Describe the JSON shape you want (alias: instruction)"),
    instruction: z.string().optional().describe("Alias for prompt"),
    schema: z
      .record(z.unknown())
      .optional()
      .describe("Optional JSON Schema to constrain the output to an exact shape"),
  },
  async (args) => asText(await call("/api/extract", args)),
);

server.tool(
  "synoppy_classify",
  "Classify a company by industry (NAICS/SIC) or against your own labels. Requires API credits. Returns data and creditsUsed/creditsRemaining.",
  {
    url: z.string(),
    labels: z
      .array(z.string())
      .optional()
      .describe("Custom labels to classify against. Omit for NAICS/SIC industry classification"),
  },
  async (args) => asText(await call("/api/classify", args)),
);

server.tool(
  "synoppy_enrich",
  "Resolve a brand profile (name, logo, colors, fonts, socials, address) from a URL, a bare domain, or a work email.",
  {
    url: z.string().optional().describe("A page URL to resolve"),
    domain: z.string().optional().describe("A bare domain, e.g. linear.app"),
    email: z.string().optional().describe("A work email; its domain is used"),
  },
  async (args) => {
    if (!args.url && !args.domain && !args.email) {
      throw new Error("Provide one of url, domain, or email.");
    }
    return asText(await call("/api/brand", args));
  },
);

server.tool(
  "synoppy_images",
  "Pull every image off a page with alt text and dimensions. Returns creditsUsed/creditsRemaining.",
  { url: z.string() },
  async (args) => asText(await call("/api/images", args)),
);

server.tool(
  "synoppy_search",
  "Search the live web and get back ranked results (title, url, snippet); optionally read each result into clean markdown.",
  {
    query: z.string().describe("The search query"),
    maxResults: z.number().int().min(1).max(15).optional().describe("Max results (1-15, default 5)"),
    markdown: z.boolean().optional().describe("Also read each result into clean markdown, in one trip"),
    includeDomains: z.array(z.string()).optional().describe("Only return results from these domains"),
    excludeDomains: z.array(z.string()).optional().describe("Never return results from these domains"),
    fanout: z.boolean().optional().describe("Expand the query into variations for higher recall (costs more)"),
  },
  async (args) => asText(await call("/api/search", args)),
);

// NOTE: /api/act is not live yet (coming soon) and is intentionally not
// exposed as a tool to avoid fabricating capabilities.

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error("Synoppy MCP server running on stdio");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal:", err);
  process.exit(1);
});
