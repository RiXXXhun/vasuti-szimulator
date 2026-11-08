// ============================================================================
// IMPORTÁLÁSOK A TÖBBI MODULBÓL
// ============================================================================
// Állapotkezelő és szimulációs függvények importálása a state.js modulból
import {
  state,                  // A játék központi állapotobjektuma
  initLevel,              // Pálya alaphelyzetbe állítása / betöltése
  updateSimulation,       // Fizika, vonatmozgás és szabályok frissítése minden képkockában
  createSaveSnapshot,     // Mentendő objektum összeállítása a jelenlegi állapotból
  applySavedSnapshot,     // Mentett állapot validálása és visszatöltése a state-be
  getTrainWorldPosition,  // Egy vonat pontos (x, y, szög) koordinátájának kiszámítása a Canvas-on
  formatTime,             // Másodpercek átalakítása "PP:MM" formátumra
  addLog                  // Új üzenet beszúrása a valós idejű eseménynaplóba
} from './state.js';

// Megjelenítő (kirajzoló és DOM-frissítő) függvények importálása a render.js modulból
import {
  renderScene,            // A teljes 2D vasúti pálya és vonatok kirajzolása a Canvas-ra
  renderHUD,              // A felső információs sáv, menetrend és napló HTML-jének frissítése
  renderLeaderboardTable  // A főmenüben lévő ranglista táblázat sorainak kirenderelése
} from './render.js';

// ============================================================================
// KONSTANSOK ÉS LOCALSTORAGE KULCSOK
// ============================================================================
// Kulcs az aktuális félbehagyott játékállás mentéséhez a böngésző localStorage-ában
const SAVE_STORAGE_KEY = 'railway_sim_save_v2';
// Kulcs a helyi dicsőségkönyv (ranglista) mentéséhez a localStorage-ban
const LEADERBOARD_STORAGE_KEY = 'railway_sim_leaderboard_v2';

// ============================================================================
// DOM ELEMEK LEKÉRÉSE (Az index.html-ben definiált elemek összekötése a kóddal)
// ============================================================================
// A játéktér Canvas elemének lekérése és ellenőrzése
const canvas = document.querySelector('#sim-canvas');
if (!canvas) {
  throw new Error('Kritikus hiba: A #sim-canvas elem nem található a DOM-ban!');
}
// 2D rajzolási kontextus lekérése (ezzel rajzol a renderScene függvény)
const ctx = canvas.getContext('2d');

// Főmenü (kezdőképernyő) DOM elemei
const startOverlay = document.querySelector('#start-overlay');       // A teljes főmenü takarórétege
const playerNameInput = document.querySelector('#player-name-input'); // Játékosnév szövegdoboz
const levelSelect = document.querySelector('#level-select');         // Pályaválasztó legördülő lista
const formError = document.querySelector('#form-error');             // Hibaüzenet sáv a főmenüben
const leaderboardBody = document.querySelector('#leaderboard-body'); // Ranglista táblázat <tbody> eleme
const lbTabs = document.querySelectorAll('.lb-tab');                 // Ranglista szintválasztó fül-gombok

// A játék közbeni HUD és oldalsáv DOM-referenciái egyetlen objektumba csomagolva a renderHUD számára
const uiRefs = {
  uiPlayer: document.querySelector('#ui-player'),                               // Játékos neve a felső sávban
  uiLevel: document.querySelector('#ui-level'),                                 // Pálya neve a felső sávban
  uiTimer: document.querySelector('#ui-timer'),                                 // Időmérő óra a felső sávban
  uiArrived: document.querySelector('#ui-arrived'),                             // Befutott vonatok számlálója
  uiErrors: document.querySelector('#ui-errors'),                               // Hibaszámláló a felső sávban
  uiStatus: document.querySelector('#ui-status'),                               // Státusz szöveg (FUT, SZÜNET stb.)
  pauseBtn: document.querySelector('button[data-action="toggle-pause"]'),       // Indítás / Szüneteltetés gomb
  scheduleList: document.querySelector('#schedule-list'),                       // Menetrend lista konténere
  logContainer: document.querySelector('#event-log'),                           // Eseménynapló konténere
  gameBanner: document.querySelector('#game-banner'),                           // Futam végi modális kártya
  bannerTitle: document.querySelector('#banner-title'),                         // Futam végi kártya főcíme
  bannerDesc: document.querySelector('#banner-desc')                            // Futam végi kártya leírása
};

// Segédváltozók a vezérléshez
let selectedLbLevel = 1; // Melyik szint ranglistáját nézi épp a játékos a főmenüben (alapból az 1-est)
let loopFaulted = false; // Jelzi, ha a játékhurokban váratlan hiba történt (hogy ne írja ki másodpercenként 60-szor)

