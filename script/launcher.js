let GAMES = {};
import * as storage from './storage.js'

function formatRelativeTime(ts) {
  if (!ts) return "never";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// default repo used by the "#folder" shorthand
// basically, if its one of our games on github, use "#"
// if its just one we used from a different repo, do OWNER/REPO@REF/FOLDER
// for example, if there was cookie clicker it would be ck/cookieclicker@master/cookieclicker
const DEFAULT_REPO_OWNER = "appleorangesponegbo";
const DEFAULT_REPO_NAME = "projects";
const DEFAULT_REPO_REF = "22cdfc1";

function resolveGameSource(id) {
  let owner, repo, ref, rest;
  let isSwf = false;

  if (id.startsWith("#")) {
    owner = DEFAULT_REPO_OWNER;
    repo = DEFAULT_REPO_NAME;
    ref = DEFAULT_REPO_REF;
    rest = id.slice(1);
  } else {
    let body = id;
    if (id.startsWith("@")) {
      isSwf = true;
      body = id.slice(1);
    }

    const match = body.match(/^([^/]+)\/([^/@]+)@([^/]+)(?:\/(.+))?$/);
    if (!match) {
      throw new Error(`invalid game id format: "${id}", expected "#[folder/][file.html]", "owner/repo@ref[/folder][/file.html]", or "@owner/repo@ref/folder/file.swf"`);
    }
    [, owner, repo, ref, rest] = match;
  }

  let folder = "";
  let file = "index.html";

  if (isSwf) {
    if (!rest) {
      throw new Error(`invalid game id format: "${id}", "@" syntax requires a path to a .swf file`);
    }
    const lastSlash = rest.lastIndexOf("/");
    const lastSegment = lastSlash === -1 ? rest : rest.slice(lastSlash + 1);
    if (!/\.swf$/i.test(lastSegment)) {
      throw new Error(`invalid game id format: "${id}", "@" syntax expects a path ending in .swf`);
    }
    file = lastSegment;
    folder = lastSlash === -1 ? "" : rest.slice(0, lastSlash);
  } else if (rest) {
    const lastSlash = rest.lastIndexOf("/");
    const lastSegment = lastSlash === -1 ? rest : rest.slice(lastSlash + 1);

    if (/\.html?$/i.test(lastSegment)) {
      file = lastSegment;
      folder = lastSlash === -1 ? "" : rest.slice(0, lastSlash);
    } else {
      folder = rest;
    }
  }

  const folderSegment = folder ? `${folder}/` : "";
  const baseUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${folderSegment}`;

  return { baseUrl, indexUrl: `${baseUrl}${file}`, isSwf };
}

// wraps a .swf url in a minimal page that boots it with ruffle.
// (could swap this for waflash instead if ruffle ever gives us trouble
// with a particular game)
function buildSwfWrapperHtml(swfUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>flash</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
  ruffle-player { width: 100%; height: 100%; display: block; }
</style>
<script src="https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle"></script>
</head>
<body>
<script>
  window.RufflePlayer = window.RufflePlayer || {};
  window.addEventListener("load", () => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.style.width = "100%";
    player.style.height = "100%";
    document.body.appendChild(player);
    const config = {
      scale: "showAll",
      salign: "",
      letterbox: "on",
      forceScale: true,
      forceAlign: true
    };
    player.load({
      url: ${JSON.stringify(swfUrl)},
      ...config
    });
  });
</script>
</body>
</html>`;
}

function createGameButton(game) {
  const btn = document.createElement("button");
  btn.className = "g-launch";
  btn.dataset.g = game.id;
  btn.dataset.n = game.title;

  const img = document.createElement("img");
  img.src = game.image;
  img.width = 120;
  img.alt = game.title;
  btn.appendChild(img);

  const totalMs = storage.getStats(game.id).totalPlayTime || 0;
  if (totalMs > 0) {
    const badge = document.createElement("span");
    badge.className = "g-playtime";
    badge.textContent = formatDuration(totalMs);
    btn.appendChild(badge);
  }

  btn.addEventListener("click", () => openGamePanel(game.id));
  return btn;
}

function updatePlaytimeBadges(id, overrideMs) {
  const ms = overrideMs !== undefined ? overrideMs : (storage.getStats(id).totalPlayTime || 0);
  document.querySelectorAll(".g-launch").forEach((btn) => {
    if (btn.dataset.g !== id) return;
    let badge = btn.querySelector(".g-playtime");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "g-playtime";
      btn.appendChild(badge);
    }
    badge.textContent = formatDuration(ms);
  });
}

function refreshAllPlaytimeBadges() {
  const stats = storage.loadStats();
  Object.keys(stats).forEach((id) => {
    if (stats[id].totalPlayTime > 0) updatePlaytimeBadges(id);
  });
}

