# shrinkedin-mcp

LinkedIn MCP server with robust session storage. Scrape profiles, companies, and jobs via Patchright (stealth browser) with persistent auth.

## Features

- **Session storage**: Persistent browser profile at `~/.linkedin-mcp/profile`
- **Browser warm-up**: Visits Google → Wikipedia → GitHub before LinkedIn login to reduce captcha triggers
- **Cross-platform cookies**: Exports `cookies.json` for Docker/macOS→Linux use
- **MCP tools**: `get_person_profile`, `get_company_profile`, `get_company_posts`, `search_jobs`, `search_people`, `get_job_details`, `close_session`

## Prerequisites

- Node.js 20+
- Patchright Chromium: `npx patchright install chromium`

## Installation

```bash
npm install -g shrinkedin-mcp
# or
npx shrinkedin-mcp
```

## First-time setup

```bash
npx shrinkedin-mcp --login
```

Opens a browser: warm-up (Google, Wikipedia, GitHub), then LinkedIn login. Complete auth (2FA, captcha, etc.). Profile saved to `~/.linkedin-mcp/profile`.

## MCP client config

```json
{
  "mcpServers": {
    "shrinkedin": {
      "command": "npx",
      "args": ["shrinkedin-mcp"]
    }
  }
}
```

Or with local install:

```json
{
  "mcpServers": {
    "shrinkedin": {
      "command": "shrinkedin-mcp"
    }
  }
}
```

## CLI

| Flag | Description |
|------|-------------|
| `--login` | Create session (warm-up + manual login) |
| `--logout` | Clear stored profile |
| `--status` | Check if session is valid |
| `--no-headless` | Show browser (debug) |
| `--timeout MS` | Page timeout (default 5000) |
| `--user-data-dir PATH` | Override profile path |

## Tools

- **get_person_profile** – `linkedin_username`, optional `sections`: experience, education, interests, honors, languages, contact_info
- **get_company_profile** – `company_name`, optional `sections`: posts, jobs
- **get_company_posts** – `company_name`
- **search_jobs** – `keywords`, optional `location`
- **search_people** – `keywords`, optional `location`
- **get_job_details** – `job_id`
- **close_session** – Close browser and cleanup

## License

MIT
