# Dark Dragon Assets

Autonomous game tile generation and itch.io publishing system. Generates 5 tilesets daily (Monday–Friday), bundles and publishes all week's assets on Saturday. Completely hands-off revenue generation.

## The Pipeline

**Monday–Friday (Daily at 9 AM UTC):**
- Generate 5 random tilesets (floor, wall, prop each)
- Process all for seamless tiling
- Create preview grids
- Store metadata + assets in weekly manifest

**Saturday (9 AM UTC):**
- Collect all week's assets (25 tilesets = 75 files)
- Create ZIP bundle with metadata + README
- Upload to itch.io as single weekly release

## Revenue Model

- **Pricing:** Pay-what-you-want, minimum £4 per weekly pack
- **Format:** ZIP containing 75 PNG files + metadata
- **Audience:** Indie developers buying game assets
- **Passive income:** Backlog accumulates; people keep buying old packs

**Cost:** ~$0.30/week (OpenAI DALL-E 3 for 15 images)  
**Conservative revenue:** £20–100/week × 52 weeks = **£1,040–5,200/year**

## Setup (One-time, 10 minutes)

### 1. Create itch.io Game Page
- Go to [itch.io](https://itch.io)
- Dashboard → Create → New Project
  - Title: "Weekly Asset Pack"
  - Classification: **Asset**
  - Pricing: Pay what you want, minimum £4
- Note the numeric **game ID** from the URL

### 2. Get API Keys
- **OpenAI:** [platform.openai.com/api/keys](https://platform.openai.com/api/keys)
- **itch.io:** Settings → API Keys → Generate key

### 3. Set GitHub Secrets
- Settings → Secrets and variables → Actions
- Add:
  - `OPENAI_API_KEY`
  - `ITCHIO_API_KEY`
  - `ITCHIO_USERNAME`
  - `ITCHIO_GAME_ID`

Once set, workflows run automatically.

## Usage

### Automatic (Production)
- **M–F 9 AM UTC:** Generate 5 tilesets
- **Sat 9 AM UTC:** Bundle and upload week's assets
- Check **Actions** tab in GitHub for logs

### Manual Trigger
Go to **Actions** → **DarkDragonAssets Daily & Weekly** → **Run workflow**

### Local Development
```bash
npm install
TEST_MODE=true npm run generate:daily
TEST_MODE=true npm run bundle:weekly
```

## Customization

### Add New Themes
Edit `src/themes/themes.mjs` to add new tile themes.

### Change Schedule
Edit `.github/workflows/weekly-generate.yml`:
```yaml
schedule:
  - cron: "0 9 * * 1-5"  # Daily M-F
  - cron: "0 9 * * 6"    # Saturday bundle
```

### Adjust Tile Count
Edit `src/generate-daily.mjs`, line 15:
```javascript
const ASSETS_PER_RUN = 5;
```

## File Structure

```
DarkDragonAssets/
├── src/
│   ├── generate-daily.mjs      # Generate 5 tilesets
│   ├── bundle-weekly.mjs       # Bundle + upload
│   ├── tile-processor.mjs      # Seamless tiling
│   ├── itchio-uploader.mjs     # itch.io API
│   └── themes/
│       └── themes.mjs          # Theme definitions
├── data/
│   └── daily/
│       ├── week-2026-35.json   # Weekly manifest
│       ├── assets...           # Generated files
│       └── week-2026-35.zip    # Bundled pack
├── .github/workflows/
│   └── weekly-generate.yml     # GitHub Actions
├── .env.example                # Configuration
├── package.json
└── README.md
```

## License

- **Code:** MIT
- **Generated Assets:** Personal & commercial use permitted

---

**System:** DarkDragonAssets  
**Venue:** itch.io  
**Frequency:** Daily M–F, weekly bundle Saturday  
**Status:** Ready for production
