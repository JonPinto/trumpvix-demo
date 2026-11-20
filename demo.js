// Static-snapshot shim: answers the dashboard's /api/* calls from snapshot.js.
(() => {
  const snap = window.__SNAPSHOT__;
  if (!snap) return;
  window.__DEMO__ = true;

  const realFetch = window.fetch.bind(window);

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  function statementsFor(url) {
    const q = url.searchParams.get("q");
    const date = url.searchParams.get("date");
    let items = snap.statements.slice();
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((s) =>
        (s.content_text || "").toLowerCase().includes(needle) ||
        (s.title || "").toLowerCase().includes(needle));
    } else if (date) {
      items = items.filter((s) => (s.published_at || "").slice(0, 10) === date);
    }
    return items.slice(0, 30);
  }

  window.fetch = function (input, init) {
    const raw = typeof input === "string" ? input : (input && input.url) || "";
    let url;
    try {
      url = new URL(raw, location.href);
    } catch (e) {
      return realFetch(input, init);
    }
    const path = url.pathname;

    if (path === "/api/statements") {
      return Promise.resolve(jsonResponse(statementsFor(url)));
    }
    if (path === "/api/vix") {
      return Promise.resolve(jsonResponse(snap.vix));
    }
    if (path.indexOf("/api/reactions/") === 0) {
      const id = decodeURIComponent(path.slice("/api/reactions/".length));
      const reaction = snap.reactions[id];
      return Promise.resolve(reaction
        ? jsonResponse(reaction)
        : jsonResponse({ error: "not found" }, 404));
    }
    if (path === "/api/background") {
      const orientation = url.searchParams.get("orientation") === "portrait" ? "portrait" : "landscape";
      const pool = (snap.backgrounds && snap.backgrounds[orientation]) || [];
      if (!pool.length) {
        return Promise.resolve(jsonResponse({ error: "no background available" }, 503));
      }
      return Promise.resolve(jsonResponse(pool[Math.floor(Math.random() * pool.length)]));
    }
    if (path === "/api/refresh/status") {
      return Promise.resolve(jsonResponse({
        running: false,
        current_step: null,
        results: [],
        last_run: snap.generated_at,
      }));
    }
    if (path === "/api/refresh") {
      return Promise.resolve(jsonResponse({ ok: true, demo: true }, 202));
    }
    if (path === "/api/video") {
      // No server to proxy through; playVideo opens the source instead.
      return Promise.resolve(jsonResponse({ error: "demo" }, 404));
    }
    return realFetch(input, init);
  };

  function initUi() {
    const banner = document.getElementById("demoBanner");
    if (banner) {
      const link = snap.repo_url || "https://github.com/JonPinto/trumpvix";
      const label = link.replace(/^https?:\/\//, "").replace(/\/$/, "");
      banner.innerHTML =
        '<span class="demo-banner-tag">Demo snapshot ' + snap.app_version + '</span> · ' +
        'snapshot ' + snap.snapshot_version + ' — data up to date as of <strong>' +
        snap.data_as_of + '</strong>. This is a static snapshot; the full app with a ' +
        'live, updating database is at <a href="' + link + '" target="_blank" ' +
        'rel="noreferrer">' + label + '</a>.';
    }
    // The refresh button has nothing to talk to in the snapshot.
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      const divider = refreshBtn.previousElementSibling;
      if (divider && divider.classList.contains("search-divider")) {
        divider.style.display = "none";
      }
      refreshBtn.style.display = "none";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUi);
  } else {
    initUi();
  }
})();