async function loadGames() {
  const list = document.getElementById("gameList");
  try {
    const response = await fetch("items.json");
    if (!response.ok) throw new Error(`http error! status: ${response.status}`);
    const games = await response.json();

    var total = 0
    var flash = 0
    var supplied = 0

    games.forEach((game) => {
      total += 1
      GAMES[game.id] = game;

      if (game.id.startsWith('#')) {
        supplied += 1
      } else if (game.id.startsWith('@')) {
        flash += 1
      }

      list.appendChild(createGameButton(game));
    });

    document.getElementById('totalgams').innerText = total;
    document.getElementById('flashgams').innerText = flash;
    document.getElementById('suppliedgams').innerText = supplied;

    refreshAllPlaytimeBadges();
  } catch (error) {
    console.error("error loading games list:", error);
  }
}

function renderFavorites() {
  const container = document.getElementById("favList");
  if (!container) return;
  container.innerHTML = "";

  const favs = storage.loadFavorites();
  const ids = Object.keys(favs).filter((id) => GAMES[id]);

  if (ids.length === 0) {
    container.innerHTML = `<center class="empty-state">no favorites yet. click the ☆ on a game to add one!</center>`;
    return;
  } else {
    container.innerHTML = "<br>";
  }

  ids.forEach((id) => container.appendChild(createGameButton(GAMES[id])));
}

function renderRecent() {
  const container = document.getElementById("recentList");
  if (!container) return;
  container.innerHTML = "";

  const stats = storage.loadStats();
  const ids = Object.keys(stats)
    .filter((id) => GAMES[id] && stats[id].lastPlayed)
    .sort((a, b) => stats[b].lastPlayed - stats[a].lastPlayed);

  if (ids.length === 0) {
    container.innerHTML = `<center class="empty-state">no games played yet. go play something!</center>`;
    return;
  } else {
    container.innerHTML = "<br>";
  }

  ids.forEach((id) => container.appendChild(createGameButton(GAMES[id])));
}

let currentGame = null;

function openGamePanel(name) {
  currentGame = name;
  const data = GAMES[name] || {
    title: name,
    image: "",
    description: "",
    players: "",
  };
  document.getElementById("gamePanelImg").src = data.image;
  document.getElementById("gamePanelName").textContent = data.title;
  document.getElementById("gamePanelDesc").textContent = data.description;
  document.getElementById("gamePanelPlayers").textContent =
    data.players + ` | ` +
    storage.getStats(name).playCount + " plays | last played " +
    formatRelativeTime(storage.getStats(name).lastPlayed);
  document.getElementById("gamePanel").classList.add("active");

  const favBtn = document.getElementById("gamePanelFavorite");
  favBtn.classList.toggle("favorited", storage.isFavorite(name));
  favBtn.textContent = storage.isFavorite(name) ? "★" : "☆";
}

