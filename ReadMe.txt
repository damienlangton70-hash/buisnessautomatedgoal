DARK DRAGON ASSETS

See README.md for the full documentation.

This file used to hold a second, contradictory description of the project
(different file counts, different schedule, different revenue figures). It has
been reduced to a pointer so there is one source of truth.

Quick reference
---------------
  Mon-Fri 09:00 UTC   generate 5 tilesets  (npm run generate:daily)
  Sat     10:00 UTC   bundle + publish     (npm run bundle:weekly && npm run publish:weekly)
  Any time            offline pipeline test (npm run test:pipeline)

Required GitHub secrets: OPENAI_API_KEY, BUTLER_API_KEY, ITCHIO_USERNAME,
ITCHIO_GAME_SLUG.

Publishing goes through butler, itch.io's official upload tool. itch.io has no
HTTP upload API.

Part of: Horizon autonomous business network
Role: Passive income - game assets
