/**
 * Theme library.
 *
 * Sizing note: DALL-E 3 renders at 1024x1024 and cannot produce true low-res
 * pixel art, so the prompts ask for a clean top-down texture and the tile
 * processor downscales to the target tile size. Asking for "16x16 pixel"
 * (as the original prompts did) just produced 1024px paintings *of* pixel art.
 */

const FLOOR_STYLE =
  "Top-down orthographic view, flat even lighting, fills the entire frame edge to edge, " +
  "no border, no vignette, no drop shadow, no text, no watermark, no characters. " +
  "Repeating texture suitable for a game floor tile.";

const WALL_STYLE =
  "Top-down orthographic view, flat even lighting, fills the entire frame edge to edge, " +
  "no border, no vignette, no text, no watermark, no characters. " +
  "Repeating texture suitable for a game wall tile.";

const PROP_STYLE =
  "Single object centred on a plain flat black background, orthographic view, " +
  "even lighting, generous margin around the object, no text, no watermark, no other objects.";

function theme(key, { name, description, tags, color, floor, wall, prop }) {
  return {
    key,
    name,
    description,
    tags,
    color,
    prompts: {
      floor: `${floor} ${FLOOR_STYLE}`,
      wall: `${wall} ${WALL_STYLE}`,
      prop: `${prop} ${PROP_STYLE}`,
    },
  };
}