// ============================================================================
// MENTÉS, BETÖLTÉS ÉS RANGLISTA KEZELÉSE (localStorage)
// ============================================================================

/**
 * Elmenti az aktuális játékállást a böngésző localStorage-ába.
 * A state.js createSaveSnapshot() függvényét használja az adatok összegyűjtéséhez.
 */
function saveGameToStorage() {
  // Ha már vége a játéknak (győzelem vagy ütközés), nem engedjük elmenteni
  if (state.gameOver) {
    addLog('A befejezett futam nem menthető. Indíts új játékot vagy újraindítást!', 'warn');
    return;
  }
  try {
    // Pillanatkép készítése a state-ből és JSON szöveggé alakítása
    const payload = createSaveSnapshot();
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    addLog('Játékállás sikeresen elmentve a localStorage-ba.', 'info');
  } catch (err) {
    addLog(`Mentési hiba: ${err.message}`, 'alert');
  }
}

/**
 * Betölti a korábban elmentett játékállást a localStorage-ból.
 * Sikeres betöltéskor true-val, hiba esetén false-szal tér vissza.
 */
function loadGameFromStorage() {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      throw new Error('Nem található mentett játékállás a helyi tárhelyen!');
    }
    // JSON visszaalakítása objektummá és érvényesítése a state.js-ben
    const parsed = JSON.parse(raw);
    applySavedSnapshot(parsed);
    return true;
  } catch (err) {
    addLog(`Betöltési hiba: ${err.message}`, 'alert');
    return false;
  }
}

/**
 * Kiolvassa az összes szint ranglistáját a localStorage-ból.
 * Ha még nincs mentett ranglista, üres tömbökkel tér vissza mindhárom szintre.
 */
function getLeaderboardsFromStorage() {
  const defaultLb = { 1: [], 2: [], 3: [] };
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return defaultLb;
    return { ...defaultLb, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Ranglista olvasási hiba:', err);
    return defaultLb;
  }
}

/**
 * Új győzelmi eredményt rögzít a megfelelő szint ranglistájába.
 * Sorbarendezi a listát (kevesebb hiba, majd gyorsabb idő szerint), és megtartja a TOP 10-et.
 */
function recordLeaderboardEntry(levelId, playerName, elapsedSeconds, errors) {
  try {
    const lbs = getLeaderboardsFromStorage();
    const list = Array.isArray(lbs[levelId]) ? lbs[levelId] : [];

    // Új eredmény objektum hozzáadása
    list.push({
      name: playerName || 'Névtelen',
      timeSeconds: Math.floor(elapsedSeconds),
      timeFormatted: formatTime(elapsedSeconds),
      errors: errors,
      date: new Date().toLocaleDateString('hu-HU')
    });

    // Rendezés: 1. szempont: kevesebb hiba, 2. szempont: rövidebb menetidő
    list.sort((a, b) => {
      if (a.errors !== b.errors) return a.errors - b.errors;
      return a.timeSeconds - b.timeSeconds;
    });

    // Csak a legjobb 10 eredményt tároljuk szintenként
    lbs[levelId] = list.slice(0, 10);
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(lbs));
  } catch (err) {
    console.error('Ranglista mentési hiba:', err);
  }
}

/**
 * Frissíti a főmenüben látható ranglista táblázatot a kiválasztott szint alapján.
 */
function refreshLeaderboardUI(levelId) {
  const lbs = getLeaderboardsFromStorage();
  renderLeaderboardTable(leaderboardBody, lbs[levelId] || []);
}

// ============================================================================
// ALKALMAZÁS KEZDETI INICIALIZÁLÁSA BETÖLTÉSKOR
// ============================================================================
initLevel(1, 'Vendég');                 // 1-es pálya betöltése a háttérben alapértelmezettként
refreshLeaderboardUI(selectedLbLevel);  // 1-es szint ranglistájának megjelenítése a főmenüben
renderHUD(uiRefs, state);               // HUD elemek szinkronizálása a kezdeti állapottal

// ============================================================================
// ESEMÉNYKEZELŐK (FÜLEK, BILLENTYŰZET, GOMBOK ÉS CANVAS INTERAKCIÓK)
// ============================================================================

// Ranglista szintválasztó fülek (1. Szint, 2. Szint, 3. Szint) kattintáskezelése
lbTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Levesszük az 'active' osztályt az összes fülről, és rátesszük a most kattintottra
    lbTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    // Kiolvassuk a data-lb-level attribútumból a szint számát és frissítjük a táblázatot
    selectedLbLevel = Number(tab.dataset.lbLevel) || 1;
    refreshLeaderboardUI(selectedLbLevel);
  });
});

