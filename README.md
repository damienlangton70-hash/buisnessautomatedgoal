# Dark Dragon Assets

Autonomous game tileset generation and weekly itch.io publishing.

Monday–Friday it generates 5 tilesets a day (a floor tile, a wall tile and a
prop each). Saturday it bundles the week into a ZIP and pushes it to itch.io as
a new pay-what-you-want pack. No human step in the loop once the secrets are
set.

## The pipeline

**Mon–Fri, 09:00 UTC** — `generate:daily`

1. Pick 5 themes from the library, **never repeating one already used this
   week**, so a weekly pack contains 25 distinct themes rather than the same
   handful over and over.
2. Generate floor / wall / prop for each via DALL-E 3 (1024×1024).
3. Downscale to the target tile size (512×512 by default).
4. Floor and wall get a genuine seamless pass (offset-and-heal, the same
   approach as GIMP's "Make Seamless"); props get their flat backdrop knocked
   out so they drop onto a map with transparency.
5. Build a preview grid showing floor and wall as a 2×2 repeat, so a buyer can
   see the tiling actually works.
6. Write a per-day manifest fragment. Raw 1024px intermediates are deleted.

**Sat, 10:00 UTC** — `bundle:weekly` then `publish:weekly`

1. Merge the week's day fragments into one manifest.
2. ZIP it: one folder per tileset (`01-dungeon-stone/floor.png`, …), plus
   `manifest.json` and a pack README.
3. Push to itch.io with **butler**, on a channel named for the ISO week, so
   each week lands as a new upload instead of replacing the last one.

Assets are handed between the weekday runs and Saturday's run through the
Actions cache and run artifacts. Nothing binary is ever committed to the repo.

## Costs

DALL-E 3 at 1024×1024 is **$0.08/image** at `hd` quality, **$0.04** at
`standard`. Each tileset is 3 images.

| | images/week | hd | standard |
|---|---|---|---|
| 5 tilesets/day, Mon–Fri | 75 | **$6.00/wk** (~$312/yr) | **$3.00/wk** (~$156/yr) |
| 3 tilesets/day, Mon–Fri | 45 | $3.60/wk | $1.80/wk |

Set the repo variable `IMAGE_QUALITY=standard` to halve it. The daily run logs
its estimated spend before it starts.

> Revenue is the unknown here, not cost. Treat any figure as a hypothesis until
> the first few packs have sold — pay-what-you-want asset packs on itch.io very
> commonly take £0 in a week, and the number of packs already on the store is
> the thing that determines whether yours gets seen.

## Setup

### 1. itch.io project

Create a project at itch.io → Dashboard → Create new project.

- **Kind of project:** Assets
- **Pricing:** Pay what you want, minimum £4
- **Generative AI disclosure:** tick it. itch.io requires disclosure for
  AI-generated assets, and the pack README states it too.

Note the **URL slug** (the `weekly-asset-pack` part of
`https://you.itch.io/weekly-asset-pack`). butler addresses games by slug, not
by the numeric ID.

### 2. API keys

- **OpenAI:** platform.openai.com → API keys
- **itch.io / butler:** itch.io → Settings → API keys → Generate new API key

### 3. GitHub secrets

Settings → Secrets and variables → Actions → Secrets:

| Secret | Value |
|---|---|
| `OPENAI_API_KEY` | your OpenAI key |
| `BUTLER_API_KEY` | your itch.io API key |
| `ITCHIO_USERNAME` | your itch.io username |
| `ITCHIO_GAME_SLUG` | the project's URL slug |

Optional repo **variables** (not secrets): `IMAGE_QUALITY` (`hd`/`standard`),
`TILESETS_PER_RUN`, `TILE_SIZE`.

### 4. Dry run before spending anything

Actions → DarkDragonAssets → Run workflow → `generate-daily`. Check the log
shows five distinct themes and the estimated spend you expect.

## Local development

```bash
npm install

# Full pipeline against locally synthesised tiles. No API calls, no cost.
npm run test:pipeline

# Generate for real (needs OPENAI_API_KEY)
npm run generate:daily

# Bundle whatever is in data/daily for the current ISO week
npm run bundle:weekly

# Push the staged pack (needs butler on PATH + the itch.io vars)
npm run publish:weekly
```

`npm run test:pipeline` is the one to run after any change to the image code.
It asserts tiles are the right size, that floor and wall tiles genuinely wrap
(by measuring the edge discontinuity against an interior baseline), that props
have transparency, that no theme repeats within a week, and that the ZIP
contains what the pack README promises.

## Customisation

**Themes** — `src/themes/themes.mjs`. 15 shipped. Add entries to the `THEMES`
object; the weekly no-repeat picker uses the whole library automatically. Adding
more directly improves pack variety, which is the main thing separating one
week's pack from the next.

**Schedule** — `.github/workflows/weekly-generate.yml`. The two crons are gated
independently; if you change a cron string you must change the matching `if:`
condition on its job.

**Volume and size** — repo variables `TILESETS_PER_RUN` and `TILE_SIZE`, or the
same env vars locally.

## File structure

```
DarkDragonAssets/
├── src/
│   ├── generate-daily.mjs      # Generate N tilesets, write a day fragment
│   ├── bundle-weekly.mjs       # Merge fragments -> ZIP staged for butler
│   ├── publish-itchio.mjs      # butler push
│   ├── tile-processor.mjs      # Resize, seamless, prop knockout, previews
│   ├── themes/themes.mjs       # 15 themes + no-repeat weekly picker
│   └── lib/week.mjs            # ISO 8601 week helpers
├── scripts/
│   └── test-pipeline.mjs       # End-to-end check, no API spend
├── data/daily/                 # Working assets (gitignored)
│   └── day-2026-36-2026-09-01.json
├── dist/<week>/                # Staged pack for butler (gitignored)
├── .github/workflows/weekly-generate.yml
├── .env.example
└── package.json
```

## License

Code MIT. Generated assets: personal and commercial use permitted; reselling
the pack itself as an asset pack is not.