export const THEMES = {
  "dungeon-stone": theme("dungeon-stone", {
    name: "Dungeon Stone",
    description:
      "Medieval dungeon with weathered stone, moss, and iron fixtures. For dark fantasy RPGs.",
    tags: ["dungeon", "fantasy", "medieval", "stone", "dark"],
    color: "#5a5a5a",
    floor: "Weathered grey stone block dungeon floor, worn edges, moss in the cracks.",
    wall: "Rough-hewn dark stone dungeon wall, deep mortar lines, damp patches.",
    prop: "A rusted iron wall torch with a burning flame, dark fantasy game art.",
  }),
  "cave-rock": theme("cave-rock", {
    name: "Cave Rock",
    description:
      "Wet cave environment with natural rock and mineral deposits. For underground exploration.",
    tags: ["cave", "underground", "minerals", "exploration", "natural"],
    color: "#6b5d4f",
    floor: "Uneven natural cave rock floor, wet patches, scattered pebbles, mineral veins.",
    wall: "Natural cave rock wall face, jagged strata, damp mineral streaks.",
    prop: "A cluster of glowing blue crystals growing from a rock base, game art.",
  }),
  "overgrown-crypt": theme("overgrown-crypt", {
    name: "Overgrown Crypt",
    description:
      "Abandoned crypt reclaimed by nature. Ancient stone, twisted roots, fungi. For horror and dark fantasy.",
    tags: ["crypt", "overgrown", "undead", "nature", "horror"],
    color: "#4a5a3a",
    floor: "Cracked ancient crypt flagstones with roots and creeping vines pushing through.",
    wall: "Ancient crypt wall of carved stone, split by roots, fungal growth in the cracks.",
    prop: "A weathered leaning tombstone with faded carving and clinging ivy, game art.",
  }),
  "frozen-tundra": theme("frozen-tundra", {
    name: "Frozen Tundra",
    description:
      "Snow-packed ground and blue glacial ice. For winter overworlds and ice dungeons.",
    tags: ["snow", "ice", "winter", "tundra", "cold"],
    color: "#c7dbe6",
    floor: "Packed snow over cracked blue glacial ice, wind-carved ridges, frost detail.",
    wall: "A wall of translucent blue glacial ice, internal fractures and frost rime.",
    prop: "A jagged shard of blue ice jutting upward, frost at its base, game art.",
  }),
  "volcanic-basalt": theme("volcanic-basalt", {
    name: "Volcanic Basalt",
    description:
      "Cooled black basalt shot through with molten cracks. For fire dungeons and forge levels.",
    tags: ["volcanic", "lava", "fire", "basalt", "infernal"],
    color: "#3a2020",
    floor: "Cracked black basalt floor with glowing orange molten lava seams and ash dust.",
    wall: "Black volcanic rock wall, sharp fractures, faint orange glow deep in the cracks.",
    prop: "A jagged obsidian spire with molten orange veins glowing inside it, game art.",
  }),
  "sunken-ruins": theme("sunken-ruins", {
    name: "Sunken Ruins",
    description:
      "Flooded stonework, coral and barnacles. For underwater levels and drowned temples.",
    tags: ["underwater", "ruins", "coral", "flooded", "temple"],
    color: "#2f6b6b",
    floor: "Submerged cracked temple stone floor covered in barnacles, coral and green algae.",
    wall: "Waterlogged carved stone wall encrusted with coral, barnacles and seaweed.",
    prop: "A barnacle-crusted broken amphora resting on sand, game art.",
  }),
  "desert-sandstone": theme("desert-sandstone", {
    name: "Desert Sandstone",
    description:
      "Sun-bleached sandstone and drifting sand. For tomb crawls and desert overworlds.",
    tags: ["desert", "sandstone", "tomb", "ancient", "arid"],
    color: "#c9a06a",
    floor: "Sun-bleached sandstone slabs half buried under drifting fine sand, hairline cracks.",
    wall: "Carved sandstone tomb wall with worn relief carving and sand dust.",
    prop: "A cracked clay urn half sunk in desert sand, game art.",
  }),
  "verdant-forest": theme("verdant-forest", {
    name: "Verdant Forest",
    description:
      "Damp forest floor, leaf litter and bark. For woodland overworlds and druid groves.",
    tags: ["forest", "grass", "nature", "woodland", "green"],
    color: "#3f6b34",
    floor: "Damp forest floor of moss, fallen leaves, twigs and exposed dark soil.",
    wall: "A dense wall of gnarled tree bark and knotted trunks packed tightly together.",
    prop: "A cluster of red-capped toadstool mushrooms on a mossy mound, game art.",
  }),
  "arcane-sanctum": theme("arcane-sanctum", {
    name: "Arcane Sanctum",
    description:
      "Polished marble inlaid with glowing runes. For wizard towers and magical vaults.",
    tags: ["arcane", "magic", "runes", "marble", "wizard"],
    color: "#4b3f7a",
    floor: "Polished dark marble floor inlaid with softly glowing purple arcane runes.",
    wall: "Smooth violet marble wall with inlaid silver rune bands and a faint magical glow.",
    prop: "A floating glowing purple crystal orb above a small stone pedestal, game art.",
  }),
  "rusted-foundry": theme("rusted-foundry", {
    name: "Rusted Foundry",
    description:
      "Riveted iron plate and oil stains. For steampunk factories and derelict ships.",
    tags: ["industrial", "steampunk", "rust", "metal", "factory"],
    color: "#6e4a32",
    floor: "Riveted rusted iron plate flooring with oil stains, grime and a worn tread pattern.",
    wall: "Rusted riveted steel bulkhead wall with bolts, weld seams and peeling paint.",
    prop: "A dented rusty oil barrel with a stencilled marking, game art.",
  }),
  "blighted-swamp": theme("blighted-swamp", {
    name: "Blighted Swamp",
    description:
      "Stagnant water, sunken roots and sickly growth. For witch bogs and poison levels.",
    tags: ["swamp", "bog", "poison", "marsh", "blight"],
    color: "#4a5535",
    floor: "Stagnant murky swamp water over sunken mud, algae scum, half-submerged roots.",
    wall: "A dense wall of tangled swamp roots, mud, rotting bark and hanging moss.",
    prop: "A twisted dead swamp tree stump with hanging moss, game art.",
  }),
  "gilded-palace": theme("gilded-palace", {
    name: "Gilded Palace",
    description:
      "Inlaid marble and gold leaf. For throne rooms, vaults and noble interiors.",
    tags: ["palace", "gold", "royal", "marble", "interior"],
    color: "#b08b3f",
    floor: "Cream and black marble palace floor in a geometric pattern with gold leaf inlay.",
    wall: "Ornate palace wall panel, cream marble with carved gold filigree borders.",
    prop: "An ornate golden candelabrum with lit white candles, game art.",
  }),
  "necrotic-bone": theme("necrotic-bone", {
    name: "Necrotic Bone",
    description:
      "Packed bone and ash. For lich lairs, ossuaries and necromancer dungeons.",
    tags: ["bone", "necromancy", "undead", "ossuary", "horror"],
    color: "#8a8069",
    floor: "Floor of packed pale bones and grey ash, skulls and fragments pressed flat.",
    wall: "Ossuary wall built from stacked skulls and long bones set in grey mortar.",
    prop: "A stacked pile of pale skulls with a faint green glow in the eye sockets, game art.",
  }),
  "neon-undercity": theme("neon-undercity", {
    name: "Neon Undercity",
    description:
      "Wet concrete and neon spill. For cyberpunk alleys and sci-fi slums.",
    tags: ["cyberpunk", "neon", "scifi", "urban", "night"],
    color: "#1f2a44",
    floor: "Wet cracked concrete street with puddles reflecting pink and cyan neon light.",
    wall: "Grimy concrete alley wall with conduit pipes, graffiti smears and neon spill light.",
    prop: "A glowing cyan neon sign bracket on a short pole, cyberpunk game art.",
  }),
  "celestial-void": theme("celestial-void", {
    name: "Celestial Void",
    description:
      "Starfield stone and nebula light. For astral planes and endgame dimensions.",
    tags: ["astral", "space", "celestial", "void", "cosmic"],
    color: "#2b2350",
    floor: "Dark translucent stone floor with a starfield and violet nebula glowing beneath it.",
    wall: "A wall of deep indigo cosmic stone flecked with stars and drifting nebula light.",
    prop: "A slowly rotating fragment of star-flecked astral rock, game art.",
  }),
};

export const THEME_KEYS = Object.keys(THEMES);

/**
 * Pick `count` themes, never repeating one already used this week.
 *
 * The original picked uniformly at random *with replacement* from three
 * themes, so a 25-tileset weekly pack held roughly eight near-identical copies
 * of each theme and every week's pack looked like the last one.
 *
 * @param {number} count how many themes to return
 * @param {string[]} [usedKeys] theme keys already used earlier in the week
 */
export function pickThemes(count, usedKeys = []) {
  const used = new Set(usedKeys);
  let pool = THEME_KEYS.filter((k) => !used.has(k));

  // Only once the week exhausts the library do we allow reuse, and even then
  // we reshuffle rather than sampling with replacement.
  if (pool.length < count) pool = [...THEME_KEYS];

  return shuffle(pool)
    .slice(0, count)
    .map((k) => THEMES[k]);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getTheme(key) {
  return THEMES[key];
}

export function listThemes() {
  return THEME_KEYS;
}
