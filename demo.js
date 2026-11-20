// Static-snapshot shim: answers the dashboard's /api/* calls from snapshot.js.
// Backgrounds are fetched live from Wikimedia Commons on every load; the baked
// pool is only a fallback if Commons is unreachable.
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

  // ── Live Wikimedia Commons backgrounds ──
  const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
  const SEARCH_QUERIES = [
    "Donald Trump filetype:bitmap",
    "Donald Trump 2016 filetype:bitmap",
    "Donald Trump 2020 filetype:bitmap",
    "Donald Trump 2024 filetype:bitmap",
    "Donald Trump inauguration filetype:bitmap",
    "Donald Trump rally filetype:bitmap",
    "Donald Trump White House filetype:bitmap",
    "Donald Trump speaking filetype:bitmap",
    "Donald Trump portrait filetype:bitmap",
    "Donald Trump signing filetype:bitmap",
  ];
  const EXCLUDE_TITLE = /\b(?:logos?|signatures?|maps?|charts?|graphs?|posters?|books?|covers?|ballots?|facebook|twitter|screenshots?|montages?|collages?|photomosaics?|memes?|caricatures?|paintings?|statues?|plaques?|flags?|seals?|coins?|stamps?|documents?|letters?|emails?|tweets?|truth social|wikipedia|commons|edits?|svgs?|icons?|ratings?|polls?|results?|battleground|tickets?|confederate|protests?|graffiti|murals?|banners?|stickers?|bumpers?|shirts?|hats?|caps?|masks?|dolls?|figures?|wax|sculptures?|drawings?|illustrations?|cartoons?|satires?|mugshots?|wanted|magazines?|newspapers?|headlines?|pdf|djvu|tif|tiff|webm|ogv|videos?|exteriors?|supporters?|crowds?|waiting|people waiting|protesting|photomosaics?|campaign signs?|songs?|trump jr)\b/i;
  const EXCLUDE_SIGN = /(?<!to )\bsign\b/i;
  const FAMILY_ONLY = /\b(?:melania|ivanka|erik|barron|trump jr)\b/i;
  const DONALD_NAMED = /\b(?:donald|president)\b|&/i;
  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

  function cleanUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.origin + url.pathname;
    } catch (e) {
      return "";
    }
  }

  function cleanText(value) {
    if (!value) return "";
    const doc = new DOMParser().parseFromString(value, "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function smallerThumb(url, width) {
    if (url.indexOf("/thumb/") === -1) return url;
    return url.replace(/\/\d+px-/, "/" + width + "px-");
  }

  function usable(width, height) {
    if (width < 700 || height < 600) return false;
    return width / height >= 0.55 && width / height <= 2.8;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  async function fetchCommonsQuery(query) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "50",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "1920",
      origin: "*",
    });
    const res = await realFetch(COMMONS_API + "?" + params.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Commons " + res.status);
    const data = await res.json();
    return (data.query && data.query.pages) || [];
  }

  function toCandidate(page) {
    const info = (page.imageinfo || [])[0];
    if (!info) return null;
    const title = page.title || "";
    if (title.toLowerCase().indexOf("trump") === -1) return null;
    if (EXCLUDE_TITLE.test(title) || EXCLUDE_SIGN.test(title)) return null;
    if (FAMILY_ONLY.test(title) && !DONALD_NAMED.test(title)) return null;
    if (ALLOWED_MIME.indexOf(info.mime) === -1) return null;
    const width = Number(info.width) || 0;
    const height = Number(info.height) || 0;
    if (!usable(width, height)) return null;
    const url = cleanUrl(info.thumburl || info.url || "");
    const pageUrl = cleanUrl(info.descriptionurl || "");
    if (!url || !pageUrl || url.indexOf("/thumb/") === -1) return null;
    const meta = info.extmetadata || {};
    let artist = cleanText((meta.Artist || {}).value || "");
    if (artist.length > 120) artist = artist.slice(0, 117).trim() + "...";
    return {
      url: url,
      page_url: pageUrl,
      title: title.replace(/^File:/, ""),
      artist: artist,
      license: cleanText((meta.LicenseShortName || {}).value || ""),
      license_url: cleanUrl((meta.LicenseUrl || {}).value || ""),
      ratio: width / height,
      width: width,
      height: height,
    };
  }

  async function fetchLiveBackground(orientation) {
    // Two random searches give a wider, fresher mix than one.
    const shuffled = SEARCH_QUERIES.slice().sort(() => Math.random() - 0.5);
    const results = await Promise.allSettled(shuffled.slice(0, 2).map(fetchCommonsQuery));

    const seen = {};
    const candidates = [];
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const page of result.value) {
        if (page.pageid != null) {
          if (seen[page.pageid]) continue;
          seen[page.pageid] = true;
        }
        const candidate = toCandidate(page);
        if (candidate) candidates.push(candidate);
      }
    }
    if (!candidates.length) throw new Error("no Commons candidates");

    let pool = candidates;
    if (orientation === "landscape") {
      pool = candidates.filter((p) => p.ratio >= 1.4 && p.width >= 1200);
    } else if (orientation === "portrait") {
      pool = candidates.filter((p) => p.ratio <= 1.05 && p.height >= 1000);
    }
    if (!pool.length) pool = candidates;

    const photo = pick(pool);
    const usePortrait = orientation === "portrait" && photo.ratio <= 1.05;
    return {
      url: usePortrait ? smallerThumb(photo.url, 1280) : photo.url,
      title: photo.title,
      page_url: photo.page_url,
      artist: photo.artist,
      license: photo.license,
      license_url: photo.license_url,
    };
  }

  function bakedBackground(orientation) {
    const pool = (snap.backgrounds && snap.backgrounds[orientation]) || [];
    if (!pool.length) return jsonResponse({ error: "no background available" }, 503);
    return jsonResponse(pool[Math.floor(Math.random() * pool.length)]);
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
      return fetchLiveBackground(orientation)
        .then((photo) => jsonResponse(photo))
        .catch(() => bakedBackground(orientation));
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
