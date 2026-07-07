const state = {
  files: [],
  query: "",
  folder: "",
  ext: "",
  sort: "name",
};

const textExts = new Set([
  ".md", ".txt", ".json", ".yml", ".yaml", ".csv", ".html", ".css", ".js", ".xml", ".ps1",
]);

const els = {
  globalSearch: document.getElementById("globalSearch"),
  connectFolderBtn: document.getElementById("connectFolderBtn"),
  folderInput: document.getElementById("folderInput"),
  focusFeedBtn: document.getElementById("focusFeedBtn"),
  domainMenu: document.getElementById("domainMenu"),
  statsLine: document.getElementById("statsLine"),
  extFilter: document.getElementById("extFilter"),
  sortMode: document.getElementById("sortMode"),
  clearBtn: document.getElementById("clearBtn"),
  feedList: document.getElementById("feedList"),
  trendList: document.getElementById("trendList"),
  suggestList: document.getElementById("suggestList"),
  feedArea: document.getElementById("feedArea"),
  previewDialog: document.getElementById("previewDialog"),
  previewTitle: document.getElementById("previewTitle"),
  previewMeta: document.getElementById("previewMeta"),
  previewBody: document.getElementById("previewBody"),
  closePreviewBtn: document.getElementById("closePreviewBtn"),
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileToRecord(file, pathOverride = "") {
  const rel = (pathOverride || file.webkitRelativePath || file.name).replaceAll("\\", "/");
  const parts = rel.split("/");
  const name = parts[parts.length - 1];
  const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "Racine";
  const ext = name.includes(".") ? `.${name.split(".").pop().toLowerCase()}` : "";

  return {
    id: crypto.randomUUID(),
    file,
    name,
    path: rel,
    folder,
    ext,
    size: file.size || 0,
    modified: file.lastModified || Date.now(),
  };
}

async function loadFromPicker() {
  if (!window.showDirectoryPicker) {
    els.folderInput.click();
    return;
  }

  const dir = await window.showDirectoryPicker();
  const out = [];

  async function walk(handle, prefix = "") {
    for await (const [name, child] of handle.entries()) {
      if (child.kind === "file") {
        const f = await child.getFile();
        out.push(fileToRecord(f, prefix ? `${prefix}/${name}` : name));
      } else if (child.kind === "directory") {
        await walk(child, prefix ? `${prefix}/${name}` : name);
      }
    }
  }

  await walk(dir);
  state.files = out;
  state.folder = "";
  state.ext = "";
  state.sort = "name";
  render();
}

function loadFromInput(fileList) {
  const rows = Array.from(fileList || []).map((f) => fileToRecord(f));
  state.files = rows;
  state.folder = "";
  state.ext = "";
  state.sort = "name";
  render();
}

function renderFolderMenu(visibleFolders) {
  const items = ["", ...visibleFolders];
  els.domainMenu.innerHTML = "";

  for (const folder of items) {
    const btn = document.createElement("button");
    btn.textContent = folder || "Tous les dossiers";
    btn.className = state.folder === folder ? "active" : "";
    btn.onclick = () => {
      state.folder = folder;
      render();
    };
    els.domainMenu.appendChild(btn);
  }
}

function renderExtFilter(exts) {
  const keep = els.extFilter.value;
  els.extFilter.innerHTML = "<option value=''>Toutes extensions</option>";
  for (const ext of exts) {
    const opt = document.createElement("option");
    opt.value = ext;
    opt.textContent = ext;
    els.extFilter.appendChild(opt);
  }
  if ([...exts].includes(keep)) {
    els.extFilter.value = keep;
  } else {
    els.extFilter.value = "";
    state.ext = "";
  }
}

function computeVisible() {
  const q = state.query.trim().toLowerCase();
  let rows = state.files.filter((r) => {
    if (state.folder && r.folder !== state.folder) return false;
    if (state.ext && r.ext !== state.ext) return false;
    if (!q) return true;
    return [r.name, r.path, r.folder, r.ext].join(" ").toLowerCase().includes(q);
  });

  rows.sort((a, b) => {
    if (state.sort === "recent") return b.modified - a.modified;
    if (state.sort === "size") return b.size - a.size;
    return a.path.localeCompare(b.path);
  });

  return rows;
}

function renderStats(rows) {
  const total = rows.reduce((acc, r) => acc + r.size, 0);
  els.statsLine.textContent = `${rows.length} fichiers visibles - ${formatSize(total)}`;
}

function renderTrends() {
  const map = new Map();
  for (const r of state.files) {
    const key = r.ext || "(sans ext)";
    map.set(key, (map.get(key) || 0) + 1);
  }

  const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  els.trendList.innerHTML = "";
  for (const [ext, count] of top) {
    const row = document.createElement("div");
    row.className = "trend";
    row.textContent = `${ext} - ${count}`;
    els.trendList.appendChild(row);
  }
}

function renderRecent() {
  const recent = [...state.files].sort((a, b) => b.modified - a.modified).slice(0, 6);
  els.suggestList.innerHTML = "";
  for (const r of recent) {
    const row = document.createElement("div");
    row.className = "suggest";
    row.innerHTML = `<div>${r.name}</div><small>${new Date(r.modified).toLocaleString("fr-FR")}</small>`;
    els.suggestList.appendChild(row);
  }
}

function openFile(record) {
  const url = URL.createObjectURL(record.file);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 7000);
}

