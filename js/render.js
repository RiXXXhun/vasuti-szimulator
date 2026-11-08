// ============================================================================
// IMPORTÁLÁSOK A STATE.JS MODULBÓL
// ============================================================================
import {
  getTrainWorldPosition, // Vonat aktuális X, Y koordinátájának és szögének lekérése
  WARNING_DISTANCE,      // Ütközésveszély zóna távolsága (75 px) a figyelmeztető kör rajzolásához
  formatTime             // Időformázó segédfüggvény ("PP:MM")
} from './state.js';

// A Canvas rajzoláshoz használt központi színpaletta
const COLORS = {
  bgPrimary: '#161C27',   // Csomópontok és jelzők belső sötét háttere
  bgSecondary: '#1c2331', // A Canvas alap háttérszíne
  accent: '#2877B0',      // Kiemelő kék szín (aktív váltóág, keretek)
  railBase: '#475569',    // Vasúti sínszál alapszíne
  sleeper: '#253044',     // Talpfák színe a sín alatt
  text: '#e2e8f0',        // Feliratok színe
  red: '#ef4444',         // Tilos jelzés, ütközés, robbanás színe
  yellow: '#eab308',      // Figyelmeztetés, kézi vészfék színe
  green: '#22c55e'        // Szabad jelzés színe
};

// ============================================================================
// BIZTONSÁGI ÉS TELJESÍTMÉNYOPTIMALIZÁLÓ SEGÉDFÜGGVÉNYEK
// ============================================================================

/**
 * HTML-escape függvény: megakadályozza az XSS (Cross-Site Scripting) támadásokat.
 * A játékosnév vagy localStorage-ból érkező szöveg speciális karaktereit ártalmatlanítja,
 * mielőtt bekerülnének az innerHTML-be.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Teljesítményoptimalizáló DOM-frissítő:
 * WeakMap-ben eltárolja egy DOM-elem utolsó HTML-tartalmát, és csak akkor írja felül
 * az innerHTML-t, ha a szöveg ténylegesen megváltozott. Így nem ugrik el a görgetősáv!
 */
const lastHtml = new WeakMap();
function setHtmlIfChanged(el, html) {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}

// Engedélyezett CSS osztálynevek a naplóbejegyzések színezéséhez
const LOG_TYPES = ['info', 'warn', 'alert', 'success'];

// ============================================================================
// 1. CANVAS 2D KIRAJZOLÁSA AZ ÁLLAPOTTÉR ALAPJÁN (renderScene)
// ============================================================================

/**
 * Minden képkockában újrarajzolja a teljes vasúti pályát, jelzőket, vonatokat és effekteket.
 */