/**
 * Elindítja, szünetelteti vagy folytatja a szimulációt.
 */
function toggleSimulationRunning() {
  // Ha vége a játéknak, vagy még nyitva van a főmenü, nem csinál semmit
  if (state.gameOver || !startOverlay.classList.contains('hidden')) return;
  
  // Állapot megfordítása (fut <-> áll)
  state.running = !state.running;
  
  // Naplóüzenet küldése az állapotváltozásról
  if (state.running && state.elapsedTime === 0) {
    addLog('Forgalom és időmérés elindítva!', 'success');
  } else {
    addLog(state.running ? 'Szimuláció folytatva.' : 'Szimuláció szüneteltetve (időmérés áll).', 'info');
  }
  renderHUD(uiRefs, state);
}

// Space (Szóköz) gyorsbillentyű figyelése a szüneteltetéshez / folytatáshoz
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && startOverlay.classList.contains('hidden')) {
    event.preventDefault(); // Megakadályozza, hogy a Space lenyomása görgesse az oldalt vagy megnyomjon egy fókuszált gombot
    toggleSimulationRunning();
  }
});

// Központi eseménydelegálás az összes olyan gombra, amelynek van 'data-action' attribútuma
document.body.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return; // Ha nem ilyen gombra kattintottak, kilépünk

  const action = btn.dataset.action;

  switch (action) {
    // 1. Új játék indítása a főmenüből
    case 'start-new-game': {
      try {
        const name = playerNameInput.value.trim();
        // Kötelező legalább 2 karakteres nevet megadni
        if (name.length < 2) {
          throw new Error('A játékosnévnek legalább 2 karakter hosszúnak kell lennie!');
        }
        formError.classList.add('hidden');
        const chosenLevel = Number(levelSelect.value) || 1;
        // Pálya felépítése a választott szinttel és játékosnévvel
        initLevel(chosenLevel, name);
        loopFaulted = false;
        // Főmenü elrejtése, játék megjelenítése
        startOverlay.classList.add('hidden');
        renderHUD(uiRefs, state);
      } catch (validationErr) {
        // Hiba esetén megjelenítjük a piros hibaüzenetet az input alatt
        formError.textContent = validationErr.message;
        formError.classList.remove('hidden');
        playerNameInput.focus();
      }
      break;
    }

    // 2. Mentett állás betöltése közvetlenül a főmenüből
    case 'load-saved-from-menu': {
      const loaded = loadGameFromStorage();
      if (loaded) {
        loopFaulted = false;
        playerNameInput.value = state.playerName;
        levelSelect.value = String(state.levelId);
        startOverlay.classList.add('hidden');
        renderHUD(uiRefs, state);
      } else {
        formError.textContent = 'Nem található korábban elmentett játékállás a böngészőben!';
        formError.classList.remove('hidden');
      }
      break;
    }

    // 3. Forgalom indítása / Szüneteltetés / Folytatás gomb az oldalsávban
    case 'toggle-pause': {
      toggleSimulationRunning();
      break;
    }

    // 4. Aktuális pálya újraindítása (Reset) elölről
    case 'restart-level': {
      initLevel(state.levelId, state.playerName || 'Diszpécser');
      loopFaulted = false;
      renderHUD(uiRefs, state);
      break;
    }

    // 5. Visszatérés a főmenübe (megállítja a szimulációt és frissíti a ranglistát)
    case 'open-menu': {
      state.running = false;
      refreshLeaderboardUI(selectedLbLevel);
      startOverlay.classList.remove('hidden');
      renderHUD(uiRefs, state);
      break;
    }

    // 6. Játékállás mentése gomb az oldalsávban
    case 'save-game': {
      saveGameToStorage();
      renderHUD(uiRefs, state);
      break;
    }

    // 7. Mentett állás betöltése gomb az oldalsávban
    case 'load-game': {
      if (loadGameFromStorage()) {
        loopFaulted = false;
      }
      renderHUD(uiRefs, state);
      break;
    }
  }
});

/**
 * Átszámítja az egérkattintás képernyő-koordinátáit a Canvas belső (940x560) koordináta-rendszerére.
 * Erre azért van szükség, mert a Canvas a CSS miatt átméreteződhet a képernyőn.
 */
function getCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

