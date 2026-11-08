// ============================================================================
// SZIMULÁCIÓS KONSTANSOK
// ============================================================================
export const WARNING_DISTANCE = 75;      // Ütközésveszély biztonsági zóna sugara (75 képpont)
export const COLLISION_DISTANCE = 28;    // Kritikus ütközési távolság (28 képpont alatt robbanás és Game Over)
export const DEADLOCK_GRACE_SECONDS = 5; // Hány másodpercnyi teljes leállás után jelezzen holtpontot (deadlock)

/**
 * Rekurzív mélyfagyasztás (deepFreeze):
 * Garantálja, hogy a LEVELS objektumban tárolt pályageometria és menetrend
 * futásidőben véletlenül se módosulhasson.
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (
      obj[prop] !== null &&
      (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

// ============================================================================
// PÁLYÁK (SZINTEK) TOPOLÓGIÁJA ÉS MENETRENDJE (Vonat 1, Vonat 2 stb. nevekkel)
// ============================================================================
export const LEVELS = deepFreeze({
  // --------------------------------------------------------------------------
  // 1. SZINT: Könnyű pálya (1 belépési pont, 2 váltó, 3 jelző, 2 peron, 1 zsákvágány, 4 vonat)
  // --------------------------------------------------------------------------
  1: {
    id: 1,
    name: '1. szint: Kitérő vágány jelzőkkel (Könnyű)',
    // Csomópontok (nodes): koordináták, típusok és váltókapcsolatok
    nodes: {
      IN1:    { id: 'IN1',    x: 85,  y: 280, type: 'entry', label: '▶ BELÉPÉS' },
      N1:     { id: 'N1',     x: 220, y: 280, type: 'normal' },
      SW1:    {
        id: 'SW1', x: 340, y: 280, type: 'switch', label: 'V1',
        stem: 'N1', branches: ['N_MAIN', 'N_SIDE', 'N_STUB'], activeBranch: 0
      },
      N_MAIN: { id: 'N_MAIN', x: 520, y: 280, type: 'normal', label: 'Fővágány' },
      N_SIDE: { id: 'N_SIDE', x: 520, y: 150, type: 'normal', label: 'Kitérővágány' },
      N_STUB: { id: 'N_STUB', x: 480, y: 440, type: 'normal', label: 'Zsákvágány (vágányvég)' },
      SW2:    {
        id: 'SW2', x: 690, y: 280, type: 'switch', label: 'V2',
        stem: 'N_MAIN', branches: ['P1', 'M_P2'], activeBranch: 0
      },
      M_P2:   { id: 'M_P2',   x: 740, y: 150, type: 'merge', next: 'P2' },
      P1:     { id: 'P1',     x: 855, y: 280, type: 'platform', label: '1. Végállomás (Kék)',   platformColor: '#38bdf8' },
      P2:     { id: 'P2',     x: 855, y: 150, type: 'platform', label: '2. Végállomás (Sárga)', platformColor: '#f59e0b' }
    },
    // Vágányszakaszok (edges): melyik csomópontot melyikkel köti össze sín
    edges: [
      { from: 'IN1',    to: 'N1' },
      { from: 'N1',     to: 'SW1' },
      { from: 'SW1',    to: 'N_MAIN' },
      { from: 'SW1',    to: 'N_SIDE' },
      { from: 'SW1',    to: 'N_STUB' },
      { from: 'N_MAIN', to: 'SW2' },
      { from: 'N_SIDE', to: 'M_P2' },
      { from: 'SW2',    to: 'P1' },
      { from: 'SW2',    to: 'M_P2' },
      { from: 'M_P2',   to: 'P2' }
    ],
    // Kétoptikás fényjelzők (signals): melyik vágányszakaszt védik és hol jelennek meg
    signals: [
      { id: 'SIG1', nodeId: 'N1',     fromNode: 'IN1', x: 195, y: 330, state: 'GREEN', label: 'J1 (Bejárat)' },
      { id: 'SIG2', nodeId: 'N_MAIN', fromNode: 'SW1', x: 495, y: 330, state: 'GREEN', label: 'J2 (Fővágány)' },
      { id: 'SIG3', nodeId: 'N_SIDE', fromNode: 'SW1', x: 495, y: 100, state: 'GREEN', label: 'J3 (Kitérő)' }
    ],
    // Érkező vonatok menetrendje (Vonat 1 - Vonat 4)
    schedule: [
      { id: 'Vonat 1', spawnTime: 1,  entryNode: 'IN1', nextNode: 'N1', speed: 80, targetPlatform: 'P1', color: '#38bdf8' },
      { id: 'Vonat 2', spawnTime: 7,  entryNode: 'IN1', nextNode: 'N1', speed: 85, targetPlatform: 'P2', color: '#f59e0b' },
      { id: 'Vonat 3', spawnTime: 14, entryNode: 'IN1', nextNode: 'N1', speed: 80, targetPlatform: 'P1', color: '#38bdf8' },
      { id: 'Vonat 4', spawnTime: 21, entryNode: 'IN1', nextNode: 'N1', speed: 90, targetPlatform: 'P2', color: '#f59e0b' }
    ]
  },

  // --------------------------------------------------------------------------
  // 2. SZINT: Közepes pálya (2 belépési pont, 3 váltó, 4 jelző, 3 peron, 5 vonat)
  // --------------------------------------------------------------------------
  2: {
    id: 2,
    name: '2. szint: Rendező-pályaudvar (Közepes)',
    nodes: {
      IN1: { id: 'IN1', x: 85,  y: 170, type: 'entry', label: '▶ ÉSZAKI BELÉPÉS' },
      IN2: { id: 'IN2', x: 85,  y: 390, type: 'entry', label: '▶ DÉLI BELÉPÉS' },
      N1:  { id: 'N1',  x: 215, y: 170, type: 'normal' },
      N2:  { id: 'N2',  x: 215, y: 390, type: 'normal' },
      SW1: {
        id: 'SW1', x: 340, y: 170, type: 'switch', label: 'V1',
        stem: 'N1', branches: ['N3', 'SW3'], activeBranch: 0
      },
      SW2: {
        id: 'SW2', x: 340, y: 390, type: 'switch', label: 'V2',
        stem: 'N2', branches: ['SW3', 'N3'], activeBranch: 0
      },
      N3:  { id: 'N3',  x: 560, y: 170, type: 'merge', next: 'P1', label: 'Felső rendező' },
      SW3: {
        id: 'SW3', x: 560, y: 390, type: 'switch', label: 'V3',
        stems: ['SW2', 'SW1'], branches: ['N4', 'N5'], activeBranch: 0
      },
      N4:  { id: 'N4',  x: 700, y: 290, type: 'normal' },
      N5:  { id: 'N5',  x: 700, y: 450, type: 'normal' },
      P1:  { id: 'P1',  x: 855, y: 170, type: 'platform', label: 'Célállomás 1 (Kék)',   platformColor: '#38bdf8' },
      P2:  { id: 'P2',  x: 855, y: 290, type: 'platform', label: 'Célállomás 2 (Sárga)', platformColor: '#f59e0b' },
      P3:  { id: 'P3',  x: 855, y: 450, type: 'platform', label: 'Célállomás 3 (Lila)',  platformColor: '#a855f7' }
    },
    edges: [
      { from: 'IN1', to: 'N1' },
      { from: 'IN2', to: 'N2' },
      { from: 'N1',  to: 'SW1' },
      { from: 'N2',  to: 'SW2' },
      { from: 'SW1', to: 'N3' },
      { from: 'SW1', to: 'SW3' },
      { from: 'SW2', to: 'SW3' },
      { from: 'SW2', to: 'N3' },
      { from: 'N3',  to: 'P1' },
      { from: 'SW3', to: 'N4' },
      { from: 'SW3', to: 'N5' },
      { from: 'N4',  to: 'P2' },
      { from: 'N5',  to: 'P3' }
    ],
    signals: [
      { id: 'SIG1', nodeId: 'N1',  fromNode: 'IN1', x: 195, y: 120, state: 'GREEN', label: 'J1 (Észak)' },
      { id: 'SIG2', nodeId: 'N2',  fromNode: 'IN2', x: 195, y: 440, state: 'GREEN', label: 'J2 (Dél)' },
      { id: 'SIG3', nodeId: 'N3',  fromNode: 'SW1', x: 530, y: 120, state: 'GREEN', label: 'J3 (Felső)' },
      { id: 'SIG4', nodeId: 'SW3', fromNode: 'SW2', x: 520, y: 440, state: 'GREEN', label: 'J4 (Alsó)' }
    ],
    // Érkező vonatok menetrendje (Vonat 1 - Vonat 5)
    schedule: [
      { id: 'Vonat 1', spawnTime: 1,  entryNode: 'IN1', nextNode: 'N1', speed: 80,  targetPlatform: 'P1', color: '#38bdf8' },
      { id: 'Vonat 2', spawnTime: 3,  entryNode: 'IN2', nextNode: 'N2', speed: 65,  targetPlatform: 'P2', color: '#f59e0b' },
      { id: 'Vonat 3', spawnTime: 8,  entryNode: 'IN1', nextNode: 'N1', speed: 95,  targetPlatform: 'P3', color: '#a855f7' },
      { id: 'Vonat 4', spawnTime: 12, entryNode: 'IN2', nextNode: 'N2', speed: 70,  targetPlatform: 'P1', color: '#38bdf8' },
      { id: 'Vonat 5', spawnTime: 17, entryNode: 'IN2', nextNode: 'N2', speed: 105, targetPlatform: 'P3', color: '#a855f7' }
    ]
  },

  // --------------------------------------------------------------------------
  // 3. SZINT: Nehéz pálya (2 fővonal belépés, 4 váltó, 5 jelző, 4 peron, 6 vonat)
  // --------------------------------------------------------------------------
  3: {
    id: 3,
    name: '3. szint: Fejpályaudvari csúcsforgalom (Nehéz)',
    nodes: {
      IN1:  { id: 'IN1',  x: 85,  y: 185, type: 'entry', label: '▶ I. FŐVONAL' },
      IN2:  { id: 'IN2',  x: 85,  y: 375, type: 'entry', label: '▶ II. FŐVONAL' },
      N1:   { id: 'N1',   x: 215, y: 185, type: 'normal' },
      N2:   { id: 'N2',   x: 215, y: 375, type: 'normal' },
      SW1:  {
        id: 'SW1', x: 345, y: 185, type: 'switch', label: 'V1',
        stem: 'N1', branches: ['SW3', 'SW4'], activeBranch: 0
      },
      SW2:  {
        id: 'SW2', x: 345, y: 375, type: 'switch', label: 'V2',
        stem: 'N2', branches: ['SW4', 'SW3'], activeBranch: 0
      },
      SW3:  {
        id: 'SW3', x: 575, y: 165, type: 'switch', label: 'V3',
        stems: ['SW1', 'SW2'], branches: ['N_P1', 'N_P2'], activeBranch: 0
      },
      SW4:  {
        id: 'SW4', x: 575, y: 395, type: 'switch', label: 'V4',
        stems: ['SW2', 'SW1'], branches: ['N_P3', 'N_P4'], activeBranch: 0
      },
      N_P1: { id: 'N_P1', x: 715, y: 100, type: 'normal' },
      N_P2: { id: 'N_P2', x: 715, y: 220, type: 'normal' },
      N_P3: { id: 'N_P3', x: 715, y: 340, type: 'normal' },
      N_P4: { id: 'N_P4', x: 715, y: 460, type: 'normal' },
      P1:   { id: 'P1',   x: 855, y: 100, type: 'platform', label: '1. Peron (Kék)',   platformColor: '#38bdf8' },
      P2:   { id: 'P2',   x: 855, y: 220, type: 'platform', label: '2. Peron (Sárga)', platformColor: '#f59e0b' },
      P3:   { id: 'P3',   x: 855, y: 340, type: 'platform', label: '3. Peron (Lila)',  platformColor: '#a855f7' },
      P4:   { id: 'P4',   x: 855, y: 460, type: 'platform', label: '4. Peron (Pink)',  platformColor: '#ec4899' }
    },
    edges: [
      { from: 'IN1',  to: 'N1' },
      { from: 'IN2',  to: 'N2' },
      { from: 'N1',   to: 'SW1' },
      { from: 'N2',   to: 'SW2' },
      { from: 'SW1',  to: 'SW3' },
      { from: 'SW1',  to: 'SW4' },
      { from: 'SW2',  to: 'SW4' },
      { from: 'SW2',  to: 'SW3' },
      { from: 'SW3',  to: 'N_P1' },
      { from: 'SW3',  to: 'N_P2' },
      { from: 'SW4',  to: 'N_P3' },
      { from: 'SW4',  to: 'N_P4' },
      { from: 'N_P1', to: 'P1' },
      { from: 'N_P2', to: 'P2' },
      { from: 'N_P3', to: 'P3' },
      { from: 'N_P4', to: 'P4' }
    ],
    signals: [
      { id: 'SIG1', nodeId: 'N1',   fromNode: 'IN1', x: 195, y: 135, state: 'GREEN', label: 'J1 (I. Fővonal)' },
      { id: 'SIG2', nodeId: 'N2',   fromNode: 'IN2', x: 195, y: 425, state: 'GREEN', label: 'J2 (II. Fővonal)' },
      { id: 'SIG3', nodeId: 'SW3',  fromNode: 'SW1', x: 535, y: 115, state: 'GREEN', label: 'J3 (Felső elosztó)' },
      { id: 'SIG4', nodeId: 'SW4',  fromNode: 'SW2', x: 535, y: 445, state: 'GREEN', label: 'J4 (Alsó elosztó)' },
      { id: 'SIG5', nodeId: 'N_P2', fromNode: 'SW3', x: 695, y: 265, state: 'GREEN', label: 'J5 (2. Peron)' }
    ],
    // Érkező vonatok menetrendje (Vonat 1 - Vonat 6)
    schedule: [
      { id: 'Vonat 1', spawnTime: 1,  entryNode: 'IN1', nextNode: 'N1', speed: 85, targetPlatform: 'P1', color: '#38bdf8' },
      { id: 'Vonat 2', spawnTime: 2,  entryNode: 'IN2', nextNode: 'N2', speed: 75, targetPlatform: 'P4', color: '#ec4899' },
      { id: 'Vonat 3', spawnTime: 6,  entryNode: 'IN1', nextNode: 'N1', speed: 90, targetPlatform: 'P3', color: '#a855f7' },
      { id: 'Vonat 4', spawnTime: 9,  entryNode: 'IN2', nextNode: 'N2', speed: 80, targetPlatform: 'P2', color: '#f59e0b' },
      { id: 'Vonat 5', spawnTime: 13, entryNode: 'IN1', nextNode: 'N1', speed: 95, targetPlatform: 'P2', color: '#f59e0b' },
      { id: 'Vonat 6', spawnTime: 16, entryNode: 'IN2', nextNode: 'N2', speed: 85, targetPlatform: 'P1', color: '#38bdf8' }
    ]
  }
});

// ============================================================================
// KÖZPONTI JÁTÉKÁLLAPOT OBJEKTUM (state)
// Minden modul (app.js, render.js) ebből olvassa ki az aktuális adatokat.
// ============================================================================
export const state = {
  playerName: '',             // A belépett diszpécser (játékos) neve
  levelId: 1,                 // Aktuális szint száma (1, 2 vagy 3)
  levelName: LEVELS[1].name,  // Aktuális szint megnevezése
  running: false,             // Fut-e éppen a szimuláció (időmérés és vonatmozgás)
  gameOver: false,            // Véget ért-e a futam (győzelem vagy katasztrófa miatt)
  victory: false,             // Győzelemmel ért-e véget a futam
  justFinished: false,        // Jelzőbit az app.js-nek: ebben a frame-ben fejeződött-e be a pálya
  gameOverReason: '',         // A futam végének szöveges indoklása a modális kártyán
  deadlockWarning: false,     // Fennáll-e a holtpont (minden vonat áll)
  stalledTime: 0,             // Hány másodperce áll megszakítás nélkül az összes vonat
  elapsedTime: 0,             // Eltelt játékidő másodpercben
  stats: {
    arrived: 0,               // Helyes peronra befutott vonatok száma
    errors: 0,                // Hibapontok (kisiklás, téves célállomás, ütközés)
    totalTrains: 4            // Az adott szinten érkező összes vonat száma
  },
  nodes: {},                  // Az aktuális pálya csomópontjainak másolata (a váltók állapota itt változik)
  edges: [],                  // Az aktuális pálya vágányszakaszai
  signals: [],                // Az aktuális pálya jelzői (itt változik a RED / GREEN állapot)
  schedule: [],               // Az aktuális pálya menetrendje (spawned és done jelzőkkel)
  trains: [],                 // A jelenleg a pályán közlekedő vonatok tömbje
  warnings: [],               // Az aktuális képkockában észlelt ütközésveszély-zónák
  explosions: [],             // Robbanások koordinátái ütközés esetén
  logs: []                    // Valós idejű eseménynapló bejegyzései (legfeljebb 35 db)
};

// ============================================================================
// SEGÉDFÜGGVÉNYEK ÉS PÁLYAINICIALIZÁLÁS
// ============================================================================

/**
 * Másodpercben megadott időt alakít át kétjegyű "PP:MM" (perc:másodperc) szöveggé.
 */
