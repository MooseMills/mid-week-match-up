const CSV_PATH = "./results.csv";

let rawRows = [];
let currentView = "Team";    
let currentSort = "points";
let searchTerm = "";

document.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  rawRows = await loadCsv(CSV_PATH);
  render();
});

async function loadCsv(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

function wireUI() {
  const viewSelect = document.getElementById("viewSelect");
  const sortSelect = document.getElementById("sortSelect");
  const searchInput = document.getElementById("searchInput");

  if (viewSelect) {
    viewSelect.addEventListener("change", (e) => {
      currentView = e.target.value;
      render();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = (e.target.value || "").toLowerCase();
      render();
    });
  }
}


// Minimal CSV parser that handles commas and quotes reasonably well
function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] ?? "").trim());
    rows.push(obj);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') { // escaped quote
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function buildStandings(rows, groupKey) {
  const map = new Map();

  for (const r of rows) {
    const name = (r[groupKey] || "").trim();
    if (!name) continue;

    const placement = Number(r.Placement);
    const points = Number(r.Points) || 0;

    if (!map.has(name)) {
      map.set(name, { name, gold: 0, silver: 0, bronze: 0, points: 0, podiums: 0 });
    }

    const s = map.get(name);

    if (placement === 1) s.gold += 1;
    if (placement === 2) s.silver += 1;
    if (placement === 3) s.bronze += 1;
    if ([1, 2, 3].includes(placement)) s.podiums += 1;

    s.points += points;
  }

  const arr = Array.from(map.values());

  arr.sort((a, b) => {
  if (currentSort === "podiums") {
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return b.points - a.points; // tie-breaker
  }

  // default: points
  return b.points - a.points;
});


  return arr;
}

function render() {
  const standings = buildStandings(rawRows, currentView);

  const filtered = searchTerm
    ? standings.filter(s => s.name.toLowerCase().includes(searchTerm))
    : standings;

  // Title + meta
  document.getElementById("tableTitle").textContent =
    `${currentView} Medal Table`;

  renderPodium(filtered.slice(0, 3));
  renderTable(filtered);
}

function renderPodium(top3) {
  const podiumEl = document.getElementById("podium");
  podiumEl.innerHTML = "";

  // Order visually: 2nd, 1st, 3rd
  const slots = [
    { idx: 1, className: "second", medal: "🥈", badge: "silver", label: "2nd" },
    { idx: 0, className: "first",  medal: "🥇", badge: "gold",   label: "1st" },
    { idx: 2, className: "third",  medal: "🥉", badge: "bronze", label: "3rd" },
  ];

  for (const slot of slots) {
    const item = top3[slot.idx];
    const card = document.createElement("div");
    card.className = `podiumCard ${slot.className}`;

    if (!item) {
      card.innerHTML = `
        <div class="podiumTop">
          <span class="badge ${slot.badge}">${slot.medal} ${slot.label}</span>
        </div>
        <div class="podiumName">—</div>
        <div class="podiumStats">
          <span class="statPill">🥇 0</span>
          <span class="statPill">🥈 0</span>
          <span class="statPill">🥉 0</span>
          <span class="statPill">⭐ 0</span>
        </div>
        <div class="podiumBase"></div>
      `;
      podiumEl.appendChild(card);
      continue;
    }

    card.innerHTML = `
      <div class="podiumTop">
        <span class="badge ${slot.badge}">${slot.medal} ${slot.label}</span>
        <span class="statPill">⭐ <b>${item.points}</b></span>
      </div>
      <div class="podiumName">${escapeHtml(item.name)}</div>
      <div class="podiumStats">
        <span class="statPill">🥇 ${item.gold}</span>
        <span class="statPill">🥈 ${item.silver}</span>
        <span class="statPill">🥉 ${item.bronze}</span>
        <span class="statPill">🏆 ${item.podiums} Medals</span>
      </div>
      <div class="podiumBase"></div>
    `;
    podiumEl.appendChild(card);
  }
  
  playPodiumSequence(top3);
}

