const state = {
  raw: null,
  files: [],
  currentFolder: "",
};

const searchInput = document.getElementById("searchInput");
const domainFilter = document.getElementById("domainFilter");
const extFilter = document.getElementById("extFilter");
const sortSelect = document.getElementById("sortSelect");
const stats = document.getElementById("stats");
const fileGrid = document.getElementById("fileGrid");
const folderTree = document.getElementById("folderTree");
const collapseAllBtn = document.getElementById("collapseAllBtn");
const previewDialog = document.getElementById("previewDialog");
const previewTitle = document.getElementById("previewTitle");
const previewMeta = document.getElementById("previewMeta");
const previewBody = document.getElementById("previewBody");
const githubLink = document.getElementById("githubLink");
const closePreviewBtn = document.getElementById("closePreviewBtn");

const REPO_URL = "https://github.com/Demonda64/THEORIE_DE_LA_RESONANCE_MULTIVERSIELLE/blob/main/";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof text === "string") node.textContent = text;
  return node;
}

function buildTree(paths) {
  const root = {};
  for (const path of paths) {
    const parts = path.split("/");
    let cursor = root;
    for (const part of parts) {
      cursor[part] = cursor[part] || {};
      cursor = cursor[part];
    }
  }
  return root;
}

function renderTreeNode(name, value, prefix = "") {
  const full = prefix ? `${prefix}/${name}` : name;
  const children = Object.keys(value).sort((a, b) => a.localeCompare(b));

  if (!children.length) {
    const leaf = el("div", "folder-leaf", name);
    leaf.dataset.folder = full;
    leaf.onclick = () => {
      state.currentFolder = full;
      refresh();
    };
    return leaf;
  }

  const details = document.createElement("details");
  details.open = prefix === "";
  const summary = el("summary", "", name);
  summary.dataset.folder = full;
  summary.onclick = (event) => {
    event.preventDefault();
    state.currentFolder = full;
    details.open = !details.open;
    refresh();
  };
  details.appendChild(summary);

  for (const child of children) {
    details.appendChild(renderTreeNode(child, value[child], full));
  }
  return details;
}

function populateFilters() {
  const domains = [...new Set(state.files.map((f) => f.topLevel).filter(Boolean))].sort();
  const exts = [...new Set(state.files.map((f) => f.ext).filter(Boolean))].sort();

  for (const d of domains) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    domainFilter.appendChild(opt);
  }

  for (const ext of exts) {
    const opt = document.createElement("option");
    opt.value = ext;
    opt.textContent = ext;
    extFilter.appendChild(opt);
  }
}

function getVisibleFiles() {
  const query = searchInput.value.trim().toLowerCase();
  const domain = domainFilter.value;
  const ext = extFilter.value;
  const sort = sortSelect.value;

  let rows = state.files.filter((f) => {
    if (domain && f.topLevel !== domain) return false;
    if (ext && f.ext !== ext) return false;
    if (state.currentFolder && !f.path.startsWith(`${state.currentFolder}/`) && f.path !== state.currentFolder) return false;

    if (!query) return true;
    return [f.path, f.name, f.topLevel, f.excerpt].join(" ").toLowerCase().includes(query);
  });

  if (sort === "size") {
    rows.sort((a, b) => b.size - a.size);
  } else if (sort === "recent") {
    rows.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  } else {
    rows.sort((a, b) => a.path.localeCompare(b.path));
  }

  return rows;
}

function renderStats(visible) {
  stats.innerHTML = "";
  const items = [
    `Fichiers visibles: ${visible.length}`,
    `Total fichiers: ${state.files.length}`,
    `Dossiers: ${state.raw.summary.folderCount}`,
    `Generation: ${new Date(state.raw.generatedAt).toLocaleString("fr-FR")}`,
  ];

  for (const text of items) {
    const pill = el("span", "stat-pill", text);
    stats.appendChild(pill);
  }
}

function openPreview(file) {
  previewTitle.textContent = file.name;
  previewMeta.textContent = `${file.path} | ${file.ext || "sans extension"} | ${formatSize(file.size)} | modifie le ${new Date(file.modified).toLocaleString("fr-FR")}`;
  previewBody.textContent = file.excerpt || "Aucun extrait disponible pour ce type de fichier.";
  githubLink.href = `${REPO_URL}${file.path}`;
  previewDialog.showModal();
}

function renderFiles(visible) {
  fileGrid.innerHTML = "";
  if (!visible.length) {
    fileGrid.appendChild(el("p", "muted", "Aucun resultat. Ajuste les filtres ou la recherche."));
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const file of visible) {
    const card = el("article", "card");
    card.appendChild(el("h3", "", file.name));
    card.appendChild(el("p", "path", file.path));

    const meta = el("div", "meta-row");
    meta.appendChild(el("span", "tag", file.ext || "none"));
    meta.appendChild(el("span", "tag", file.topLevel || "root"));
    meta.appendChild(el("span", "tag", formatSize(file.size)));
    card.appendChild(meta);

    card.appendChild(el("p", "excerpt", file.excerpt || "Pas d extrait texte."));

    const actions = el("div", "actions");
    const modified = el("small", "muted", new Date(file.modified).toLocaleDateString("fr-FR"));
    const btn = document.createElement("button");
    btn.textContent = "Apercu";
    btn.onclick = () => openPreview(file);
    actions.appendChild(modified);
    actions.appendChild(btn);
    card.appendChild(actions);

    fragment.appendChild(card);
  }
  fileGrid.appendChild(fragment);
}

function highlightTreeSelection() {
  const nodes = folderTree.querySelectorAll("[data-folder]");
  for (const node of nodes) {
    node.classList.toggle("active", node.dataset.folder === state.currentFolder);
  }
}

function refresh() {
  const visible = getVisibleFiles();
  renderStats(visible);
  renderFiles(visible);
  highlightTreeSelection();
}

function bindControls() {
  searchInput.addEventListener("input", refresh);
  domainFilter.addEventListener("change", refresh);
  extFilter.addEventListener("change", refresh);
  sortSelect.addEventListener("change", refresh);

  collapseAllBtn.addEventListener("click", () => {
    folderTree.querySelectorAll("details").forEach((d) => {
      d.open = false;
    });
  });

  closePreviewBtn.addEventListener("click", () => previewDialog.close());

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });
}

async function init() {
  const response = await fetch("tree.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Impossible de charger tree.json");
  }

  state.raw = await response.json();
  state.files = state.raw.files || [];

  const tree = buildTree(state.raw.folders || []);
  const roots = Object.keys(tree).sort((a, b) => a.localeCompare(b));
  for (const root of roots) {
    folderTree.appendChild(renderTreeNode(root, tree[root]));
  }

  populateFilters();
  bindControls();
  refresh();
}

init().catch((error) => {
  fileGrid.innerHTML = "";
  fileGrid.appendChild(el("p", "muted", `Erreur de chargement: ${error.message}`));
});