function downloadFile(record) {
  const url = URL.createObjectURL(record.file);
  const a = document.createElement("a");
  a.href = url;
  a.download = record.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 7000);
}

async function previewFile(record) {
  els.previewTitle.textContent = record.name;
  els.previewMeta.textContent = `${record.path} | ${record.ext || "sans extension"} | ${formatSize(record.size)} | ${new Date(record.modified).toLocaleString("fr-FR")}`;

  if (textExts.has(record.ext)) {
    const txt = await record.file.text();
    els.previewBody.textContent = txt.slice(0, 20000);
  } else {
    els.previewBody.textContent = "Apercu indisponible pour ce type de fichier. Utilise Ouvrir ou Telecharger.";
  }

  els.previewDialog.showModal();
}

function createFileCard(record) {
  const article = document.createElement("article");
  article.className = "post file-card card";
  article.innerHTML = `
    <div class="post-head">
      <div>
        <h3>${record.name}</h3>
        <div class="post-meta">${record.path}</div>
      </div>
      <span class="badge">${record.ext || "none"}</span>
    </div>
    <p>Dossier: ${record.folder} | Taille: ${formatSize(record.size)} | Modifie: ${new Date(record.modified).toLocaleString("fr-FR")}</p>
    <div class="post-actions">
      <button class="react-btn" data-action="open" data-id="${record.id}">Ouvrir</button>
      <button class="react-btn" data-action="preview" data-id="${record.id}">Apercu</button>
      <button class="react-btn" data-action="download" data-id="${record.id}">Telecharger</button>
    </div>
  `;
  return article;
}

function renderFeed(rows) {
  els.feedList.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("article");
    empty.className = "card post";
    empty.innerHTML = "<h3>Aucun fichier visible</h3><p>Connecte un dossier local puis ajuste les filtres.</p>";
    els.feedList.appendChild(empty);
    return;
  }

  for (const r of rows) {
    els.feedList.appendChild(createFileCard(r));
  }
}

function render() {
  const folders = [...new Set(state.files.map((r) => r.folder))].sort((a, b) => a.localeCompare(b));
  const exts = [...new Set(state.files.map((r) => r.ext).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  renderFolderMenu(folders);
  renderExtFilter(exts);

  const rows = computeVisible();
  renderStats(rows);
  renderFeed(rows);
  renderTrends();
  renderRecent();
}

document.addEventListener("click", async (event) => {
  const btn = event.target.closest(".react-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const rec = state.files.find((f) => f.id === id);
  if (!rec) return;

  if (action === "open") openFile(rec);
  if (action === "download") downloadFile(rec);
  if (action === "preview") await previewFile(rec);
});

els.connectFolderBtn.addEventListener("click", async () => {
  try {
    await loadFromPicker();
  } catch (err) {
    if (err && err.name !== "AbortError") {
      alert("Impossible de connecter le dossier. Essaie le fallback via selection de fichiers.");
      els.folderInput.click();
    }
  }
});

els.folderInput.addEventListener("change", (event) => {
  loadFromInput(event.target.files);
});

els.globalSearch.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.extFilter.addEventListener("change", (event) => {
  state.ext = event.target.value;
  render();
});

els.sortMode.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

els.clearBtn.addEventListener("click", () => {
  state.files = [];
  state.folder = "";
  state.ext = "";
  state.query = "";
  els.globalSearch.value = "";
  render();
});

els.focusFeedBtn.addEventListener("click", () => {
  els.feedArea.scrollIntoView({ behavior: "smooth", block: "start" });
});

els.closePreviewBtn.addEventListener("click", () => {
  els.previewDialog.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/") {
    event.preventDefault();
    els.globalSearch.focus();
  }
});

render();
