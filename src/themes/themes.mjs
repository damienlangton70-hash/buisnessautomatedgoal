export const THEMES = {
  "dungeon-stone": {
    name: "Dungeon Stone Tile Set",
    description: "Medieval dungeon with weathered stone, moss, and iron fixtures. Perfect for dark fantasy RPGs.",
    prompts: {
      floor: "A seamless 16x16 pixel dungeon floor tile made of grey stone blocks, worn and weathered, with moss in cracks. Isometric/top-down perspective. Game art style.",
      wall: "A seamless 16x16 pixel dungeon wall tile made of dark stone blocks, rough-hewn, with shadows and depth. Supports wall placement. Game art style.",
      prop: "A seamless 16x16 pixel dungeon prop (torch, barrel, chains, or skeleton). Single object, centered, suitable for overlay. Game art style.",
    },
    tags: ["dungeon", "fantasy", "medieval", "stone", "dark"],
    color: "#5a5a5a",
    price: 4,
  },
  "cave-rock": {
    name: "Cave Rock Tile Set",
    description: "Wet cave environment with natural rock formations, stalactites, and mineral deposits. Ideal for underground exploration games.",
    prompts: {
      floor: "A seamless 16x16 pixel cave floor tile made of uneven natural rock, minerals, and wet patches. Isometric/top-down perspective. Game art style.",
      wall: "A seamless 16x16 pixel cave wall tile with natural rock formations, stalactites, and shadows. Supports wall placement. Game art style.",
      prop: "A seamless 16x16 pixel cave prop (crystal, mushroom, vine, or rock formation). Single object, centered. Game art style.",
    },
    tags: ["cave", "underground", "minerals", "stalactite", "exploration"],
    color: "#6b5d4f",
    price: 4,
  },
  "overgrown-crypt": {
    name: "Overgrown Crypt Tile Set",
    description: "Abandoned crypt reclaimed by nature. Ancient stone, twisted roots, fungi, and eerie atmosphere. Great for horror and dark fantasy.",
    prompts: {
      floor: "A seamless 16x16 pixel crypt floor tile made of ancient stone, cracked and broken, with roots and vines growing through. Isometric/top-down perspective. Game art style.",
      wall: "A seamless 16x16 pixel crypt wall tile with ancient stone, cracks, vines, roots, and fungal growth. Supports wall placement. Game art style.",
      prop: "A seamless 16x16 pixel crypt prop (tombstone, skull, vine mass, or dead tree). Single object, centered. Game art style.",
    },
    tags: ["crypt", "overgrown", "undead", "nature", "horror"],
    color: "#4a5a3a",
    price: 4,
  },
};

export function getRandomTheme() {
  const themes = Object.values(THEMES);
  return themes[Math.floor(Math.random() * themes.length)];
}

export function getTheme(key) {
  return THEMES[key];
}

export function listThemes() {
  return Object.keys(THEMES);
}
