let GAMES = {};

// default repo used by the "#folder" shorthand
// basically, if its one of our games on github, use "#"
// if its just one we used from a different repo, do OWNER/REPO@REF/FOLDER
// for example, if there was cookie clicker it would be ck/cookieclicker@master/cookieclicker
const DEFAULT_REPO_OWNER = "appleorangesponegbo";
const DEFAULT_REPO_NAME = "projects";
const DEFAULT_REPO_REF = "22cdfc1";

function resolveGameSource(id) {
  let owner, repo, ref, rest;

  if (id.startsWith("#")) {
    owner = DEFAULT_REPO_OWNER;
    repo = DEFAULT_REPO_NAME;
    ref = DEFAULT_REPO_REF;
    rest = id.slice(1);
  } else {
    const match = id.match(/^([^/]+)\/([^/@]+)@([^/]+)(?:\/(.+))?$/);
    if (!match) {
      throw new Error(`invalid game id format: "${id}", expected "#[folder/][file.html]" or "owner/repo@ref[/folder][/file.html]"`);
    }
    [, owner, repo, ref, rest] = match;
  }

  let folder = "";
  let file = "index.html";

  if (rest) {
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

  return { baseUrl, indexUrl: `${baseUrl}${file}` };
}

async function loadGames() {
  const list = document.getElementById("gameList");
  try {
    const response = await fetch("items.json");
    if (!response.ok) throw new Error(`http error! status: ${response.status}`);
    const games = await response.json();

    games.forEach((game) => {
      GAMES[game.id] = game;

      const btn = document.createElement("button");
      btn.className = "g-launch";
      btn.dataset.g = game.id;
      btn.dataset.n = game.title;

      const img = document.createElement("img");
      img.src = game.image;
      img.width = 120;
      img.alt = game.title;

      btn.appendChild(img);
      btn.addEventListener("click", () => openGamePanel(game.id));

      list.appendChild(btn);
    });
  } catch (error) {
    console.error("error loading games list:", error);
  }
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
  document.getElementById("gamePanelPlayers").textContent = data.players;
  document.getElementById("gamePanel").classList.add("active");
}

async function prepareGameBlobURL(name) {
    const { baseUrl, indexUrl } = resolveGameSource(name);
    const response = await fetch(indexUrl);
    if (!response.ok) throw new Error(`http error! status: ${response.status}`);
    let htmlContent = await response.text();

    if (!/^\s*<!doctype/i.test(htmlContent)) {
        htmlContent = "<!DOCTYPE html>\n" + htmlContent;
    }

    if (/name=["']generator["']\s+content=["']Construct 3["']/i.test(htmlContent)) {
        const mainJsMatch = htmlContent.match(/<script\s+src=["']([^"']*\bmain[a-zA-Z0-9_.-]*\.js)["'][^>]*><\/script>/i);
        if (!mainJsMatch) {
            console.warn("couldn't find a main*.js script tag, export format may have changed");
        } else {
            const mainJsUrl = new URL(mainJsMatch[1], baseUrl).toString();
            const mainJsResp = await fetch(mainJsUrl);
            if (mainJsResp.ok) {
                let mainJsText = await mainJsResp.text();
                let patched = mainJsText;

                // some builds derive their worker/JobScheduler base from
                // document.currentScript.src, which is "" once we inline this
                // as a bodyless <script> below
                const scriptFolderMatch = mainJsText.match(/scriptFolder\s*:\s*["']([^"']*)["']/);
                const scriptsFolder = scriptFolderMatch ? scriptFolderMatch[1] : "scripts/";
                const scriptsBaseUrl = new URL(scriptsFolder, baseUrl).toString();
                patched = patched.split("document.currentScript.src").join(JSON.stringify(scriptsBaseUrl));

                const originlessBase = JSON.stringify(baseUrl.replace(/\/$/, ""));
                const beforeLocationPatch = patched;
                patched = patched.split("location.origin").join(originlessBase);
                patched = patched.split("location.pathname").join('"/"');
                if (patched === beforeLocationPatch) {
                    console.warn("main.js doesn't reference location.origin/pathname, export format may have changed");
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

async function playHere(name) {
    try {
        if (currentGameBlobURL) URL.revokeObjectURL(currentGameBlobURL);
        currentGameBlobURL = await prepareGameBlobURL(name);
        document.getElementById("gameFrame").src = currentGameBlobURL;
        document.getElementById("gameDialog").classList.add("active");
    } catch (error) {
        console.error("Error launching game:", error);
        alert("could not load game. check console for details.");
    }
}

function closeGamePanel() {
    document.getElementById('gamePanel').classList.remove('active');
}

function closeGameDialog() {
    document.getElementById("gameDialog").classList.remove("active");
    document.getElementById("gameFrame").src = "";
    if (currentGameBlobURL) {
        URL.revokeObjectURL(currentGameBlobURL);
        currentGameBlobURL = null;
    }
}

const pinwheelBg = document.getElementById('pinwheelBg');
const gameArea = document.querySelector('.content'); // the cqmin/positioning container

document.getElementById('gameList').addEventListener('mouseover', (e) => {
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
document.getElementById('gameList').addEventListener('mouseout', (e) => {
    const stillOverButton = e.relatedTarget && e.relatedTarget.closest('.g-launch');
    if (e.target.closest('.g-launch') && !stillOverButton) {
        pinwheelBg.classList.remove('active');
    }
});

document.getElementById("gamePanelPlayHere").addEventListener("click", () =>
  currentGame &&
  playHere(currentGame) &&
  document.getElementById("gamePanel").classList.remove("active"),
);

document.getElementById("gamePanelPlayFullscreen").addEventListener("click", () =>
  currentGame &&
  playFullscreen(currentGame) &&
  document.getElementById("gamePanel").classList.remove("active"),
);

loadGames();
