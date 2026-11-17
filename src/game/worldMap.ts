export type TileType =
  | 'floor'
  | 'brick'
  | 'wall'
  | 'tree'
  | 'water'
  | 'stairs'
  | 'chest'
  | 'pillar';

export interface WorldPalette {
  floorA: string;
  floorB: string;
  brickA: string;
  brickB: string;
  brickMortar: string;
  wallTop: string;
  wallFront: string;
  treeTop: string;
  treeTrunk: string;
  water: string;
  pillar: string;
}

export interface WorldNpcPlacement {
  id: string;
  kind: 'kame' | 'forja' | 'shenlong' | 'mercado' | 'torneio';
  name: string;
  subtitle: string;
  x: number;
  y: number;
}

export interface WorldMapGrid {
  mapId: string;
  width: number;
  height: number;
  tiles: TileType[][];
  spawnTile: { x: number; y: number };
  bossAltar: { x: number; y: number };
  monsterZones: { x: number; y: number }[];
  chests: { id: string; x: number; y: number }[];
  npcs: WorldNpcPlacement[];
  palette: WorldPalette;
}

export const TILE_SIZE = 44;

function getPaletteForMap(mapId: string): WorldPalette {
  switch (mapId) {
    case 'terra':
    case 'monte_paozu':
      return {
        floorA: '#3f7d47',
        floorB: '#38703f',
        brickA: '#b9936c',
        brickB: '#a9835c',
        brickMortar: '#7c5d3f',
        wallTop: '#64748b',
        wallFront: '#334155',
        treeTop: '#166534',
        treeTrunk: '#78350f',
        water: '#0284c7',
        pillar: '#cbd5e1',
      };
    case 'deserto_yamcha':
      return {
        floorA: '#c29459',
        floorB: '#b5864c',
        brickA: '#9a7144',
        brickB: '#8a6237',
        brickMortar: '#5c3f21',
        wallTop: '#92400e',
        wallFront: '#451a03',
        treeTop: '#4d7c0f',
        treeTrunk: '#78350f',
        water: '#0ea5e9',
        pillar: '#d97706',
      };
    case 'torre_karin':
    case 'palacio_kami':
    case 'sala_do_tempo':
      return {
        floorA: '#cbd5e1',
        floorB: '#bfcbd9',
        brickA: '#e2e8f0',
        brickB: '#d8e0ea',
        brickMortar: '#94a3b8',
        wallTop: '#facc15',
        wallFront: '#a16207',
        treeTop: '#15803d',
        treeTrunk: '#713f12',
        water: '#38bdf8',
        pillar: '#fde047',
      };
    case 'namekusei':
    case 'planeta_kaioh':
      return {
        floorA: '#1d7a6e',
        floorB: '#186b60',
        brickA: '#649e8e',
        brickB: '#558b7c',
        brickMortar: '#2c594f',
        wallTop: '#0f766e',
        wallFront: '#134e4a',
        treeTop: '#0ea5e9',
        treeTrunk: '#0369a1',
        water: '#10b981',
        pillar: '#99f6e4',
      };
    case 'planeta_vegeta':
    case 'planeta_freeza':
      return {
        floorA: '#43384f',
        floorB: '#3a3045',
        brickA: '#5b4b69',
        brickB: '#4f405c',
        brickMortar: '#261e2e',
        wallTop: '#7e22ce',
        wallFront: '#3b0764',
        treeTop: '#991b1b',
        treeTrunk: '#450a0a',
        water: '#7c3aed',
        pillar: '#c084fc',
      };
    default:
      // Outro Mundo / Planeta Beerus
      return {
        floorA: '#2e264a',
        floorB: '#261f3f',
        brickA: '#483b6e',
        brickB: '#3f3362',
        brickMortar: '#1c1530',
        wallTop: '#f59e0b',
        wallFront: '#78350f',
        treeTop: '#a855f7',
        treeTrunk: '#581c87',
        water: '#38bdf8',
        pillar: '#facc15',
      };
  }
}

function hash2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

const mapCache = new Map<string, WorldMapGrid>();

