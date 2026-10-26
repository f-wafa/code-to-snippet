/* ------------------------------------------------------------------
   Code to Snippet
   Converts plain code into VS Code .code-snippets JSON.
   No dependencies, no network requests.
------------------------------------------------------------------ */

(() => {
  "use strict";

  const BACKSLASH = "\\";

  const SAMPLE = {
    name: "Greeting function",
    prefix: "greet",
    description: "Log a friendly greeting",
    scope: "javascript",
    code: [
      "function greet(name) {",
      '  const message = "Hello, " + name + "!";',
      "",
      "  console.log(message);",
      "}",
      "",
      'greet("World");',
    ].join("\n"),
  };

  // Variables VS Code understands inside a snippet body.
  const VS_CODE_VARIABLES = new Set([
    "TM_SELECTED_TEXT",
    "TM_CURRENT_LINE",
    "TM_CURRENT_WORD",
    "TM_LINE_INDEX",
    "TM_LINE_NUMBER",
    "TM_FILENAME",
    "TM_FILENAME_BASE",
    "TM_DIRECTORY",
    "TM_FILEPATH",
    "RELATIVE_FILEPATH",
    "CLIPBOARD",
    "WORKSPACE_NAME",
    "WORKSPACE_FOLDER",
    "CURRENT_YEAR",
    "CURRENT_YEAR_SHORT",
    "CURRENT_MONTH",
    "CURRENT_MONTH_NAME",
    "CURRENT_MONTH_NAME_SHORT",
    "CURRENT_DATE",
    "CURRENT_DAY_NAME",
    "CURRENT_DAY_NAME_SHORT",
    "CURRENT_HOUR",
    "CURRENT_MINUTE",
    "CURRENT_SECOND",
    "CURRENT_SECONDS_UNIX",
    "CURRENT_TIMEZONE_OFFSET",
    "RANDOM",
    "RANDOM_HEX",
    "UUID",
    "BLOCK_COMMENT_START",
    "BLOCK_COMMENT_END",
    "LINE_COMMENT",
  ]);

  const els = {
    code: document.getElementById("code-input"),
    name: document.getElementById("snippet-name"),
    prefix: document.getElementById("snippet-prefix"),
    description: document.getElementById("snippet-description"),
    scope: document.getElementById("snippet-scope"),
    keep: document.getElementById("keep-placeholders"),
    inputGutter: document.querySelector("#input-gutter .gutter-inner"),
    inputGutterBox: document.getElementById("input-gutter"),
    outputGutter: document.querySelector("#output-gutter .gutter-inner"),
    outputGutterBox: document.getElementById("output-gutter"),
    outputViewport: document.getElementById("output-viewport"),
    outputCode: document.getElementById("output-code"),
    outputEmpty: document.getElementById("output-empty"),
    emptyTitle: document.getElementById("empty-title"),
    emptyCopy: document.getElementById("empty-copy"),
    outputStatus: document.getElementById("output-status"),
    outputFilename: document.getElementById("output-title"),
    statusDot: document.getElementById("status-dot"),
    inputStats: document.getElementById("input-stats"),
    copy: document.getElementById("copy-output"),
    download: document.getElementById("download-output"),
    loadExample: document.getElementById("load-example"),
    clear: document.getElementById("clear-code"),
    copyLabel: document.querySelector("#copy-output span"),
  };

  let jsonText = "";
  let fileName = "snippet.code-snippets";
  let isReady = false;
  let copyTimer = null;

  /* ----------------------------------------------------------------
     Conversion helpers
  ---------------------------------------------------------------- */

  function findClosingBrace(text, start) {
    let depth = 1;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === BACKSLASH) {
        i += 1;
        continue;
      }
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function isSnippetPlaceholder(inner) {
    // ${1}, ${1:default}, ${1|a,b|}
    if (/^\d+/.test(inner)) return true;

    // ${TM_FILENAME}, ${TM_FILENAME/(.*)/x/}, ${CLIPBOARD:...}
    const variable = /^([A-Z][A-Z0-9_]*)/.exec(inner);
    if (!variable || !VS_CODE_VARIABLES.has(variable[1])) return false;
    const next = inner[variable[1].length];
    return next === undefined || next === ":" || next === "/" || next === "|";
  }

  /**
   * Turn one line of plain code into snippet body text.
   * Literal backslashes are doubled and non-syntax dollars escaped,
   * because VS Code would otherwise interpret them.
   */
  function toSnippetText(line, keepPlaceholders) {
    let out = "";

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (ch === BACKSLASH) {
        if (line[i + 1] === "$") {
          // Plain code contains "\$": keep both characters.
          out += BACKSLASH + BACKSLASH + BACKSLASH + "$";
          i += 1;
        } else {
          out += BACKSLASH + BACKSLASH;
        }
        continue;
      }

      if (ch !== "$") {
        out += ch;
        continue;
      }

      if (!keepPlaceholders) {
        out += BACKSLASH + "$";
        continue;
      }

      if (line[i + 1] === "{") {
        const end = findClosingBrace(line, i + 2);
        if (end !== -1 && isSnippetPlaceholder(line.slice(i + 2, end))) {
          out += line.slice(i, end + 1);
          i = end;
          continue;
        }
        out += BACKSLASH + "$";
        continue;
      }

      const digits = /^\d+/.exec(line.slice(i + 1));
      if (digits) {
        out += "$" + digits[0];
        i += digits[0].length;
        continue;
      }

      const variable = /^[A-Z][A-Z0-9_]*/.exec(line.slice(i + 1));
      if (variable && VS_CODE_VARIABLES.has(variable[0])) {
        out += "$" + variable[0];
        i += variable[0].length;
        continue;
      }

      out += BACKSLASH + "$";
    }

    return out;
  }

  function splitLines(code) {
    return code.replace(/\r\n?/g, "\n").split("\n");
  }

  function slugify(value) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "");
    return slug || "snippet";
  }

  function plural(count, singular) {
    return `${count.toLocaleString("en-US")} ${singular}${count === 1 ? "" : "s"}`;
  }

  /* ----------------------------------------------------------------
     Display helpers
  ---------------------------------------------------------------- */

  function escapeHtml(value) {
    return value.replace(/[&<>]/g, (ch) => {
      if (ch === "&") return "&amp;";
      if (ch === "<") return "&lt;";
      return "&gt;";
    });
  }

  function highlightJson(text) {
    if (!text) return "";

    const token = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],])/g;
    let html = "";
    let lastIndex = 0;
    let match;

    while ((match = token.exec(text)) !== null) {
      html += escapeHtml(text.slice(lastIndex, match.index));

      if (match[1] !== undefined) {
        if (match[2] !== undefined) {
          html += `<span class="tok-key">${escapeHtml(match[1])}</span>`;
          html += `<span class="tok-punct">${escapeHtml(match[2])}</span>`;
        } else {
          html += `<span class="tok-string">${escapeHtml(match[1])}</span>`;
        }
      } else if (match[3] !== undefined) {
        html += `<span class="tok-number">${escapeHtml(match[3])}</span>`;
      } else if (match[4] !== undefined) {
        html += `<span class="tok-literal">${escapeHtml(match[4])}</span>`;
      } else if (match[5] !== undefined) {
        html += `<span class="tok-punct">${escapeHtml(match[5])}</span>`;
      }

      lastIndex = token.lastIndex;
    }

    return html + escapeHtml(text.slice(lastIndex));
  }

  function renderGutter(container, lineCount) {
    if (lineCount <= 0) {
      container.replaceChildren();
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= lineCount; i += 1) {
      const line = document.createElement("span");
      line.textContent = String(i);
      fragment.appendChild(line);
    }
    container.replaceChildren(fragment);
  }

  function setStatus(message, tone) {
    const className = "status" + (tone ? ` is-${tone}` : "");
    if (els.outputStatus.textContent !== message) {
      els.outputStatus.textContent = message;
    }
    if (els.outputStatus.className !== className) {
      els.outputStatus.className = className;
    }
    els.statusDot.classList.toggle("is-valid", tone === "ready");
  }

  function setEmptyState(title, copy) {
    els.emptyTitle.textContent = title;
    els.emptyCopy.textContent = copy;
  }

  /* ----------------------------------------------------------------
     Main render
  ---------------------------------------------------------------- */

  function update() {
    resetCopyButton();

    const code = els.code.value;
    const name = els.name.value.trim();
    const prefix = els.prefix.value.trim();
    const description = els.description.value.trim();
    const scope = els.scope.value;
    const keepPlaceholders = els.keep.checked;

    const codeLines = splitLines(code);
    const inputLineCount = code === "" ? 1 : codeLines.length;
    els.inputStats.textContent = `${plural(inputLineCount, "line")} · ${plural(code.length, "character")}`;
    renderGutter(els.inputGutter, inputLineCount);

    const hasCode = code.trim().length > 0;
    isReady = Boolean(hasCode && name && prefix);

    fileName = `${slugify(name || "snippet")}.code-snippets`;
    els.outputFilename.textContent = fileName;

    if (isReady) {
      const body = codeLines.map((line) => toSnippetText(line, keepPlaceholders));
      const snippet = { prefix, body };
      if (description) snippet.description = description;
      if (scope) snippet.scope = scope;

      const file = {};
      file[name] = snippet;
      jsonText = `${JSON.stringify(file, null, 2)}\n`;
    } else {
      jsonText = "";
    }

    if (jsonText) {
      els.outputCode.innerHTML = highlightJson(jsonText);
      renderGutter(els.outputGutter, splitLines(jsonText.slice(0, -1)).length);
    } else {
      els.outputCode.innerHTML = "";
      renderGutter(els.outputGutter, 0);
    }

    els.outputEmpty.hidden = isReady;
    els.copy.disabled = !isReady;
    els.download.disabled = !isReady;

    if (isReady) {
      setStatus("Ready to copy or download.", "ready");
    } else if (!hasCode) {
      setEmptyState("Nothing to convert yet", "Paste some code to see the snippet.");
      setStatus("Paste some code to get started.", "muted");
    } else if (!name && !prefix) {
      setEmptyState("Almost there", "Add a snippet name and prefix to finish.");
      setStatus("Add a snippet name and prefix.", "error");
    } else if (!name) {
      setEmptyState("Almost there", "Add a snippet name to finish.");
      setStatus("Add a snippet name.", "error");
    } else {
      setEmptyState("Almost there", "Add a prefix to trigger the snippet.");
      setStatus("Add a prefix to trigger the snippet.", "error");
    }

    els.inputGutterBox.scrollTop = els.code.scrollTop;
    els.outputGutterBox.scrollTop = els.outputViewport.scrollTop;
  }

  /* ----------------------------------------------------------------
     Actions
  ---------------------------------------------------------------- */

  function resetCopyButton() {
    if (!els.copy.classList.contains("is-copied")) return;
    clearTimeout(copyTimer);
    els.copy.classList.remove("is-copied");
    els.copyLabel.textContent = "Copy";
  }

  function fallbackCopy(text) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.top = "-1000px";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    helper.remove();
    return copied;
  }

  async function copyJson() {
    if (!isReady || !jsonText) return;

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(jsonText);
        copied = true;
      } catch {
        copied = fallbackCopy(jsonText);
      }
    } else {
      copied = fallbackCopy(jsonText);
    }

    if (!copied) {
      setStatus("Copy failed — select the JSON and copy it manually.", "error");
      return;
    }

    clearTimeout(copyTimer);
    els.copy.classList.add("is-copied");
    els.copyLabel.textContent = "Copied";
    setStatus("Copied to clipboard.", "ready");
    copyTimer = setTimeout(() => {
      resetCopyButton();
      if (isReady) setStatus("Ready to copy or download.", "ready");
    }, 1800);
  }

  function downloadFile() {
    if (!isReady || !jsonText) return;

    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function loadExample() {
    els.code.value = SAMPLE.code;
    els.name.value = SAMPLE.name;
    els.prefix.value = SAMPLE.prefix;
    els.description.value = SAMPLE.description;
    els.scope.value = SAMPLE.scope;
    els.keep.checked = true;
    els.code.scrollTop = 0;
    els.outputViewport.scrollTop = 0;
    update();
    els.code.focus();
    els.code.setSelectionRange(SAMPLE.code.length, SAMPLE.code.length);
  }

  function clearCode() {
    els.code.value = "";
    els.code.scrollTop = 0;
    update();
    els.code.focus();
  }

  /* ----------------------------------------------------------------
     Events and start
  ---------------------------------------------------------------- */

  els.code.addEventListener("input", update);
  els.name.addEventListener("input", update);
  els.prefix.addEventListener("input", update);
  els.description.addEventListener("input", update);
  els.scope.addEventListener("change", update);
  els.keep.addEventListener("change", update);

  els.code.addEventListener("scroll", () => {
    els.inputGutterBox.scrollTop = els.code.scrollTop;
  });

  els.outputViewport.addEventListener("scroll", () => {
    els.outputGutterBox.scrollTop = els.outputViewport.scrollTop;
  });

  els.code.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    els.code.setRangeText("  ", els.code.selectionStart, els.code.selectionEnd, "end");
    update();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      copyJson();
    }
  });

  els.loadExample.addEventListener("click", loadExample);
  els.clear.addEventListener("click", clearCode);
  els.copy.addEventListener("click", copyJson);
  els.download.addEventListener("click", downloadFile);

  els.code.value = SAMPLE.code;
  update();
})();

