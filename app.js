const CSV_PATH = "./results.csv";

let rawRows = [];
let currentView = "Team";     // or "Teammate"
let currentSort = "olympics"; // or "points"
let searchTerm = "";

document.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  rawRows = await loadCsv(CSV_PATH);
  render();
});

function wireUI() {
  const viewSelect = document.getElementById("viewSelect");
  const sortSelect = document.getElementById("sortSelect");
  const searchInput = document.getElementById("searchInput");

  viewSelect.addEventListener("change", (e) => {
    currentView = e.target.value;
    render();
  });

  sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    render();
  });

  searchInput.addEventListener("input", (e) => {
    searchTerm = (e.target.value || "").toLowerCase();
    render();
  });
}

async function loadCsv(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
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
    if (currentSort === "points") return b.points - a.points;

    // Olympics-first sorting
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    if (b.bronze !== a.bronze) return b.bronze - a.bronze;
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

  const totalEntries = filtered.length;
  const totalEvents = rawRows.length;
  document.getElementById("meta").textContent =
    `${totalEntries} ${currentView.toLowerCase()} • ${totalEvents} placements loaded`;

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
        <span class="statPill">🏁 ${item.podiums} podiums</span>
      </div>
      <div class="podiumBase"></div>
    `;
    podiumEl.appendChild(card);
  }
}

function renderTable(items) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  items.forEach((s, i) => {
    const tr = document.createElement("tr");
    if (i === 0) tr.classList.add("rowGlow");

    tr.innerHTML = `
      <td class="rankCol">${i + 1}</td>
      <td><b>${escapeHtml(s.name)}</b></td>
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