export function getWorldMapGrid(mapId: string): WorldMapGrid {
  const cached = mapCache.get(mapId);
  if (cached) return cached;

  const width = 44;
  const height = 34;
  let seed = 1;
  for (let i = 0; i < mapId.length; i++) seed += mapId.charCodeAt(i) * (i + 1);

  const tiles: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x++) {
      // Border walls
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push('wall');
        continue;
      }

      // Central brick sanctuary/training arena (Tibia-style brick courtyard like screenshot)
      const inCenterPlaza = x >= 15 && x <= 28 && y >= 11 && y <= 22;
      if (inCenterPlaza) {
        if ((x === 15 || x === 28) && (y === 11 || y === 22)) {
          row.push('pillar');
        } else if (x === 24 && y === 17) {
          row.push('stairs');
        } else if (x === 21 && y === 19) {
          row.push('chest');
        } else {
          row.push('brick');
        }
        continue;
      }

      // Paths radiating from center
      const onPath = Math.abs(x - 21) <= 1 || Math.abs(y - 16) <= 1;
      if (onPath) {
        row.push('brick');
        continue;
      }

      // Scattered organic obstacles (trees, pillars, chests, small ruins)
      const r = hash2d(x, y, seed);
      if (r < 0.055) {
        row.push('tree');
      } else if (r < 0.085) {
        row.push('wall');
      } else if (r < 0.092) {
        row.push('water');
      } else if (r > 0.994) {
        row.push('chest');
      } else if (r > 0.72) {
        row.push('brick');
      } else {
        row.push('floor');
      }
    }
    tiles.push(row);
  }

  // Boss altar clearing at north-east
  for (let y = 4; y <= 8; y++) {
    for (let x = 33; x <= 38; x++) {
      tiles[y][x] = 'brick';
    }
  }
  tiles[4][33] = 'pillar';
  tiles[4][38] = 'pillar';

  // Ensure guaranteed scattered treasure chests across every map
  const guaranteedChestCoords = [
    { x: 21, y: 19 },
    { x: 9, y: 10 },
    { x: 34, y: 12 },
    { x: 11, y: 24 },
    { x: 31, y: 25 },
  ];
  for (const gc of guaranteedChestCoords) {
    tiles[gc.y][gc.x] = 'chest';
  }

  const chests: { id: string; x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] === 'chest') {
        chests.push({ id: `${mapId}_${x}_${y}`, x, y });
      }
    }
  }

  const grid: WorldMapGrid = {
    mapId,
    width,
    height,
    tiles,
    spawnTile: { x: 21, y: 16 },
    bossAltar: { x: 35, y: 6 },
    monsterZones: [
      { x: 9, y: 8 },
      { x: 33, y: 14 },
      { x: 10, y: 25 },
      { x: 32, y: 26 },
      { x: 21, y: 6 },
      { x: 8, y: 16 },
      { x: 22, y: 27 },
      { x: 35, y: 20 },
    ],
    chests,
    npcs: [
      { id: `${mapId}_npc_kame`, kind: 'kame', name: 'Mestre Kame', subtitle: 'Treino & Técnicas', x: 17, y: 13 },
      { id: `${mapId}_npc_forja`, kind: 'forja', name: 'Ferreiro Dr. Brief', subtitle: 'Forja & Reciclagem', x: 26, y: 13 },
      { id: `${mapId}_npc_shenlong`, kind: 'shenlong', name: 'Altar Shenlong', subtitle: 'Esferas do Dragão', x: 21, y: 12 },
      { id: `${mapId}_npc_mercado`, kind: 'mercado', name: 'Mercador Galáctico', subtitle: 'Mercado Global', x: 17, y: 20 },
      { id: `${mapId}_npc_torneio`, kind: 'torneio', name: 'Locutor Tenkaichi', subtitle: 'Torneio PvP', x: 26, y: 20 },
    ],
    palette: getPaletteForMap(mapId),
  };

  mapCache.set(mapId, grid);
  return grid;
}

export function isTileWalkable(grid: WorldMapGrid, tx: number, ty: number): boolean {
  if (tx < 1 || ty < 1 || tx >= grid.width - 1 || ty >= grid.height - 1) return false;
  const tile = grid.tiles[ty][tx];
  return tile === 'floor' || tile === 'brick' || tile === 'stairs';
}

export function isTileFlyable(grid: WorldMapGrid, tx: number, ty: number): boolean {
  return tx >= 1 && ty >= 1 && tx < grid.width - 1 && ty < grid.height - 1;
}
