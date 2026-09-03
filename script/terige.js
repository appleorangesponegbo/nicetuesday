(function () {
  const GITHUB_RE = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(tree|blob)\/([^\/]+)(?:\/(.*))?)?\/?$/i;

  function parseGithubUrl(url) {
    const m = url.trim().match(GITHUB_RE);
    if (!m) return null;
    const [, owner, repo, mode, branch, path] = m;
    return {
      owner,
      repo,
      mode: mode || null,
      branch: branch || '',
      path: path ? path.replace(/\/+$/, '') : ''
    };
  }

  function computeId(owner, repo, branch, path) {
    let id = `${owner}/${repo}`;
    if (branch) id += `@${branch}`;
    if (path) {
      let p = path.replace(/^\/+|\/+$/g, '');
      if (/(^|\/)index\.html$/i.test(p)) {
        p = p.replace(/(^|\/)index\.html$/i, '');
      }
      p = p.replace(/\/+$/, '');
      if (p) id += `/${p}`;
    }
    return id;
  }

  function guessTitle(repo) {
    return repo;
  }

  function injectStyles() {
    if (document.getElementById('terige-styles')) return;
    const style = document.createElement('style');
    style.id = 'terige-styles';
    style.textContent = `
      dialog.terige-dialog {
        background-image:
          linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)),
          url("img/maincontent.gif");
        border: 5px solid transparent;
        border-image: url("img/boxes.jpg") 5 round;
        color: #eee;
        width: min(420px, 90vw);
        padding: 18px 20px;
        font-family: inherit;
      }
      dialog.terige-dialog::backdrop {
        background: rgba(0,0,0,0.6);
      }
      .terige-dialog h3 {
        margin: 0 0 4px 0;
        color: #75d17a;
      }
      .terige-dialog p.terige-hint {
        margin: 0 0 12px 0;
        font-size: 0.85em;
        color: #bbb;
      }
      .terige-dialog input,
      .terige-dialog textarea {
        width: 100%;
        box-sizing: border-box;
        background: #373737;
        color: #eee;
        border: 1px solid #555;
        padding: 6px 8px;
        font-family: inherit;
        margin-bottom: 4px;
      }
      .terige-dialog textarea {
        resize: vertical;
        min-height: 60px;
      }
      .terige-dialog .terige-error {
        color: #F28585;
        font-size: 0.85em;
        min-height: 1em;
        margin: 4px 0 8px 0;
      }
      .terige-dialog .terige-btn-row {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
      }
      .terige-dialog button {
        background: #79C5DC;
        color: #202020;
        border: none;
        padding: 6px 14px;
        cursor: pointer;
        font-weight: bold;
      }
      .terige-dialog button.secondary {
        background: #555;
        color: #eee;
      }
      .terige-dialog button.danger {
        background: #F28585;
      }
      .terige-dialog pre.terige-output {
        background: #202020;
        color: #B7E5B4;
        padding: 10px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 0.85em;
      }
    `;
    document.head.appendChild(style);
  }

  function runWizard(parsed) {
    injectStyles();

    const dialog = document.createElement('dialog');
    dialog.className = 'terige-dialog';
    document.body.appendChild(dialog);

    const state = {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch,
      path: parsed.path,
      title: guessTitle(parsed.repo),
      image: '',
      description: '',
      players: ''
    };

    const steps = [];
    if (!state.branch) {
      steps.push({
        key: 'branch',
        heading: 'what branch is this on?',
        hint: "leave blank if you dont know the id just wont include an branch (which you need!!!!!!!!). do NOT include the @ at the start",
        field: 'input'
      });
    }
    steps.push({
      key: 'path',
      heading: 'wheres the main file (if not repo root)?',
      hint: 'e.g. "assets/index.html" or "assets". leave blank for root directory. index.html is assumed and stripped automatically',
      field: 'input'
    });
    steps.push({
      key: 'title',
      heading: 'whats a good title?',
      hint: 'shown to vistors, defaults to the repo name',
      field: 'input'
    });
    steps.push({
      key: 'image',
      heading: 'good image?',
      hint: 'path or url to the image url',
      field: 'input'
    });
    steps.push({
      key: 'description',
      heading: 'the description',
      hint: 'a short description about the game. can be taken off of google, but at least something professional',
      field: 'textarea'
    });
    steps.push({
      key: 'players',
      heading: 'player count',
      hint: 'e.g. "1 player" or "1-2 players"',
      field: 'input'
    });

    let idx = 0;

    function render() {
      if (idx >= steps.length) {
        renderResult();
        return;
      }
      const step = steps[idx];
      const currentVal = state[step.key] || '';
      const fieldHtml = step.field === 'textarea'
        ? `<textarea id="terige-input">${escapeHtml(currentVal)}</textarea>`
        : `<input id="terige-input" type="text" value="${escapeHtml(currentVal)}">`;

      dialog.innerHTML = `
        <h3>${escapeHtml(step.heading)}</h3>
        <p class="terige-hint">${escapeHtml(step.hint)}</p>
        ${fieldHtml}
        <div class="terige-error"></div>
        <div class="terige-btn-row">
          <button type="button" class="danger" id="terige-cancel">cancel</button>
          ${idx > 0 ? '<button type="button" class="secondary" id="terige-back">back</button>' : ''}
          <button type="button" id="terige-next">${idx === steps.length - 1 ? 'finish' : 'next'}</button>
        </div>
      `;

      dialog.querySelector('#terige-cancel').onclick = () => dialog.close();
      const backBtn = dialog.querySelector('#terige-back');
      if (backBtn) backBtn.onclick = () => { idx--; render(); };
      dialog.querySelector('#terige-next').onclick = () => {
        const val = dialog.querySelector('#terige-input').value;
        state[step.key] = val.trim();
        idx++;
        render();
      };

      const input = dialog.querySelector('#terige-input');
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && step.field !== 'textarea') {
          e.preventDefault();
          dialog.querySelector('#terige-next').click();
        }
      });
    }

    function renderResult() {
      const id = computeId(state.owner, state.repo, state.branch, state.path);
      const obj = {
        id,
        title: state.title || guessTitle(state.repo),
        image: state.image,
        description: state.description,
        players: state.players
      };
      const output = ',\n  {\n' +
        `    "id": "${escapeJson(obj.id)}",\n` +
        `    "title": "${escapeJson(obj.title)}",\n` +
        `    "image": "${escapeJson(obj.image)}",\n` +
        `    "description": "${escapeJson(obj.description)}",\n` +
        `    "players": "${escapeJson(obj.players)}"\n` +
        '  }';

      dialog.innerHTML = `
        <h3>youre done</h3>
        <p class="terige-hint">thank you come again</p>
        <pre class="terige-output" id="terige-output"></pre>
        <div class="terige-btn-row">
          <button type="button" class="secondary" id="terige-back">back</button>
          <button type="button" id="terige-copy">copy</button>
          <button type="button" class="danger" id="terige-close">bye</button>
        </div>
      `;
      dialog.querySelector('#terige-output').textContent = output;
      dialog.querySelector('#terige-close').onclick = () => dialog.close();
      dialog.querySelector('#terige-back').onclick = () => { idx--; render(); };
      dialog.querySelector('#terige-copy').onclick = () => {
        const btn = dialog.querySelector('#terige-copy');
        navigator.clipboard.writeText(output).then(() => {
          btn.textContent = 'copied';
          setTimeout(() => { btn.textContent = 'copy'; }, 1200);
        }).catch(() => {
          btn.textContent = 'copy failed';
        });
      };
    }

    dialog.addEventListener('close', () => dialog.remove());
    render();
    dialog.showModal();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeJson(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function showError(field, msg) {
    field.style.borderColor = '#F28585';
    field.title = msg;
    setTimeout(() => {
      field.style.borderColor = '';
      field.title = '';
    }, 2000);
  }

  function init() {
    const field = document.getElementById('terigefield');
    if (!field) return;

    const trigger = () => {
      const url = field.value.trim();
      if (!url) return;
      const parsed = parseGithubUrl(url);
      if (!parsed) {
        showError(field, 'i have no idea what that is at all');
        return;
      }
      runWizard(parsed);
    };

    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        trigger();
      }
    });
    field.addEventListener('blur', trigger);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
