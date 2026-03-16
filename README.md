# Oh My Gauss

MCP server that gives Claude access to science knowledge — searches research papers, scrapes science news, and builds a local RAG knowledge base.

No Docker required. Works with Claude Desktop and Claude Code out of the box.

## Quick Start

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oh-my-gauss": {
      "command": "npx",
      "args": ["oh-my-gauss"],
      "env": {
        "FIRECRAWL_API_KEY": "fc-your-key",
        "ANTHROPIC_API_KEY": "sk-ant-your-key"
      }
    }
  }
}
```

Or add to Claude Code:

```bash
claude mcp add oh-my-gauss -- npx oh-my-gauss
```

Restart Claude, and you'll have 4 new science tools available.

## Tools

### `search_papers`
Search academic papers via Semantic Scholar and arXiv APIs. **Free — no API key needed.**

> "Search for recent papers on quantum error correction"

### `scrape_science`
Scrape science websites using Firecrawl and add articles to the knowledge base. Works with 17 preconfigured sources or any custom URL.

> "Scrape the latest physics articles from Phys.org"

### `search_science`
Query the local RAG knowledge base. Returns relevant article excerpts with source URLs and relevance scores.

> "What do we know about CRISPR gene editing applications?"

### `list_sources`
Show all preconfigured science sources and knowledge base statistics.

## Science Fields

| Field | Sources |
|-------|---------|
| Nanotechnology | Phys.org, ScienceDaily |
| Physics | Phys.org, Quanta Magazine |
| Earth | EarthSky, ScienceDaily, Phys.org |
| Astronomy & Space | EarthSky, Phys.org, Science News |
| Chemistry | Chemistry World, Phys.org |
| Biology | ScienceDaily, Phys.org, Nature News |
| Materials Science | Phys.org, ScienceDaily |

## API Keys

| Key | Required | Where to get it |
|-----|----------|----------------|
| `FIRECRAWL_API_KEY` | For web scraping | [firecrawl.dev](https://firecrawl.dev) (free tier available) |
| `ANTHROPIC_API_KEY` | For chat tutor | [console.anthropic.com](https://console.anthropic.com) |

Paper search (`search_papers`) works without any API keys — it uses the free Semantic Scholar and arXiv APIs.

## Configuration

All optional. Set via environment variables or a `.env` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_BACKEND` | `local` | `local` (file-based) or `chroma` (ChromaDB) |
| `VECTOR_STORE_PATH` | `./data` | Where local vector store saves data |
| `CHROMADB_URL` | `http://localhost:8000` | ChromaDB URL (if using chroma backend) |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model for the chat tutor |
| `MCP_PORT` | `3100` | Port for HTTP transport mode |
| `CRON_FIELDS` | all fields | Comma-separated fields for daily cron |

## Platform Support

Works on **Linux, macOS, and Windows** — everything is pure JavaScript and HTTP calls, no native binaries.

| Component | Linux | macOS | Windows |
|-----------|:-----:|:-----:|:-------:|
| Local vector store (JSON file) | Yes | Yes | Yes |
| Local embeddings (@xenova/transformers) | Yes | Yes | Yes |
| Semantic Scholar / arXiv APIs | Yes | Yes | Yes |
| Firecrawl API | Yes | Yes | Yes |
| stdio MCP transport | Yes | Yes | Yes |

**Only requirement:** Node.js 18+

### Claude Desktop config location

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

## How It Works

```
Scrape / Search Papers
        ↓
   Chunk articles (~500 tokens each)
        ↓
   Embed with all-MiniLM-L6-v2 (local, 384-dim)
        ↓
   Store in local vector DB (JSON file)
        ↓
   Query via cosine similarity → return to Claude
```

All embeddings run locally using `@xenova/transformers` — no external embedding API calls.

## Development

```bash
git clone https://github.com/tmartin2113/Oh_My_Gauss.git
cd Oh_My_Gauss
npm install
cp .env.example .env   # fill in your API keys
```

### Scripts

```bash
npm run mcp          # Start stdio MCP server (dev)
npm run mcp:http     # Start HTTP MCP server
npm run papers       # Search papers via CLI
npm run scrape       # Scrape sources via CLI
npm run chat         # Interactive chat tutor
npm run cron:daily   # Fetch last 24h papers
npm run build        # Compile to dist/
```

## HTTP Transport

For remote or multi-client usage, run the HTTP server:

```bash
npm run mcp:http
# Server at http://127.0.0.1:3100/mcp
# Health check at http://127.0.0.1:3100/health
```

## License

MIT