// BAL EGÉRGOMB KATTINTÁS A CANVASON: Váltó (switch) állítása vagy Fényjelző (signal) átkapcsolása
canvas.addEventListener('click', (event) => {
  if (state.gameOver) return;
  const { x: clickX, y: clickY } = getCanvasCoordinates(event);

  // 1. Ellenőrizzük, hogy egy váltóra (switch csomópontra) kattintott-e a játékos (18px sugáron belül)
  for (const node of Object.values(state.nodes)) {
    if (node.type === 'switch') {
      const dist = Math.hypot(clickX - node.x, clickY - node.y);
      if (dist <= 18) {
        // Ciklikusan léptetjük a váltó aktív kimeneti ágát a következőre
        node.activeBranch = (node.activeBranch + 1) % node.branches.length;
        const targetId = node.branches[node.activeBranch];
        addLog(`Váltó (${node.label}) átállítva ➔ ${targetId} vágányágra.`, 'info');
        renderHUD(uiRefs, state);
        return;
      }
    }
  }

  // 2. Ellenőrizzük, hogy egy kétoptikás fényjelzőre kattintott-e a játékos
  for (const sig of state.signals) {
    if (Math.abs(clickX - sig.x) <= 16 && Math.abs(clickY - sig.y) <= 24) {
      // Átkapcsolás ZÖLD (GREEN) és VÖRÖS (RED) állapot között
      sig.state = sig.state === 'GREEN' ? 'RED' : 'GREEN';
      const labelState = sig.state === 'GREEN' ? 'Zöld (Szabad az út!)' : 'Vörös (Megállj!)';
      addLog(`Jelző (${sig.label}) kapcsolva: ${labelState}`, 'info');
      renderHUD(uiRefs, state);
      return;
    }
  }
});

// JOBB EGÉRGOMB KATTINTÁS A CANVASON: Vonat kézi vészfékezése ("STOP / FÉK") és feloldása
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault(); // Letiltjuk a böngésző alapértelmezett jobbklikkes menüjét a Canvas felett
  if (state.gameOver) return;

  const { x: clickX, y: clickY } = getCanvasCoordinates(event);

  // Megnézzük, hogy valamelyik pályán lévő vonatra kattintott-e a játékos (26px sugáron belül)
  for (const train of state.trains) {
    const pos = getTrainWorldPosition(train);
    const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
    if (dist <= 26) {
      // Kézi fék be- vagy kikapcsolása
      train.manualStop = !train.manualStop;
      if (train.manualStop) {
        train.status = 'BRAKED';
        addLog(`🛑 STOP (FÉK): ${train.id} kézi vészfékezéssel megállítva!`, 'warn');
      } else {
        train.status = 'RUNNING';
        addLog(`▶ FÉK FELOLDVA: ${train.id} folytatja útját.`, 'info');
      }
      renderHUD(uiRefs, state);
      return;
    }
  }
});

// ============================================================================
// 60 FPS ANIMÁCIÓS ÉS SZIMULÁCIÓS JÁTÉKHUROK (Game Loop)
// ============================================================================
let lastTime = performance.now(); // Előző képkocka időbélyege a delta-idő (dt) számításához
let hudSyncTimer = 0;             // Időzítő, hogy a szöveges HUD-ot elég legyen másodpercenként 4-szer frissíteni

/**
 * A fő játékhurok, amelyet a böngésző minden képkockában (kb. 60-szor másodpercenként) meghív.
 */
function gameLoop(now) {
  try {
    // Eltelt idő (dt) másodpercben két képkocka között (maximum 0.1 mp-re korlátozva tab-váltás esetére)
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // 1. Szimuláció fizikai és logikai állapotának léptetése (state.js)
    updateSimulation(dt);

    // 2. Ha a futam ebben a képkockában ért véget győzelemmel, elmentjük az eredményt a ranglistába
    if (state.justFinished) {
      state.justFinished = false;
      if (state.victory) {
        recordLeaderboardEntry(state.levelId, state.playerName, state.elapsedTime, state.stats.errors);
      }
      renderHUD(uiRefs, state);
    }

    // 3. A teljes vasúti pálya és a vonatok kirajzolása a Canvas-ra (render.js)
    renderScene(ctx, state, now);

    // 4. A felső HUD és a listák frissítése 0.25 másodpercenként
    hudSyncTimer += dt;
    if (hudSyncTimer >= 0.25) {
      renderHUD(uiRefs, state);
      hudSyncTimer = 0;
    }
  } catch (err) {
    // Ha bármilyen futásidejű hiba történik, megállítjuk a vonatokat, de az oldal kezelhető marad
    console.error('Játékhurok hiba:', err);
    state.running = false;
    if (!loopFaulted) {
      loopFaulted = true;
      try {
        addLog(`Belső hiba történt, a szimuláció leállt: ${err.message}. Indíts újra vagy tölts be másik állást!`, 'alert');
        renderHUD(uiRefs, state);
      } catch (innerErr) {
        console.error('A hibajelzés is sikertelen:', innerErr);
      }
    }
  }

  // Következő képkocka kérése a böngészőtől
  requestAnimationFrame(gameLoop);
}

// A játékhurok első elindítása
requestAnimationFrame(gameLoop);