export function formatTime(seconds) {
  const totalSec = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Új bejegyzést szúr be az eseménynapló (state.logs) elejére az aktuális időbélyeggel.
 */
export function addLog(message, type = 'normal') {
  const timeStr = formatTime(state.elapsedTime);
  state.logs.unshift({ time: timeStr, message, type });
  // Legfeljebb a legutóbbi 35 eseményt tartjuk meg a memóriában
  if (state.logs.length > 35) {
    state.logs.pop();
  }
}

/**
 * Alaphelyzetbe állítja a választott pályát (levelId) és játékosnevet.
 * Mélymásolatot (JSON.parse/stringify) készít a befagyasztott LEVELS sablonból,
 * hogy a váltók és jelzők szabadon kapcsolhatók legyenek.
 */
export function initLevel(levelId, playerName = state.playerName) {
  try {
    const tpl = LEVELS[levelId];
    if (!tpl) {
      throw new Error(`Érvénytelen pályaazonosító: ${levelId}`);
    }

    state.playerName = playerName || 'Diszpécser';
    state.levelId = tpl.id;
    state.levelName = tpl.name;
    state.running = false;
    state.gameOver = false;
    state.victory = false;
    state.justFinished = false;
    state.gameOverReason = '';
    state.deadlockWarning = false;
    state.stalledTime = 0;
    state.elapsedTime = 0;

    // Pályaelemek másolása a munkaterületre
    state.nodes = JSON.parse(JSON.stringify(tpl.nodes));
    state.edges = JSON.parse(JSON.stringify(tpl.edges));
    state.signals = JSON.parse(JSON.stringify(tpl.signals));
    state.schedule = tpl.schedule.map(item => ({ ...item, spawned: false, done: false }));

    state.stats = {
      arrived: 0,
      errors: 0,
      totalTrains: state.schedule.length
    };
    state.trains = [];
    state.warnings = [];
    state.explosions = [];
    state.logs = [];

    addLog(`${tpl.name} betöltve.`, 'info');
    addLog(`Állítsd be a váltókat/jelzőket, majd kattints a "▶ Forgalom Indítása" gombra!`, 'warn');
  } catch (err) {
    console.error('Hiba a pálya inicializálásakor:', err);
  }
}

/**
 * Kiszámítja egy vonat pontos (x, y) világkoordinátáját és haladási szögét (angle)
 * a kiinduló csomópont (fromNode), a cél csomópont (toNode) és a megtett út aránya (progress: 0..1) alapján.
 */
export function getTrainWorldPosition(train) {
  const nA = state.nodes[train.fromNode];
  const nB = state.nodes[train.toNode];
  if (!nA || !nB) {
    return { x: 0, y: 0, angle: 0 };
  }
  const x = nA.x + (nB.x - nA.x) * train.progress;
  const y = nA.y + (nB.y - nA.y) * train.progress;
  const angle = Math.atan2(nB.y - nA.y, nB.x - nA.x);
  return { x, y, angle };
}

/**
 * Meghatározza, hogy amikor egy vonat elér egy csomópontot (currentNodeId) az előző pontból (previousNodeId),
 * melyik lesz a következő csomópont (nextNode), vagy kisiklik-e a szerelvény (derailed).
 */
function getNextNode(currentNodeId, previousNodeId) {
  const node = state.nodes[currentNodeId];
  if (!node) return { nextNode: null, derailed: true };

  // Peron vagy belépési pont után nincs tovább vágány
  if (node.type === 'platform' || node.type === 'entry') {
    return { nextNode: null, derailed: false };
  }

  // Összefutó (merge) csomópont mindig a kijelölt 'next' pontra küldi tovább a vonatot
  if (node.type === 'merge') {
    return { nextNode: node.next, derailed: false };
  }

  // Váltó (switch) csomópont vizsgálata
  if (node.type === 'switch') {
    const activeTargetId = node.branches[node.activeBranch];

    // Ellenőrizzük, hogy a vonat a váltó gyökeréből (stem / stems) érkezett-e
    const isFromStem =
      previousNodeId === node.stem ||
      (Array.isArray(node.stems) && node.stems.includes(previousNodeId));

    // Ha a gyökérből érkezett, az éppen aktív váltóágra (activeTargetId) halad tovább
    if (isFromStem) {
      return { nextNode: activeTargetId, derailed: false };
    }

    // Ha visszafelé, valamelyik ágból érkezne: csak akkor nem siklik ki, ha a váltó arra az ágra áll
    if (node.branches.includes(previousNodeId)) {
      if (previousNodeId === activeTargetId) {
        const stemTarget = node.stem || (node.stems && node.stems[0]);
        return { nextNode: stemTarget, derailed: false };
      } else {
        return { nextNode: null, derailed: true };
      }
    }

    return { nextNode: null, derailed: true };
  }

  // Normál csomópont esetén megkeressük a továbbvezető vágányélt
  const outEdge = state.edges.find(e => e.from === currentNodeId && e.to !== previousNodeId);
  if (outEdge) {
    return { nextNode: outEdge.to, derailed: false };
  }

  const anyEdge = state.edges.find(
    e => (e.from === currentNodeId || e.to === currentNodeId) &&
         (e.from === currentNodeId ? e.to : e.from) !== previousNodeId
  );
  if (anyEdge) {
    return { nextNode: anyEdge.from === currentNodeId ? anyEdge.to : anyEdge.from, derailed: false };
  }

  // Ha nincs továbbvezető sín (pl. zsákvágány vége az 1. szinten), a vonat kisiklik!
  return { nextNode: null, derailed: true };
}

// ============================================================================
// FŐ SZIMULÁCIÓS LÉPTETŐ FÜGGVÉNY (updateSimulation)
// ============================================================================

/**
 * Minden képkockában frissíti a játékidőt, indítja a menetrend szerinti vonatokat,
 * mozgatja a szerelvényeket, ellenőrzi a jelzőket, váltókat, peronokat, holtpontot és ütközéseket.
 */
export function updateSimulation(dt) {
  if (!state.running || state.gameOver) return;

  state.elapsedTime += dt;

  // --------------------------------------------------------------------------
  // 1. Menetrend szerinti vonatindítás (Spawn)
  // --------------------------------------------------------------------------
  for (const item of state.schedule) {
    if (!item.spawned && state.elapsedTime >= item.spawnTime) {
      item.spawned = true;
      state.trains.push({
        id: item.id,
        fromNode: item.entryNode,
        toNode: item.nextNode,
        progress: 0.02, // Kis kezdeti előrehaladás a belépési ponttól
        speed: item.speed,
        targetPlatform: item.targetPlatform,
        color: item.color,
        status: 'RUNNING',
        manualStop: false,
        inWarningZone: false
      });
      const entryLabel = state.nodes[item.entryNode]?.label || item.entryNode;
      addLog(`Menetrend: ${item.id} (${item.speed} px/s) belépett itt: ${entryLabel} ➔ Cél: ${item.targetPlatform}.`, 'info');
    }
  }

  // --------------------------------------------------------------------------
  // 2. Pályán lévő szerelvények mozgatása és szabályvizsgálat
  // --------------------------------------------------------------------------
  for (let i = state.trains.length - 1; i >= 0; i--) {
    const train = state.trains[i];
    train.inWarningZone = false;

    if (train.status === 'DERAILED' || train.status === 'COLLIDED') continue;

    // Ha a játékos jobb egérgombbal lefékezte a vonatot, nem mozog tovább
    if (train.manualStop) {
      train.status = 'BRAKED';
      continue;
    }

    const nA = state.nodes[train.fromNode];
    const nB = state.nodes[train.toNode];
    const edgeLength = Math.hypot(nB.x - nA.x, nB.y - nA.y);

    // Kétoptikás fényjelző ellenőrzése az adott vágányszakasz végén
    const signal = state.signals.find(
      s => s.nodeId === train.toNode && s.fromNode === train.fromNode
    );

    // Ha a jelző VÖRÖS (RED) és a vonat elérte a megállási pontot a jelző előtt, megáll
    const stopPoint = Math.max(0.6, 1 - (28 / edgeLength));
    if (signal && signal.state === 'RED' && train.progress >= stopPoint && train.progress < 0.92) {
      if (train.status !== 'WAITING_RED') {
        train.status = 'WAITING_RED';
        addLog(`${train.id} megállt a vörös (${signal.label}) jelző előtt [TILOS].`, 'warn');
      }
      continue;
    } else {
      train.status = 'RUNNING';
    }

    // Vonat előrehaladásának növelése a sebesség, az eltelt idő (dt) és a szakasz hossza alapján
    train.progress += (train.speed * dt) / edgeLength;

    // Ha a vonat elérte a vágányszakasz végét (progress >= 1)
    if (train.progress >= 1) {
      const overshoot = (train.progress - 1) * edgeLength; // Túlhaladás pixelben, hogy ne legyen darabos a mozgás
      const targetNodeObj = state.nodes[train.toNode];

      // A) Ha a vonat egy célállomásra (peronra) érkezett meg:
      if (targetNodeObj.type === 'platform') {
        const schedItem = state.schedule.find(s => s.id === train.id);
        if (schedItem) schedItem.done = true;

        // Ellenőrizzük, hogy a saját (helyes) peronjára futott-e be
        if (train.toNode === train.targetPlatform) {
          state.stats.arrived++;
          addLog(`SIKER: ${train.id} helyesen befutott ide: ${targetNodeObj.label}.`, 'success');
        } else {
          state.stats.errors++;
          addLog(`HIBA (Téves célállomás): ${train.id} a ${train.targetPlatform} helyett a ${train.toNode} peronra futott be! (+1 hiba)`, 'alert');
        }
        // Eltávolítjuk a befutott vonatot az aktív vonatok közül
        state.trains.splice(i, 1);
        continue;
      }

      // B) Ha nem peronra érkezett, lekérdezzük a következő csomópontot (vagy kisiklást)
      const { nextNode, derailed } = getNextNode(train.toNode, train.fromNode);
      if (derailed || !nextNode) {
        train.progress = 1;
        train.status = 'DERAILED';
        state.stats.errors++;
        const schedItem = state.schedule.find(s => s.id === train.id);
        if (schedItem) schedItem.done = true;
        addLog(`KISIKLÁS: ${train.id} kisiklott a(z) ${targetNodeObj.label || train.toNode} váltónál/vágányvégnél! (+1 hiba)`, 'alert');
        state.trains.splice(i, 1);
        continue;
      }

      // C) Átlépés a következő vágányszakaszra a túlhaladás (overshoot) figyelembevételével
      const nextNodeObj = state.nodes[nextNode];
      const nextLen = Math.hypot(nextNodeObj.x - nB.x, nextNodeObj.y - nB.y);
      train.fromNode = train.toNode;
      train.toNode = nextNode;
      train.progress = nextLen > 0 ? overshoot / nextLen : 0;
    }
  }

  // --------------------------------------------------------------------------
  // 3. Holtpont (Deadlock) detektálása
  // Ha legalább 2 vonat van a pályán és mindegyik 5 másodperce áll, figyelmeztetést adunk.
  // --------------------------------------------------------------------------
  const allStopped =
    state.trains.length >= 2 &&
    state.trains.every(t => t.status === 'WAITING_RED' || t.status === 'BRAKED');

  if (allStopped) {
    state.stalledTime += dt;
    if (state.stalledTime >= DEADLOCK_GRACE_SECONDS && !state.deadlockWarning) {
      state.deadlockWarning = true;
      addLog('⚠️ HOLTPONT (DEADLOCK) VESZÉLY: Minden pályán lévő szerelvény áll! Oldd fel a jelzőket vagy a vészféket!', 'warn');
    }
  } else {
    state.stalledTime = 0;
    state.deadlockWarning = false;
  }

  // --------------------------------------------------------------------------
  // 4. Ütközésveszély (75 px) és Katasztrófa / Ütközés (28 px) vizsgálata minden vonatpárra
  // --------------------------------------------------------------------------
  state.warnings = [];
  for (let i = 0; i < state.trains.length; i++) {
    for (let j = i + 1; j < state.trains.length; j++) {
      const t1 = state.trains[i];
      const t2 = state.trains[j];
      const p1 = getTrainWorldPosition(t1);
      const p2 = getTrainWorldPosition(t2);
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

      // Ha a két vonat távolsága kisebb, mint 28 px -> Azonnali robbanás és Game Over!
      if (dist < COLLISION_DISTANCE) {
        t1.status = 'COLLIDED';
        t2.status = 'COLLIDED';
        state.stats.errors++;
        state.explosions.push({
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2
        });
        state.running = false;
        state.gameOver = true;
        state.victory = false;
        state.gameOverReason = `KATASZTRÓFA (GAME OVER)! ${t1.id} és ${t2.id} összeütközött és megsemmisült!`;
        addLog(state.gameOverReason, 'alert');
        return;
      } else if (dist < WARNING_DISTANCE) {
        // Ha 75 px-en belül vannak -> Ütközésveszély zóna rögzítése a kirajzoláshoz
        t1.inWarningZone = true;
        t2.inWarningZone = true;
        state.warnings.push({
          x1: p1.x, y1: p1.y,
          x2: p2.x, y2: p2.y,
          midX: (p1.x + p2.x) / 2,
          midY: (p1.y + p2.y) / 2,
          dist
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Sikeres teljesítés (Győzelem) vizsgálata
  // Ha már minden menetrend szerinti vonat elindult, és egy sincs már a pályán (mind célba ért/lefutott)
  // --------------------------------------------------------------------------
  const allSpawned = state.schedule.every(s => s.spawned);
  if (allSpawned && state.trains.length === 0 && !state.gameOver) {
    state.running = false;
    state.gameOver = true;
    state.victory = true;
    state.justFinished = true; // Jelzés az app.js-nek, hogy mentse el az eredményt a ranglistára
    const finalTimeStr = formatTime(state.elapsedTime);
    state.gameOverReason = `Műszak sikeresen teljesítve! Végső menetidő: ${finalTimeStr} | Helyes befutás: ${state.stats.arrived}/${state.stats.totalTrains} | Hibapontok: ${state.stats.errors}`;
    addLog(state.gameOverReason, 'success');
  }
}

// ============================================================================
// MENTÉS ÉS BETÖLTÉS ADATSZERKEZETÉNEK KEZELÉSE
// ============================================================================

/**
 * Összeállít egy JSON-ba menthető pillanatképet (snapshot) az aktuális játékállásról.
 */
export function createSaveSnapshot() {
  return {
    playerName: state.playerName,
    levelId: state.levelId,
    elapsedTime: state.elapsedTime,
    // Váltók aktuális állása
    switches: Object.values(state.nodes)
      .filter(n => n.type === 'switch')
      .map(n => ({ id: n.id, activeBranch: n.activeBranch })),
    // Fényjelzők aktuális állása (RED / GREEN)
    signals: state.signals.map(s => ({ id: s.id, state: s.state })),
    // Pályán lévő vonatok összes adata
    trains: state.trains.map(t => {
      const pos = getTrainWorldPosition(t);
      return {
        id: t.id,
        fromNode: t.fromNode,
        toNode: t.toNode,
        progress: t.progress,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        angle: pos.angle,
        speed: t.speed,
        targetPlatform: t.targetPlatform,
        color: t.color,
        status: t.status,
        manualStop: Boolean(t.manualStop)
      };
    }),
    // Menetrend állapota (melyik vonat indult már el / futott be)
    schedule: state.schedule,
    // Statisztikai számlálók
    stats: {
      arrived: state.stats.arrived,
      errors: state.stats.errors,
      totalTrains: state.stats.totalTrains
    }
  };
}

/**
 * Szigorúan ellenőrzi a localStorage-ból betöltött mentési adatokat.
 * Ha bármilyen sérült vagy manipulált adatot talál, hibát dob, mielőtt a state módosulna.
 */
function validateSnapshot(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Sérült vagy hiányos mentési adatszerkezet!');
  }
  const tpl = LEVELS[data.levelId];
  if (!tpl) {
    throw new Error('A mentés ismeretlen pályaazonosítót tartalmaz!');
  }
  if (!Array.isArray(data.trains) || !Array.isArray(data.schedule)) {
    throw new Error('A mentésből hiányzik a vonatok vagy a menetrend listája!');
  }

  const isCount = v => Number.isInteger(v) && v >= 0;
  if (!data.stats || !isCount(data.stats.arrived) || !isCount(data.stats.errors) ||
      data.stats.arrived > tpl.schedule.length) {
    throw new Error('A mentés számlálói érvénytelenek!');
  }

  const elapsed = Number(data.elapsedTime);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new Error('A mentés játékideje érvénytelen!');
  }

  // Vonatok egyenkénti ellenőrzése a pálya topológiájával szemben
  const trains = data.trains.map(t => {
    const item = t && tpl.schedule.find(s => s.id === t.id);
    if (!item) throw new Error('A mentés ismeretlen szerelvényt tartalmaz!');

    const edgeExists = tpl.edges.some(e => e.from === t.fromNode && e.to === t.toNode);
    if (!edgeExists) {
      throw new Error(`A(z) ${t.id} szerelvény helyzete nem létező vágányszakaszra mutat!`);
    }
    const target = tpl.nodes[t.targetPlatform];
    if (!target || target.type !== 'platform') {
      throw new Error(`A(z) ${t.id} szerelvény célállomása érvénytelen!`);
    }
    const progress = Number(t.progress);
    const speed = Number(t.speed);
    if (!Number.isFinite(progress) || progress < 0 || progress >= 1) {
      throw new Error(`A(z) ${t.id} szerelvény pozíciója érvénytelen!`);
    }
    if (!Number.isFinite(speed) || speed < 20 || speed > 300) {
      throw new Error(`A(z) ${t.id} szerelvény sebessége érvénytelen!`);
    }

    const manualStop = Boolean(t.manualStop);
    return {
      id: t.id,
      fromNode: t.fromNode,
      toNode: t.toNode,
      progress,
      speed,
      targetPlatform: t.targetPlatform,
      color: item.color, // A színt mindig a hiteles sablonból vesszük
      status: manualStop ? 'BRAKED' : 'RUNNING',
      manualStop,
      inWarningZone: false
    };
  });

  const flags = tpl.schedule.map(item => {
    const saved = data.schedule.find(s => s && s.id === item.id) || {};
    return { id: item.id, spawned: Boolean(saved.spawned), done: Boolean(saved.done) };
  });

  // Már befejezett futam nem tölthető vissza
  if (flags.every(f => f.spawned) && trains.length === 0) {
    throw new Error('A mentett futam már befejeződött, nem tölthető vissza!');
  }

  return { tpl, elapsed, trains, flags };
}

/**
 * Validálja és visszaállítja a mentett játékállást a központi state objektumba.
 */
export function applySavedSnapshot(data) {
  const { tpl, elapsed, trains, flags } = validateSnapshot(data);

  const rawName = typeof data.playerName === 'string' ? data.playerName.trim().slice(0, 28) : '';
  initLevel(tpl.id, rawName || 'Diszpécser');
  state.elapsedTime = elapsed;
  state.stats.arrived = data.stats.arrived;
  state.stats.errors = data.stats.errors;

  // Váltók állásának visszaállítása
  if (Array.isArray(data.switches)) {
    data.switches.forEach(sw => {
      const node = sw && state.nodes[sw.id];
      if (node && node.type === 'switch') {
        const idx = Number(sw.activeBranch);
        node.activeBranch = Number.isInteger(idx) && idx >= 0 && idx < node.branches.length ? idx : 0;
      }
    });
  }

  // Fényjelzők állásának visszaállítása
  if (Array.isArray(data.signals)) {
    data.signals.forEach(sig => {
      const target = sig && state.signals.find(s => s.id === sig.id);
      if (target) target.state = sig.state === 'RED' ? 'RED' : 'GREEN';
    });
  }

  // Menetrendi jelzők (spawned, done) visszaállítása
  state.schedule.forEach(item => {
    const f = flags.find(x => x.id === item.id);
    if (f) {
      item.spawned = f.spawned;
      item.done = f.done;
    }
  });

  // Vonatok elhelyezése a pályán, szüneteltetett állapotban (hogy a játékos felkészülhessen a folytatásra)
  state.trains = trains;
  state.running = false;
  state.gameOver = false;
  addLog(`Mentett állás visszatöltve (${state.playerName}, ${formatTime(state.elapsedTime)}). Kattints a Folytatásra!`, 'info');
}