async function prepareGameBlobURL(name) {
    const { baseUrl, indexUrl, isSwf } = resolveGameSource(name);

    if (isSwf) {
        const htmlContent = buildSwfWrapperHtml(indexUrl);
        const blob = new Blob([htmlContent], { type: "text/html" });
        return URL.createObjectURL(blob);
    }

    const response = await fetch(indexUrl);
    if (!response.ok) throw new Error(`http error! status: ${response.status}`);
    let htmlContent = await response.text();

    if (!/^\s*<!doctype/i.test(htmlContent)) {
        htmlContent = "<!DOCTYPE html>\n" + htmlContent;
    }

    // construct 3 patcher
    const mainJsMatch = htmlContent.match(/<script\b(?=[^>]*\bsrc=["']([^"']*\bmain[a-zA-Z0-9_.-]*\.js)["'])[^>]*><\/script>/i);
    if (!mainJsMatch) {
        console.warn(`[${name}] couldn't find a main*.js script tag - not a Construct 3 export, or export format changed`);
    } else {
        const mainJsUrl = new URL(mainJsMatch[1], baseUrl).toString();
        const mainJsResp = await fetch(mainJsUrl);
        if (!mainJsResp.ok) {
            console.warn(`[${name}] fetching ${mainJsUrl} failed with status ${mainJsResp.status}`);
        } else {
            let mainJsText = await mainJsResp.text();

            if (!/\bnew RuntimeInterface\(\{/.test(mainJsText)) {
                console.warn(`[${name}] ${mainJsUrl} doesn't look like a Construct 3 runtime - skipping C3 patching`);
            } else {
                let patched = mainJsText;

                const scriptFolderMatch = mainJsText.match(/scriptFolder\s*:\s*["']([^"']*)["']/);
                const scriptsFolder = scriptFolderMatch ? scriptFolderMatch[1] : "scripts/";
                const scriptsBaseUrl = new URL(scriptsFolder, baseUrl).toString();
                patched = patched.split("document.currentScript.src").join(JSON.stringify(scriptsBaseUrl));

                const originlessBase = JSON.stringify(baseUrl.replace(/\/$/, ""));
                const beforeLocationPatch = patched;
                patched = patched.split("location.origin").join(originlessBase);
                patched = patched.split("location.pathname").join('"/"');
                if (patched === beforeLocationPatch) {
                    console.warn(`[${name}] main.js doesn't reference location.origin/pathname, export format may have changed`);
                }

                const beforeBaseUrlInject = patched;
                patched = patched.replace(
                    /new RuntimeInterface\(\{/,
                    `new RuntimeInterface({baseUrl:${JSON.stringify(baseUrl)},`
                );
                if (patched === beforeBaseUrlInject) {
                    console.warn(`[${name}] couldn't find a \`new RuntimeInterface({\` call to inject baseUrl into, export format may have changed`);
                }

                htmlContent = htmlContent.replace(mainJsMatch[0], `<script>${patched}</script>`);
            }
        }
    }

    htmlContent = htmlContent.replace(
        /<head(\s[^>]*)?>/i,
        (match) => `${match}
    <script>
    (function() {
      const REAL_BASE_URL = ${JSON.stringify(baseUrl)};

      const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: true,
        get: desc.get,
        set: function(value) {
          if (!this.crossOrigin) this.crossOrigin = 'anonymous';
          desc.set.call(this, value);
        }
      });

      const OrigURL = window.URL;
      function PatchedURL(url, base) {
        try { return new OrigURL(url, base); }
        catch (err) { return new OrigURL(url, REAL_BASE_URL); }
      }
      PatchedURL.prototype = OrigURL.prototype;
      PatchedURL.createObjectURL = OrigURL.createObjectURL.bind(OrigURL);
      PatchedURL.revokeObjectURL = OrigURL.revokeObjectURL.bind(OrigURL);
      window.URL = PatchedURL;
    })();
    </script>
    <base href="${baseUrl}">`
    );

    const blob = new Blob([htmlContent], { type: "text/html" });
    return URL.createObjectURL(blob);
}

let currentGameBlobURL = null;

async function playFullscreen(name) {
    const newWindow = window.open("about:blank", "_blank");
    if (!newWindow) {
        alert("you needa allow popups for this to work. thanks.");
        return;
    }
    try {
        const blobUrl = await prepareGameBlobURL(name);
        newWindow.location.href = blobUrl;
        newWindow.addEventListener("load", () => URL.revokeObjectURL(blobUrl), { once: true });
    } catch (error) {
        console.error("error launching game:", error);
        newWindow.close();
        alert("could not load game. check console for details.");
    }
}

let sessionGame = null;
let sessionStart = null;
let sessionInterval = null;

function updateSessionDisplay() {
  if (!sessionGame || !sessionStart) return;
  const elapsed = Date.now() - sessionStart;
  const baseTotal = storage.getStats(sessionGame).totalPlayTime || 0;

  const sessionEl = document.getElementById("gdSessionTime");
  const totalEl = document.getElementById("gdTotalTime");
  if (sessionEl) sessionEl.textContent = `session: ${formatDuration(elapsed)}`;
  if (totalEl) totalEl.textContent = `total: ${formatDuration(baseTotal + elapsed)}`;

  updatePlaytimeBadges(sessionGame, baseTotal + elapsed);
}

function startSession(name) {
  sessionGame = name;
  sessionStart = Date.now();
  updateSessionDisplay();
  sessionInterval = setInterval(updateSessionDisplay, 1000);
}

function endSession() {
  if (sessionGame && sessionStart) {
    const elapsed = Date.now() - sessionStart;
    storage.addPlayTime(sessionGame, elapsed);
    updatePlaytimeBadges(sessionGame);
    refreshAllPlaytimeBadges();
    renderRecent();
  }
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = null;
  sessionGame = null;
  sessionStart = null;
}

window.addEventListener("beforeunload", () => {
  if (sessionGame && sessionStart) {
    storage.addPlayTime(sessionGame, Date.now() - sessionStart);
  }
});

async function playGame(name) {
    try {
        const data = GAMES[name] || { title: name, image: "" };
        document.getElementById("gdIcon").src = data.image;
        document.getElementById("gdName").textContent = data.title;

        const statsBefore = storage.getStats(name);
        document.getElementById("gdLastPlayed").textContent =
            `last played ${formatRelativeTime(statsBefore.lastPlayed)}`;

        if (currentGameBlobURL) URL.revokeObjectURL(currentGameBlobURL);
        currentGameBlobURL = await prepareGameBlobURL(name);
        document.getElementById("gameFrame").src = currentGameBlobURL;
        document.getElementById("gameDialog").classList.add("active");

        const { playCount } = storage.recordPlay(name);
        document.getElementById("gdPlayCount").textContent =
            `played ${playCount} time${playCount === 1 ? "" : "s"}`;
        renderRecent();

        if (sessionGame !== name) {
            endSession();
            startSession(name);
        }

        const favBtn = document.getElementById("gdFavoriteBtn");
        const favorited = storage.isFavorite(name);
        favBtn.classList.toggle("favorited", favorited);
        favBtn.textContent = favorited ? "★" : "☆";
    } catch (error) {
        console.error("error launching game:", error);
        alert("could not load game. check console for details.");
    }
}

async function reloadCurrentGame() {
    if (!currentGame) return;
    try {
        if (currentGameBlobURL) URL.revokeObjectURL(currentGameBlobURL);
        currentGameBlobURL = await prepareGameBlobURL(currentGame);
        document.getElementById("gameFrame").src = currentGameBlobURL;
    } catch (error) {
        console.error("error reloading game:", error);
        alert("could not reload game. check console for details.");
    }
}

document.getElementById('gdCloseBtn').addEventListener('click', function () {
  endSession();
  document.getElementById('gameDialog').classList.remove('active');
  document.getElementById("gameFrame").src = "";
  document.getElementById("gdFullscreenMenu").classList.remove("open");
  if (currentGameBlobURL) {
    URL.revokeObjectURL(currentGameBlobURL);
    currentGameBlobURL = null;
  }
});

document.getElementById('gpClose').addEventListener('click', function () {
  document.getElementById("gamePanel").classList.remove("active");
});

const pinwheelBg = document.getElementById('pinwheelBg');
const gameArea = document.querySelector('.content');

gameArea.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.g-launch');
    if (btn) {
        const btnRect = btn.getBoundingClientRect();
        const areaRect = gameArea.getBoundingClientRect();
        const centerX = btnRect.left - areaRect.left + btnRect.width / 2;
        const centerY = btnRect.top - areaRect.top + btnRect.height / 2;

        pinwheelBg.style.left = `${centerX}px`;
        pinwheelBg.style.top = `${centerY}px`;
        pinwheelBg.classList.add('active');
    }
});

// button related stuff, shouldnt change
gameArea.addEventListener('mouseout', (e) => {
    const stillOverButton = e.relatedTarget && e.relatedTarget.closest('.g-launch');
    if (e.target.closest('.g-launch') && !stillOverButton) {
        pinwheelBg.classList.remove('active');
    }
});

document.getElementById("gamePanelPlay").addEventListener("click", () => {
  if (!currentGame) return;
  playGame(currentGame);
  document.getElementById("gamePanel").classList.remove("active");
});

document.getElementById("gamePanelFavorite").addEventListener("click", () => {
  if (!currentGame) return;
  const favorited = storage.toggleFavorite(currentGame);
  const btn = document.getElementById("gamePanelFavorite");
  btn.classList.toggle("favorited", favorited);
  btn.textContent = favorited ? "★" : "☆";
  renderFavorites();
});

document.getElementById("gdFavoriteBtn").addEventListener("click", () => {
  if (!currentGame) return;
  const favorited = storage.toggleFavorite(currentGame);
  const btn = document.getElementById("gdFavoriteBtn");
  btn.classList.toggle("favorited", favorited);
  btn.textContent = favorited ? "★" : "☆";

  // keep the hover panel's star in sync if it's still showing this game
  const panelFavBtn = document.getElementById("gamePanelFavorite");
  if (currentGame && panelFavBtn) {
    panelFavBtn.classList.toggle("favorited", favorited);
    panelFavBtn.textContent = favorited ? "★" : "☆";
  }
  renderFavorites();
});

document.getElementById("gdReloadBtn").addEventListener("click", () => {
  reloadCurrentGame();
});

document.getElementById("gdFullscreenBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("gdFullscreenMenu").classList.toggle("open");
});

document.addEventListener("click", () => {
  document.getElementById("gdFullscreenMenu").classList.remove("open");
});

document.getElementById("gdFullscreenTab").addEventListener("click", () => {
  document.getElementById("gdFullscreenMenu").classList.remove("open");
  const inner = document.querySelector('#gameFrame');
  if (inner.requestFullscreen) {
    inner.requestFullscreen().catch((err) =>
      console.error("could not enter fullscreen:", err),
    );
  }
});

document.getElementById("gdNewTab").addEventListener("click", () => {
  document.getElementById("gdFullscreenMenu").classList.remove("open");
  if (currentGame) playFullscreen(currentGame);
});

const favsTabLink = document.querySelector('nav a[data-tab="favs"]');
if (favsTabLink) favsTabLink.addEventListener("click", renderFavorites);

const recentTabLink = document.querySelector('nav a[data-tab="recentlyplayed"]');
if (recentTabLink) recentTabLink.addEventListener("click", renderRecent);

loadGames();