export function renderScene(ctx, state, nowMs = performance.now()) {
  const { width, height } = ctx.canvas;

  // 1. Háttér kitöltése és négyzetháló (grid) megrajzolása
  ctx.fillStyle = COLORS.bgSecondary;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  // 2. Vasúti vágányszakaszok (sínek és talpfák) megrajzolása az élek (edges) alapján
  state.edges.forEach(edge => {
    const nA = state.nodes[edge.from];
    const nB = state.nodes[edge.to];
    drawTrack(ctx, nA, nB);
  });

  // 3. A váltók (switch) éppen aktív kimeneti ágának kék színű kiemelése
  Object.values(state.nodes)
    .filter(n => n.type === 'switch')
    .forEach(sw => {
      const targetId = sw.branches[sw.activeBranch];
      const targetNode = state.nodes[targetId];
      if (targetNode) {
        drawActiveSwitchIndicator(ctx, sw, targetNode);
      }
    });

  // 4. Csomópontok (belépési pontok, váltók, peronok, normál pontok) kirajzolása
  Object.values(state.nodes).forEach(node => {
    drawNode(ctx, node);
  });

  // 5. Kétoptikás fényjelzők (J1–J5) kirajzolása
  state.signals.forEach(sig => {
    drawSignal(ctx, sig, state.nodes[sig.nodeId]);
  });

  // 6. Ütközésveszély (75 px-en belüli vonatok) pulzáló figyelmeztető zónáinak kirajzolása
  state.warnings.forEach(warn => {
    drawWarningZone(ctx, warn, nowMs);
  });

  // 7. Pályán lévő (még fel nem robbant) vonatok kirajzolása
  state.trains
    .filter(train => train.status !== 'COLLIDED')
    .forEach(train => {
      drawTrain(ctx, train, nowMs);
    });

  // 8. Robbanáseffektek (💥) kirajzolása ütközés helyszínén
  state.explosions.forEach(exp => {
    drawExplosion(ctx, exp);
  });

  // 9. Ha a szimuláció szünetel (és még nincs vége), információs sáv rajzolása a pálya tetejére
  if (!state.running && !state.gameOver) {
    const boxW = 680;
    ctx.save();
    ctx.fillStyle = 'rgba(22, 28, 39, 0.92)';
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect((width - boxW) / 2, 12, boxW, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ A SZIMULÁCIÓ ÁLL — Állítsd be a váltókat, majd kattints a "▶ Forgalom Indítása" gombra!', width / 2, 35);
    ctx.restore();
  }
}

// ============================================================================
// 2. HUD, MENETREND, NAPLÓ ÉS MODÁLIS KÁRTYA FRISSÍTÉSE (renderHUD)
// ============================================================================

/**
 * Frissíti az index.html-ben található szöveges kijelzőket, gombócímkéket és listákat.
 */
export function renderHUD(uiRefs, state) {
  // Felső sáv alapadatainak frissítése
  uiRefs.uiPlayer.textContent = state.playerName || '-';
  uiRefs.uiLevel.textContent = state.levelName || `${state.levelId}. szint`;
  uiRefs.uiTimer.textContent = formatTime(state.elapsedTime);
  uiRefs.uiArrived.textContent = `${state.stats.arrived} / ${state.stats.totalTrains}`;
  uiRefs.uiErrors.textContent = String(state.stats.errors);

  // Státusz szöveg meghatározása az aktuális játékállapot alapján
  if (state.gameOver) {
    uiRefs.uiStatus.textContent = 'VÉGE';
  } else if (state.deadlockWarning) {
    uiRefs.uiStatus.textContent = '⚠️ HOLTPONT!';
  } else if (state.running) {
    uiRefs.uiStatus.textContent = 'FUT';
  } else if (state.elapsedTime === 0) {
    uiRefs.uiStatus.textContent = 'FELKÉSZÜLÉS';
  } else {
    uiRefs.uiStatus.textContent = 'SZÜNET';
  }

  // Az Indítás / Szüneteltetés / Folytatás gomb feliratának dinamikus frissítése
  if (uiRefs.pauseBtn) {
    if (!state.running && state.elapsedTime === 0) {
      uiRefs.pauseBtn.textContent = '▶ Forgalom Indítása';
    } else if (state.running) {
      uiRefs.pauseBtn.textContent = '⏸ Szüneteltetés';
    } else {
      uiRefs.pauseBtn.textContent = '▶ Folytatás';
    }
  }

  // Menetrend lista (#schedule-list) HTML-jének összeállítása és frissítése
  const scheduleHtml = state.schedule
    .map(item => {
      // Állapotjelző: Befutott, Pályán van, vagy még várakozik a belépésre
      const stateLabel = item.done
        ? '✅ Befutott'
        : item.spawned
        ? '🚆 Pályán'
        : `⏳ ${escapeHtml(item.spawnTime)} mp`;
      return `
        <div class="sched-item">
          <span>
            <span class="sched-badge" data-color="${escapeHtml(item.color)}"></span>
            <strong>${escapeHtml(item.id)}</strong> (${escapeHtml(item.entryNode)} ➔ ${escapeHtml(item.targetPlatform)}) <small class="sched-speed">${escapeHtml(item.speed)}px/s</small>
          </span>
          <span>${stateLabel}</span>
        </div>
      `;
    })
    .join('');
  setHtmlIfChanged(uiRefs.scheduleList, scheduleHtml);

  // Valós idejű eseménynapló (#event-log) HTML-jének összeállítása és frissítése
  const logHtml = state.logs
    .map(entry => {
      const type = LOG_TYPES.includes(entry.type) ? entry.type : 'normal';
      return `<div class="log-entry ${type}">[${escapeHtml(entry.time)}] ${escapeHtml(entry.message)}</div>`;
    })
    .join('');
  setHtmlIfChanged(uiRefs.logContainer, logHtml);

  // Futam végi modális ablak (#game-banner) megjelenítése vagy elrejtése
  if (state.gameOver) {
    uiRefs.gameBanner.classList.remove('hidden');
    uiRefs.bannerTitle.textContent = state.victory ? '🏆 Sikeres Műszak!' : '💥 Vasúti Katasztrófa (Game Over)!';
    uiRefs.bannerTitle.classList.toggle('victory', state.victory);
    uiRefs.bannerTitle.classList.toggle('defeat', !state.victory);
    uiRefs.bannerDesc.textContent = state.gameOverReason;
  } else {
    uiRefs.gameBanner.classList.add('hidden');
  }
}

// ============================================================================
// 3. RANGLISTA TÁBLÁZAT RENDERELÉSE (renderLeaderboardTable)
// ============================================================================

/**
 * Kirendereli a kiválasztott szint TOP 10-es ranglistáját a főmenü táblázatába.
 */
export function renderLeaderboardTable(tbodyEl, list) {
  // Ha még nincs egyetlen eredmény sem az adott szinten
  if (!Array.isArray(list) || list.length === 0) {
    setHtmlIfChanged(
      tbodyEl,
      `<tr><td colspan="5" class="lb-empty">Még nincs rögzített eredmény ezen a szinten.</td></tr>`
    );
    return;
  }

  // Eredménysorok összeállítása
  const html = list
    .map((item, idx) => {
      const errors = Number(item.errors) || 0;
      return `
      <tr>
        <td>${idx + 1}.</td>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(item.timeFormatted)}</td>
        <td class="lb-errors ${errors === 0 ? 'zero' : 'some'}">${errors}</td>
        <td>${escapeHtml(item.date)}</td>
      </tr>
    `;
    })
    .join('');
  setHtmlIfChanged(tbodyEl, html);
}

// ============================================================================
// CANVAS RAJZOLÓ SEGÉDFÜGGVÉNYEK (Rács, Sín, Váltó, Csomópont, Jelző, Vonat)
// ============================================================================

/**
 * Halvány négyzethálót rajzol a Canvas hátterére (30 képpontos lépésközzel).
 */
function drawGrid(ctx, width, height) {
  ctx.strokeStyle = '#222b3c';
  ctx.lineWidth = 1;
  const step = 30;
  ctx.beginPath();
  for (let x = 0; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

/**
 * Megrajzol egy vágányszakaszt két csomópont (nA és nB) között talpfákkal és sínszállal.
 */
function drawTrack(ctx, nA, nB) {
  const dx = nB.x - nA.x;
  const dy = nB.y - nA.y;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  // Keresztirányú talpfák rajzolása forgatott koordináta-rendszerben
  ctx.save();
  ctx.translate(nA.x, nA.y);
  ctx.rotate(angle);
  ctx.strokeStyle = COLORS.sleeper;
  ctx.lineWidth = 3;
  for (let d = 10; d < len; d += 14) {
    ctx.beginPath();
    ctx.moveTo(d, -7);
    ctx.lineTo(d, 7);
    ctx.stroke();
  }
  ctx.restore();

  // Fő sínszál megrajzolása
  ctx.beginPath();
  ctx.moveTo(nA.x, nA.y);
  ctx.lineTo(nB.x, nB.y);
  ctx.strokeStyle = COLORS.railBase;
  ctx.lineWidth = 5;
  ctx.stroke();
}

/**
 * Kék színnel kiemeli a váltóból (swNode) induló, jelenleg kiválasztott irányt (targetNode felé).
 */
function drawActiveSwitchIndicator(ctx, swNode, targetNode) {
  const angle = Math.atan2(targetNode.y - swNode.y, targetNode.x - swNode.x);
  const indicatorLen = 48;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(swNode.x, swNode.y);
  ctx.lineTo(
    swNode.x + Math.cos(angle) * indicatorLen,
    swNode.y + Math.sin(angle) * indicatorLen
  );
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
}

/**
 * Megrajzol egy csomópontot a típusának megfelelően:
 * - 'entry': Belépési pont (téglalap bal oldalon)
 * - 'switch': Váltó (kattintható kör V1-V4 felirattal)
 * - 'platform': Célállomás / Peron (színes keretes téglalap jobb oldalon)
 * - 'normal' / 'merge': Egyszerű vágánycsatlakozási pont (kis szürke kör)
 */
function drawNode(ctx, node) {
  ctx.save();
  if (node.type === 'entry') {
    // Belépési pont rajzolása
    ctx.fillStyle = COLORS.bgPrimary;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(node.x - 32, node.y - 16, 64, 32, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(`${node.id} ▶`, node.x, node.y + 4);

    if (node.label) {
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 11px Segoe UI';
      ctx.fillText(node.label, node.x, node.y - 22);
    }
  } else if (node.type === 'switch') {
    // Kattintható váltó kör rajzolása
    ctx.beginPath();
    ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bgPrimary;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.accent;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + 4);
  } else if (node.type === 'platform') {
    // Célállomás (peron) rajzolása a saját színével
    ctx.fillStyle = COLORS.bgPrimary;
    ctx.strokeStyle = node.platformColor || COLORS.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(node.x - 30, node.y - 17, 60, 34, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = node.platformColor || '#ffffff';
    ctx.font = 'bold 12px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(node.id, node.x, node.y + 4);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px Segoe UI';
    ctx.fillText(node.label, node.x, node.y - 23);
  } else {
    // Normál vagy összefutó (merge) csomópont rajzolása
    ctx.beginPath();
    ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    if (node.label) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y - 12);
    }
  }
  ctx.restore();
}

/**
 * Megrajzol egy kétoptikás (Vörös / Zöld) fényjelzőt és a szaggatott vonalat a védett csomóponthoz.
 */
function drawSignal(ctx, sig, targetNode) {
  ctx.save();
  // Szaggatott összekötő vonal a jelző és a hozzá tartozó vágánypont között
  if (targetNode) {
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(sig.x, sig.y);
    ctx.lineTo(targetNode.x, targetNode.y);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Jelzőház (lekerekített téglalap)
  const boxW = 20;
  const boxH = 38;
  ctx.fillStyle = COLORS.bgPrimary;
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(sig.x - boxW / 2, sig.y - boxH / 2, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  // Felső lámpa: Vörös optika (világít, ha sig.state === 'RED')
  ctx.beginPath();
  ctx.arc(sig.x, sig.y - 8, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = sig.state === 'RED' ? COLORS.red : '#3b191e';
  ctx.fill();

  // Alsó lámpa: Zöld optika (világít, ha sig.state === 'GREEN')
  ctx.beginPath();
  ctx.arc(sig.x, sig.y + 8, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = sig.state === 'GREEN' ? COLORS.green : '#133824';
  ctx.fill();

  // Jelző felirata (pl. "J1 (Bejárat)")
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(sig.label, sig.x, sig.y + 30);
  ctx.restore();
}

/**
 * Pulzáló sárga/piros figyelmeztető kört rajzol két veszélyesen közel (75 px-en belül) lévő vonat közé.
 */
function drawWarningZone(ctx, warn, nowMs) {
  const pulse = Math.sin(nowMs / 120) * 5;
  const isCritical = warn.dist < 48;
  const strokeColor = isCritical ? COLORS.red : COLORS.yellow;

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);

  ctx.beginPath();
  ctx.arc(warn.midX, warn.midY, (WARNING_DISTANCE / 2) + pulse, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = strokeColor;
  ctx.font = 'bold 11px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('⚠️ ÜTKÖZÉSVESZÉLY!', warn.midX, warn.midY - (WARNING_DISTANCE / 2) - 8);
  ctx.restore();
}

/**
 * Megrajzol egy szerelvényt (vonatot) a vágány irányába forgatva, fényszóróval,
 * felette a nevével és célállomásával (pl. "Vonat 1 ➔ P1"), alatta pedig az esetleges
 * "⛔ TILOS" vagy "🛑 STOP (FÉK)" állapottal.
 */
function drawTrain(ctx, train, nowMs) {
  const { x, y, angle } = getTrainWorldPosition(train);

  // Ha a vonat ütközésveszély zónában van, sárga szaggatott burok pulzál körülötte
  if (train.inWarningZone) {
    const r = 24 + Math.sin(nowMs / 100) * 3;
    ctx.save();
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Vonattest megrajzolása a haladási szögbe forgatva
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = train.color;
  // Keretszín: vörös jelzőnél piros, kézi féknél sárga, normál haladásnál fehér
  if (train.status === 'WAITING_RED') {
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 3.5;
  } else if (train.manualStop) {
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 3.5;
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
  }

  ctx.beginPath();
  ctx.roundRect(-20, -10, 40, 20, 4);
  ctx.fill();
  ctx.stroke();

  // Első sárga fényszóró a mozdony elején
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(15, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Vonat felirata (nem forog el a vonattal, hogy mindig vízszintesen olvasható maradjon)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(`${train.id} ➔ ${train.targetPlatform}`, x, y - 16);

  // Vörös jelző előtti várakozás vagy kézi vészfék felirata a vonat alatt
  if (train.status === 'WAITING_RED') {
    ctx.fillStyle = COLORS.red;
    ctx.font = 'bold 11px Segoe UI';
    ctx.fillText('⛔ TILOS', x, y + 24);
  } else if (train.manualStop) {
    ctx.fillStyle = COLORS.yellow;
    ctx.font = 'bold 11px Segoe UI';
    ctx.fillText('🛑 STOP (FÉK)', x, y + 24);
  }
  ctx.restore();
}

/**
 * Robbanási ikont és piros kört rajzol két vonat összeütközésének helyszínére.
 */
function drawExplosion(ctx, exp) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(exp.x, exp.y, 32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.red;
  ctx.stroke();

  ctx.font = '28px Segoe UI Emoji, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💥', exp.x, exp.y);
  ctx.restore();
}