function renderTable(items) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  items.forEach((s, i) => {
    const tr = document.createElement("tr");
    
    if (i === 0) tr.classList.add("rank-1");
  if (i === 1) tr.classList.add("rank-2");
  if (i === 2) tr.classList.add("rank-3");

    const medal =
  i === 0 ? "🥇 " :
  i === 1 ? "🥈 " :
  i === 2 ? "🥉 " : "";

    tr.innerHTML = `
      <td class="rankCol">${i + 1}</td>
      <td>
  <b class="nameCell">
    ${escapeHtml(s.name)}
    ${medal ? `<span class="medalIcon">${medal}</span>` : ""}
  </b>
</td>
      <td>${s.gold}</td>
      <td>${s.silver}</td>
      <td>${s.bronze}</td>
      <td>${s.podiums}</td>
      <td class="pointsCol">${s.points}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let lastPodiumKey = "";

function playPodiumSequence(top3) {
  const podiumEl = document.getElementById("podium");
  if (!podiumEl) return;

  const cards = Array.from(podiumEl.querySelectorAll(".podiumCard"));
  if (cards.length !== 3) return;

  // Map cards by placement (your DOM order is 2nd, 1st, 3rd)
  const first  = cards.find(c => c.classList.contains("first"));
  const second = cards.find(c => c.classList.contains("second"));
  const third  = cards.find(c => c.classList.contains("third"));

  // Slide up order requested: 3rd -> 2nd -> 1st
  const slideOrder = [third, second, first].filter(Boolean);

  const slideStep = 500;     // ms between podium rises
  const slideDur  = 720;     // must match CSS animation duration

  // Reset state (so replay works)
  cards.forEach((c) => {
    c.classList.remove("is-in");
    c.style.animationDelay = "0ms";

    const name = c.querySelector(".podiumName");
    if (name) {
      name.classList.remove("is-in");
      name.style.animationDelay = "0ms";
    }
  });

  // 1) Podiums rise: 3rd, 2nd, 1st
  slideOrder.forEach((card, i) => {
    card.style.animationDelay = `${i * slideStep}ms`;
    // force reflow so delay applies reliably
    void card.offsetHeight;
    card.classList.add("is-in");
  });

  // 2) Names spin in after all podiums are in place, still 3rd -> 2nd -> 1st
  const namesStart = (slideOrder.length - 1) * slideStep + slideDur + 280;

  slideOrder.forEach((card, i) => {
    const name = card.querySelector(".podiumName");
    if (!name) return;
    name.style.animationDelay = `${namesStart + i * 720}ms`;
    void name.offsetHeight;
    name.classList.add("is-in");
  });

  // 3) Confetti after names finish
  const confettiAt = namesStart + (slideOrder.length - 1) * 720 + 1000;
  window.setTimeout(() => fireConfetti(900), confettiAt);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setupConfettiCanvas() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
  return { canvas, ctx };
}

let confettiCtx = null;

function fireConfetti(count = 700) {
  if (!confettiCtx) confettiCtx = setupConfettiCanvas();
  if (!confettiCtx) return;

  const { canvas, ctx } = confettiCtx;

  const colors = [
    cssVar("--navy") || "#002955",
    cssVar("--blue") || "#0060C6",
    cssVar("--green") || "#00AB63"
  ];

  const W = window.innerWidth;
  const H = window.innerHeight;

  const pieces = Array.from({ length: count }, () => {
    const x = W * 0.5 + (Math.random() - 0.5) * 420;
    const y = H * 0.25 + (Math.random() - 0.5) * 60;
    const size = 6 + Math.random() * 9;
    const vx = (Math.random() - 0.5) * 22;
    const vy = -7 - Math.random() * 12;
    const spin = (Math.random() - 0.5) * 0.25;
    return {
      x, y, size,
      vx, vy,
      g: 0.18 + Math.random() * 0.10,
      r: Math.random() * Math.PI,
      spin,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      ttl: 140 + Math.random() * 40
    };
  });

  let rafId = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of pieces) {
      p.life += 1;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.spin;

      // slight drift / air resistance
      p.vx *= 0.992;

      const alpha = Math.max(0, 1 - p.life / p.ttl);
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    // stop when most are done
    const alive = pieces.some(p => p.life < p.ttl);
    if (alive) rafId = requestAnimationFrame(tick);
    else cancelAnimationFrame(rafId);
  };

  tick();
}
