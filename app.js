/* kaydee.my
   Site settings are in CONFIG just below. Everything after it is the site itself. */

const CONFIG = {
  /* Content source. Paste the /exec address of the published web app here.
     It must end in /exec, not /dev. */
  SOURCE: "https://script.google.com/macros/s/AKfycbz4C4Cc896-SYx035S7zcJAhROPnrCkg3jJZmxoCwO2QPySNG1zaTtxGxAVewvrAdrq/exec",

  LOGO: "logo.png",

  INSTAGRAM: "https://www.instagram.com/kaydee.my/",
  TIKTOK: "https://www.tiktok.com/@kaydee.my",
  FACEBOOK: "https://www.facebook.com/kaydee.my",
  EMAIL: "hello@kaydee.my",
  MAX_FEATURED: 5
};

/* ===================== MOTION ===================== */
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => matchMedia("(hover:hover) and (pointer:fine)").matches;
let revealObserver = null;

function routeMotion(){
  if(reduceMotion()) return;
  const app = document.getElementById("app");
  app.classList.remove("route-in");
  void app.offsetWidth;
  app.classList.add("route-in");
  setTimeout(() => app.classList.remove("route-in"), 800);

  document.querySelectorAll('.tabs a.on, .tabbar a.on').forEach(a => {
    a.classList.remove('nav-pop'); void a.offsetWidth; a.classList.add('nav-pop');
    setTimeout(() => a.classList.remove('nav-pop'), 620);
  });
}

function initReveals(){
  if(revealObserver) revealObserver.disconnect();
  const targets = [...document.querySelectorAll(
    '#app .sec-head, #app .card, #app .er, #app .ab-score, #app .facts-row, #app .detail, #app .prose, #app .toolbar, #app .empty'
  )];
  if(!targets.length) return;
  if(reduceMotion()){
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }
  targets.forEach((el,i) => {
    el.classList.add('motion-reveal');
    el.style.setProperty('--reveal-delay', Math.min((i % 8) * 42, 210) + 'ms');
  });
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-visible');
      revealObserver.unobserve(el);
      /* Once it has arrived it goes back to being ordinary markup, with no
         transform and nothing for the compositor to hold on to. */
      const done = ev => {
        if(ev.target !== el) return;               /* a child's animation is not ours */
        el.removeEventListener('animationend', done);
        el.classList.remove('motion-reveal', 'is-visible');
        el.style.removeProperty('--reveal-delay');
      };
      el.addEventListener('animationend', done);
    });
  }, { threshold:.12, rootMargin:'0px 0px -6% 0px' });
  targets.forEach(el => revealObserver.observe(el));
}

function initTilt(){
  if(reduceMotion() || !finePointer()) return;
  document.querySelectorAll('#app .card').forEach(el => {
    if(el.dataset.tilt) return;
    el.dataset.tilt = "1";
    el.classList.add('motion-tilt');
    let raf = 0;
    el.addEventListener('pointermove', e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        el.classList.add('is-tilting');
        el.style.transform = `translateY(-8px) scale(1.02) rotateX(${-y*3.2}deg) rotateY(${x*4.2}deg)`;
      });
    }, {passive:true});
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.classList.remove('is-tilting');
      el.style.transform = '';
    });
  });
}

function initMagnets(){
  if(reduceMotion() || !finePointer()) return;
  document.querySelectorAll('.btn, .cnav, .circle-btn, .sec-head a').forEach(el => {
    if(el.dataset.magnet === '1') return;
    el.dataset.magnet = '1';
    el.classList.add('motion-magnet');
    /* The nudge uses the separate translate property, so the hover zoom and
       the press effect set in CSS keep working underneath it. */
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width/2)) / r.width;
      const y = (e.clientY - (r.top + r.height/2)) / r.height;
      el.style.translate = (x*5).toFixed(1) + 'px ' + (y*4).toFixed(1) + 'px';
    }, {passive:true});
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });
}

function initMotion(isRoute){
  if(isRoute) routeMotion();
  initReveals();
  initTilt();
  initMagnets();
}


/* ===================== DATA =====================
   A visitor reads the copy already held on their own device. The site asks the
   source only for a short version stamp, and pulls the full content again only
   when that stamp has moved, which happens when changes are published.
   ================================================ */
const state = { reviews: [], events: [], status: "loading" };

const STORE_KEY = "kd_content_v1";

function readStore(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); }catch(e){ return null; }
}
function writeStore(obj){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }catch(e){}
}
/* A row without a usable title cannot be shown or linked to, so it never
   enters the site at all rather than drawing an empty card. */
const usable = r => r && typeof r === "object" && !Array.isArray(r) &&
  (typeof r.title === "string" || typeof r.title === "number") && String(r.title).trim() !== "";

/* Every value becomes a trimmed string, so a number or an odd type in a
   response can never break the page. Nested values are dropped. */
const clean = r => {
  const o = {};
  for(const k in r){
    const v = r[k];
    if(v === null || v === undefined || typeof v === "object") continue;
    const t = String(v).trim();
    if(t) o[k] = k === "title" ? t.slice(0, 300) : t;
  }
  return o;
};

function apply(d){
  const rev = Array.isArray(d && d.reviews) ? d.reviews.filter(usable).map(clean) : [];
  const evt = Array.isArray(d && d.events)  ? d.events.filter(usable).map(clean)  : [];
  if(!rev.length && !evt.length) return false;
  /* Each film gets one address. Two films that would share one are told apart. */
  const taken = new Set();
  rev.forEach(r => {
    let base = slugify(r.title) || "film";
    if(r.year) base += "-" + slugify(r.year);
    let slug = base, n = 2;
    while(taken.has(slug)) slug = base + "-" + n++;
    taken.add(slug);
    r._slug = slug;
  });
  state.reviews = rev; state.events = evt;
  return true;
}
async function grab(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 9000);
  try{
    /* no-store matters on the stamp request. Without it the browser can keep
       answering from its own copy and never notice that something was published. */
    const res = await fetch(url, { signal: ctl.signal, redirect: "follow", cache: "no-store" });
    if(!res.ok) throw 0;
    return await res.json();
  } finally { clearTimeout(t); }
}

/* Fetches the version stamp and, when it has moved, the content. Returns
   "same", "new", "empty" (reached, nothing published) or throws. */
async function pull(known){
  const stamp = await grab(CONFIG.SOURCE + "?route=version&t=" + Date.now(), 7000);
  const version = String((stamp && stamp.version) || "0");
  if(known !== null && version === known) return "same";
  const fresh = await grab(CONFIG.SOURCE + "?route=all&v=" + encodeURIComponent(version), 12000);
  if(!fresh || typeof fresh !== "object" || fresh.error) throw 0;
  if(!apply(fresh)) return "empty";
  seenVersion = version;
  writeStore({ version: version, data: { reviews: state.reviews, events: state.events } });
  return "new";
}

/* Returns true when what is on screen should be drawn again. */
async function loadData(){
  const cached = readStore();

  /* Show whatever is already on the device straight away. A copy that cannot
     be drawn is thrown away rather than leaving the page stuck. */
  let painted = false;
  let fromCache = false;
  try{ fromCache = !!cached && apply(cached.data); }catch(e){ fromCache = false; }
  if(fromCache){
    state.status = "ready";
    painted = safeRender();
    if(!painted){ state.reviews = []; state.events = []; }
  }

  let result = "fail";
  try{ result = await pull(painted ? String(cached.version) : null); }
  catch(err){ /* offline or unreachable: keep what is on screen */ }

  const before = state.status;
  if(result === "new") state.status = "ready";
  else if(!painted) state.status = result === "empty" ? "empty" : "offline";
  if(result === "same") seenVersion = String(cached.version);
  return result === "new" || state.status !== before;
}

/* Look again when the tab is brought back to the front, so a page left open
   picks up a publish without needing a reload. Throttled to once a minute. */
let seenVersion = null, lastLook = 0;
async function refresh(){
  if(Date.now() - lastLook < 60000 || seenVersion === null) return;
  lastLook = Date.now();
  try{ if(await pull(seenVersion) === "new") render(true); }catch(err){}
}
addEventListener("visibilitychange", () => { if(!document.hidden) refresh(); });

/* ===================== HELPERS ===================== */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const list = s => String(s ?? "").split(/[,|]/).map(x => x.trim()).filter(Boolean);
const num = v => {
  const t = String(v === null || v === undefined ? "" : v).trim().replace(/,/g, "");
  if(!/^[+-]?\d*\.?\d+$/.test(t)) return null;   /* "8/10" or "n/a" is not a number */
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
};
/* Letters from any script are kept, so a Tamil or Hindi title still gets its own address. */
const slugify = s => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"");
const slugOf = r => r._slug || slugify(r.title) || "film";
const reviewHref = r => "#/review/" + encodeURIComponent(slugOf(r));
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const parseDate = v => {
  if(v === null || v === undefined) return null;
  const t = String(v).trim();
  if(!t) return null;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(iso){
    const y = +iso[1], mo = +iso[2], da = +iso[3];
    if(mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    const d = new Date(y, mo - 1, da);
    /* Rejects 2026-02-31, which Date would silently roll into March. */
    return (d.getMonth() === mo - 1 && d.getDate() === da) ? d : null;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = v => { const d = parseDate(v); return d ? d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : ""; };
const runtime = m => {
  const n = num(m);
  if(!n || n < 1 || n > 900) return "";            /* a typo should print nothing, not nonsense */
  const h = Math.floor(n / 60), mm = Math.round(n % 60);
  return h ? (mm ? h + " hr " + mm + " min" : h + " hr") : mm + " min";
};
const dots = a => a.filter(Boolean).map(esc).join(" · ");
const paras = t => String(t || "").split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => "<p>" + esc(x) + "</p>").join("");
const factList = rows => rows.length
  ? '<dl class="facts">' + rows.map(([k,v]) => '<div class="facts-row"><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join("") + '</dl>' : "";
const releaseLine = r => { const w = fmtDate(r.release_date); return w ? "In cinemas " + w : "Date TBA"; };
/* Single quotes inside url(), because this sits in a double quoted style
   attribute. Double quotes here would close the attribute early. */
/* cssUrl is for setting a style from script; bg is for markup, so it is also escaped. */
const cssUrl = u => {
  const t = safeUrl(u).replace(/[\n\r\f]/g, "").replace(/['\\]/g, c => c === "'" ? "%27" : "%5C");
  return t ? "url('" + t + "')" : "none";
};
const bg = u => esc(cssUrl(u));
const isFeatured = x => ["true","yes","1","y"].includes(String(x.featured||"").trim().toLowerCase());
const upcoming = e => { const d = parseDate(e.date_end || e.date_start); return !d || d.getTime() >= Date.now() - 864e5; };
/* Soonest first. Rows with no date go to the end rather than the top. */
const byDate = k => (a,b) => {
  const x = parseDate(a[k]), y = parseDate(b[k]);
  if(!x || !y) return x ? -1 : y ? 1 : 0;
  return x - y;
};
const today0 = () => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); };
/* A film sits under Upcoming until there is something to read: a score or a
   written review. A release date still ahead keeps it there regardless. */
const hasReview = r => rated(r) || String(r.review_body || "").trim() !== "";
const unreleased = r => {
  const d = parseDate(r.release_date);
  if(d && d.getTime() > today0()) return true;
  return !hasReview(r);
};
const rated = r => { const n = num(r.rating); return n !== null && n >= 0 && n <= 10; };

/* Only ordinary web links are allowed out of the content into an href or a
   background. A stray "javascript:" value becomes nothing at all. */
const safeUrl = u => {
  const t = String(u || "").trim();
  if(!t) return "";
  if(/^(https?:|mailto:)/i.test(t)) return t;
  if(/^\/\//.test(t)) return "https:" + t;
  if(/^[\w.\-]+\.[a-z]{2,}(\/|$)/i.test(t)) return "https://" + t;   /* bare domain typed by hand */
  return "";
};
const dayKey = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");

const ICON = {
  home:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.4 12 3l9 7.4V20a1 1 0 0 1-1 1h-5v-6.5h-6V21H4a1 1 0 0 1-1-1z"/></svg>',
  star:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3.6 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z"/></svg>',
  info:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.4M12 7.7v.2"/></svg>',
  search:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
  sun:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></svg>',
  moon:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z"/></svg>',
  left:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 5-7 7 7 7"/></svg>',
  right:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 5 7 7-7 7"/></svg>',
  close:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ticket:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 9.2V7a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 7v2.2a2.8 2.8 0 0 0 0 5.6V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-2.2a2.8 2.8 0 0 0 0-5.6z"/><path d="M14 6v12" stroke-dasharray="2 2.6"/></svg>',
  calgrid:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.2" y="5" width="17.6" height="16" rx="4"/><path d="M8 3v4M16 3v4M3.2 10.5h17.6"/><circle cx="8.4" cy="14.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="14.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.6" cy="14.6" r="1.15" fill="currentColor" stroke="none"/></svg>',
  play:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.87l10.4-6.4a1 1 0 0 0 0-1.74L9.5 4.73A1 1 0 0 0 8 5.6z"/></svg>',
  instagram:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.1" cy="6.9" r="1.15" fill="currentColor" stroke="none"/></svg>',
  tiktok:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 3h-2.7v11.4a2.3 2.3 0 1 1-2.3-2.3c.24 0 .47.04.69.11V9.4a5.2 5.2 0 0 0-.69-.05 5.05 5.05 0 1 0 5.05 5.05V8.9a6.4 6.4 0 0 0 3.75 1.2V7.4A3.75 3.75 0 0 1 16.4 3z"/></svg>',
  facebook:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.6 21v-8.2h2.75l.41-3.19H13.6V7.57c0-.92.26-1.55 1.58-1.55h1.69V3.17c-.29-.04-1.3-.13-2.47-.13-2.44 0-4.11 1.49-4.11 4.23v2.34H7.53v3.19h2.76V21z"/></svg>',
  mail:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="m3.6 7.6 7.35 5.05a1.85 1.85 0 0 0 2.1 0L20.4 7.6"/></svg>'
};
const NAV = [["/","Home","home"],["/movies","Movies","star"],["/events","Events","ticket"],
             ["/calendar","Calendar","calgrid"],["/about","About","info"]];
const MONTH = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function score(v, size){
  const n = num(v); if(n === null || n < 0 || n > 10) return "";
  return '<span class="score '+(size||"")+'"><b>'+(Number.isInteger(n)?n:n.toFixed(1))+'</b><i>/10</i></span>';
}
/* Either a score or an Upcoming badge, never both. */
function mark(r, size){
  if(rated(r)) return score(r.rating, size);
  if(unreleased(r)) return '<span class="badge '+(size||"")+'">Coming soon</span>';
  return "";
}
function poster(r, withScore){
  const ph = '<div class="ph">'+esc((r.title||"KD").slice(0,2).toUpperCase())+'</div>';
  const art = safeUrl(r.poster_url)
    ? '<div class="art" role="img" aria-label="'+esc(r.title)+'" style="background-image:'+bg(r.poster_url)+'"></div>'
    : "";
  return '<div class="poster">'+ph+art+(withScore ? mark(r,"sm") : "")+'</div>';
}
function card(r){
  const soon = unreleased(r);
  const line = soon ? '<span class="card-soon">' + esc(releaseLine(r)) + '</span>' : dots([r.year, r.language]);
  return '<a class="card" href="'+reviewHref(r)+'">'+poster(r,true)+
    '<h3>'+esc(r.title)+'</h3><div class="meta">'+line+'</div></a>';
}
function media(url, ytid){
  if(!safeUrl(url)) return '<div class="slide-fallback"></div>';
  /* The gradient sits underneath, so a picture that fails to load still reads
     as a designed panel rather than an empty box. */
  return '<div class="slide-fallback"></div><div class="slide-media"'+
    (ytid ? ' data-yt="'+esc(ytid)+'"' : "")+
    ' style="background-image:'+bg(url)+'"></div>';
}

/* ===================== CAROUSEL ===================== */
function carousel(slides, id){
  if(!slides.length) return "";
  return '<div class="carousel rise" data-carousel id="'+id+'">'+
    '<div class="track">'+slides.join("")+'</div>'+
    (slides.length > 1 ? '<button class="cnav prev glass" aria-label="Previous slide">'+ICON.left+'</button>'+
      '<button class="cnav next glass" aria-label="Next slide">'+ICON.right+'</button>'+
      '<div class="cdots">'+slides.map((_,i) => '<button aria-label="Go to slide '+(i+1)+'"'+(i?"":' class="on"')+'></button>').join("")+'</div>' : "")+
    '</div>';
}
/* ===================== TRAILER =====================
   The player is built when it is opened and torn down when it is closed, so a
   video can never keep playing behind the page.
   ==================================================== */
let videoBack = null, videoHide = 0;

function openVideo(id){
  const box = document.getElementById("video"), slot = document.getElementById("videoSlot");
  if(!box || !slot || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
  clearTimeout(videoHide);                    /* reopened while still closing */
  const wasOpen = box.dataset.state === "open";
  if(!wasOpen) videoBack = document.activeElement;
  box.dataset.state = "open";
  slot.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
    '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="Trailer" ' +
    'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
  box.hidden = false;
  if(!wasOpen){ lockScroll(true); requestAnimationFrame(() => { if(box.dataset.state === "open") box.classList.add("open"); }); }
  const x = document.getElementById("videoClose");
  if(x) x.focus();
}

function closeVideo(){
  const box = document.getElementById("video"), slot = document.getElementById("videoSlot");
  if(!box || box.dataset.state !== "open") return;
  box.dataset.state = "closed";
  box.classList.remove("open"); box.removeAttribute("data-drag");
  box.style.opacity = "";
  document.getElementById("videoPanel").style.transform = "";
  slot.innerHTML = "";                       /* stops playback immediately */
  lockScroll(false);
  videoHide = setTimeout(() => { box.hidden = true; }, 340);
  if(videoBack && videoBack.focus) videoBack.focus();
  videoBack = null;
}

addEventListener("click", e => {
  if(!e.target.closest) return;
  const play = e.target.closest("[data-yt]");
  if(play){ e.preventDefault(); openVideo(play.dataset.yt); return; }
  /* The button, or anywhere on the dark surround, closes the player. */
  if(e.target.closest("#video") && !e.target.closest(".vframe")) closeVideo();
});

/* On a phone the player can be thrown away downward, like the event sheet.
   The gesture starts on the surround, since the video keeps its own touches. */
(() => {
  const box = document.getElementById("video"), panel = document.getElementById("videoPanel");
  let y0 = 0, x0 = 0, dy = 0, axis = "", on = false;
  box.addEventListener("touchstart", e => {
    on = e.touches.length === 1 && !e.target.closest("#videoClose");
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; axis = "";
  }, { passive:true });
  box.addEventListener("touchmove", e => {
    if(!on) return;
    const my = e.touches[0].clientY - y0, mx = e.touches[0].clientX - x0;
    if(!axis){
      if(Math.abs(my) < 8 && Math.abs(mx) < 8) return;
      axis = my > 0 && Math.abs(my) > Math.abs(mx) ? "y" : "no";
      if(axis === "y") box.setAttribute("data-drag", "");
    }
    if(e.cancelable) e.preventDefault();          /* the page behind must not move */
    if(axis !== "y") return;
    dy = Math.max(0, my);
    panel.style.transform = "translateY(" + dy.toFixed(1) + "px)";
    box.style.opacity = String(Math.max(.3, 1 - dy / 420));
  }, { passive:false });
  const lift = cancelled => () => {
    if(!on) return;
    on = false;
    const far = !cancelled && axis === "y" && dy > 90;
    box.removeAttribute("data-drag");
    if(far) closeVideo();
    else{ panel.style.transform = ""; box.style.opacity = ""; }
  };
  box.addEventListener("touchend", lift(false));
  box.addEventListener("touchcancel", lift(true));
})();
addEventListener("keydown", e => {
  if(e.key !== "Escape") return;
  if(document.getElementById("video").dataset.state === "open") closeVideo();
  else if(document.getElementById("sheet").dataset.state === "open") closeEvent();
});

/* YouTube always has a hqdefault frame but only sometimes a maxres one, and it
   answers a missing maxres with a small grey placeholder rather than an error.
   Measuring it is the only way to tell. */
function checkTrailerArt(){
  document.querySelectorAll(".slide-media[data-yt]").forEach(el => {
    if(el.dataset.checked === "1") return;
    el.dataset.checked = "1";
    const id = el.dataset.yt;
    const probe = new Image();
    probe.onload = () => {
      if(probe.naturalWidth <= 160) el.style.backgroundImage = cssUrl(ytArtFallback(id));
    };
    probe.onerror = () => { el.style.backgroundImage = cssUrl(ytArtFallback(id)); };
    probe.src = ytArt(id);
  });
}

/* ===================== ARTWORK ===================== */
addEventListener("contextmenu", e => {
  const t = e.target;
  if(t.closest && (t.closest(".art, .slide-media, .sheet-banner, .poster, .slide") || t.tagName === "IMG")){
    e.preventDefault();
  }
}, { capture:true });

addEventListener("dragstart", e => {
  const t = e.target;
  if(t.tagName === "IMG" || (t.closest && t.closest(".art, .slide-media, .sheet-banner"))) e.preventDefault();
}, { capture:true });

/* ===================== SCROLL RAILS =====================
   One rail per scrolling surface, drawn beside it rather than inside it.
   The surface keeps its full width and knows nothing about the rail.
   ======================================================== */
const RAILS = [];

function makeRail(opts){
  const rail = document.createElement("div");
  rail.className = "rail";
  rail.innerHTML = '<div class="rail-thumb"></div>';
  document.body.appendChild(rail);

  const thumb = rail.firstElementChild;
  const GAP = opts.gap === undefined ? 6 : opts.gap;
  const INSET = opts.inset === undefined ? 8 : opts.inset;
  const MIN = 34;

  let idle, dragging = false, trackH = 0, thumbH = 0;

  const box = () => opts.box();

  function paint(){
    const m = box();
    if(!m || m.scrollH - m.clientH < 4){ rail.classList.remove("show"); return; }

    trackH = Math.max(m.height - INSET * 2, 40);
    thumbH = Math.max(MIN, trackH * (m.clientH / m.scrollH));

    const span = m.scrollH - m.clientH;
    const pos = span > 0 ? (m.scrollTop / span) * (trackH - thumbH) : 0;

    rail.style.left = (m.right + GAP) + "px";
    rail.style.top = (m.top + INSET) + "px";
    rail.style.height = trackH + "px";
    thumb.style.height = thumbH + "px";
    thumb.style.transform = "translateY(" + Math.max(0, Math.min(pos, trackH - thumbH)) + "px)";
  }

  function show(){
    paint();
    const m = box();
    if(!m || m.scrollH - m.clientH < 4) return;
    rail.classList.add("show");
    clearTimeout(idle);
    if(!dragging) idle = setTimeout(() => rail.classList.remove("show"), 1400);
  }

  /* Dragging the thumb scrolls the surface, one pixel of rail to one page of travel. */
  thumb.addEventListener("pointerdown", e => {
    e.preventDefault();
    const m = box();
    if(!m) return;
    dragging = true;
    rail.classList.add("drag", "show");
    thumb.setPointerCapture(e.pointerId);

    const startY = e.clientY;
    const startTop = m.scrollTop;
    const span = m.scrollH - m.clientH;
    const travel = trackH - thumbH;

    const move = ev => {
      if(travel <= 0) return;
      opts.scrollTo(startTop + ((ev.clientY - startY) / travel) * span);
    };
    const up = () => {
      dragging = false;
      rail.classList.remove("drag");
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", up);
      thumb.removeEventListener("pointercancel", up);
      show();
    };
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", up);
    thumb.addEventListener("pointercancel", up);
  });

  /* Clicking the empty rail jumps a page. */
  rail.addEventListener("pointerdown", e => {
    if(e.target === thumb) return;
    const m = box();
    if(!m) return;
    const above = e.clientY < thumb.getBoundingClientRect().top;
    opts.scrollTo(m.scrollTop + (above ? -m.clientH : m.clientH) * 0.9);
  });

  rail.addEventListener("pointerenter", () => { clearTimeout(idle); rail.classList.add("show"); });
  rail.addEventListener("pointerleave", () => { if(!dragging) show(); });

  /* Moving the pointer toward the edge brings the rail back, so it can be
     grabbed without having to scroll first. */
  function near(x, y){
    const m = box();
    if(!m || m.scrollH - m.clientH < 4) return false;
    const left = m.right + GAP;
    return x > left - 34 && x < left + 26 && y > m.top && y < m.top + m.height;
  }

  const api = { paint, show, near, hide: () => { clearTimeout(idle); rail.classList.remove("show"); },
                el: rail };
  RAILS.push(api);
  return api;
}

/* The page itself. */
const pageRail = makeRail({
  box: () => ({
    top: 0, right: document.documentElement.clientWidth, height: innerHeight,
    scrollTop: scrollY, scrollH: document.documentElement.scrollHeight, clientH: innerHeight
  }),
  gap: -18,
  scrollTo: y => scrollTo({ top: y })
});

let quietUntil = 0;
addEventListener("scroll", () => { if(Date.now() > quietUntil) pageRail.show(); }, { passive: true });
addEventListener("resize", () => RAILS.forEach(r => r.paint()), { passive: true });

/* One shared pointer watcher rather than one per rail. */
let nearQueued = false;
addEventListener("pointermove", e => {
  if(nearQueued) return;
  nearQueued = true;
  requestAnimationFrame(() => {
    nearQueued = false;
    RAILS.forEach(r => {
      if(r.el.dataset.off === "1") return;
      if(r.near(e.clientX, e.clientY)) r.show();
    });
  });
}, { passive: true });

/* The event sheet, which scrolls inside itself. */
let sheetRail = null;
/* The sheet's scrolling region is rebuilt on every open, so the rail reads it
   by id each time. Holding a reference would leave the rail measuring a node
   that is no longer on the page. */
function sheetRailFor(){
  const live = () => document.getElementById("sheetScroll");

  if(!sheetRail){
    sheetRail = makeRail({
      box: () => {
        const el = live();
        if(!el) return null;
        const b = el.getBoundingClientRect();
        if(!b.height) return null;
        return { top: b.top, right: b.right, height: b.height,
                 scrollTop: el.scrollTop, scrollH: el.scrollHeight, clientH: el.clientHeight };
      },
      gap: 8,
      scrollTo: y => { const el = live(); if(el) el.scrollTop = y; }
    });
  }

  /* one listener per freshly built region */
  const el = live();
  if(el && el.dataset.railed !== "1"){
    el.dataset.railed = "1";
    el.addEventListener("scroll", () => sheetRail.show(), { passive: true });
  }
  return sheetRail;
}

let TIMERS = [];

function initCarousels(){
  TIMERS.forEach(clearInterval); TIMERS = [];

  document.querySelectorAll("[data-carousel]").forEach(c => {
    const track = c.querySelector(".track"), pips = [...c.querySelectorAll(".cdots button")];
    const real = [...track.children];
    const n = real.length;
    if(!n) return;

    /* A copy of the last slide goes in front and a copy of the first goes
       behind, so moving past either end lands on a copy. Once the scroll
       settles the track jumps, without animation, to the matching real slide.
       The reader sees one continuous ribbon rather than a rewind. */
    const loop = n > 1;
    if(loop){
      const head = real[n - 1].cloneNode(true);
      const tail = real[0].cloneNode(true);
      [head, tail].forEach(cl => {
        cl.dataset.clone = "1";
        cl.setAttribute("aria-hidden", "true");
        cl.querySelectorAll("a,button,[tabindex]").forEach(el => el.setAttribute("tabindex", "-1"));
      });
      track.insertBefore(head, track.firstChild);
      track.appendChild(tail);
    }

    const slides = [...track.children];
    const at = i => slides[i].offsetLeft - slides[0].offsetLeft;
    const first = loop ? 1 : 0;                     /* where the real slides begin */
    const pos = r => first + r;                     /* real index to physical index */
    const realOf = p => loop ? ((p - 1) % n + n) % n : p;

    const current = () => {
      let best = 0, min = Infinity;
      for(let i = 0; i < slides.length; i++){
        const d = Math.abs(at(i) - track.scrollLeft);
        if(d < min){ min = d; best = i; }
      }
      return best;
    };

    let jumping = false;
    const jump = left => {
      jumping = true;
      const snap = track.style.scrollSnapType;
      track.style.scrollSnapType = "none";        /* snapping fights an instant move */
      track.scrollLeft = left;
      requestAnimationFrame(() => {
        track.style.scrollSnapType = snap;
        jumping = false;
      });
    };

    /* Standing on a copy means the ribbon has wrapped. Swap to the real one. */
    const normalise = () => {
      if(!loop || jumping) return false;
      const p = current();
      if(p === 0){ jump(at(n)); return true; }
      if(p === n + 1){ jump(at(1)); return true; }
      return false;
    };

    const step = d => track.scrollTo({ left: at(Math.max(0, Math.min(slides.length - 1, current() + d))), behavior: "smooth" });
    const goTo = r => track.scrollTo({ left: at(pos(((r % n) + n) % n)), behavior: "smooth" });

    const sync = () => {
      if(normalise()) return;                     /* the jump fires its own scroll */
      const r = realOf(current());
      pips.forEach((d, i) => d.classList.toggle("on", i === r));
      slides.forEach((sl, i) => sl.classList.toggle("is-current", i === current()));
    };

    if(loop) jump(at(1));                          /* open on the first real slide */
    sync();

    track.addEventListener("scroll", () => {
      clearTimeout(track._t);
      track._t = setTimeout(sync, 90);
    }, { passive:true });

    pips.forEach((d, i) => d.addEventListener("click", () => goTo(i)));
    c.querySelector(".prev")?.addEventListener("click", () => step(-1));
    c.querySelector(".next")?.addEventListener("click", () => step(1));

    let timer, paused = false, resume;
    const hold = () => { paused = true; clearTimeout(resume); resume = setTimeout(() => paused = false, 9000); };
    ["pointerenter","pointerdown","focusin","touchstart"].forEach(ev => c.addEventListener(ev, hold, { passive:true }));
    ["pointerleave","focusout"].forEach(ev => c.addEventListener(ev, () => { clearTimeout(resume); paused = false; }));

    if(loop && !reduceMotion()){
      timer = setInterval(() => { if(!paused) step(1); }, 6500);
      TIMERS.push(timer);
    }
  });
}

/* ===================== SWIPEABLE SEGMENTS ===================== */
function segmented(id, items, label, current){
  const pick = items.some(([v]) => v === current) ? current : items[0][0];
  return '<div class="seg glass" id="'+id+'" role="group" aria-label="'+label+'"><span class="seg-thumb"></span>'+
    items.map(([v,l]) => '<button type="button" data-v="'+esc(v)+'" aria-pressed="'+(v === pick)+'">'+esc(l)+'</button>').join("")+'</div>';
}
function moveThumb(seg){
  const on = seg.querySelector('[aria-pressed="true"]'), thumb = seg.querySelector(".seg-thumb");
  if(!on || !thumb) return;
  thumb.style.width = on.offsetWidth + "px";
  thumb.style.transform = "translateX(" + on.offsetLeft + "px)";
  const l = on.offsetLeft - seg.scrollLeft, r = l + on.offsetWidth;
  if(l < 0 || r > seg.clientWidth) seg.scrollTo({ left: on.offsetLeft - (seg.clientWidth - on.offsetWidth)/2, behavior:"smooth" });
}
function dragScroll(el){
  let down = false, x0 = 0, s0 = 0, moved = 0;
  el.addEventListener("pointerdown", e => { down = true; moved = 0; x0 = e.clientX; s0 = el.scrollLeft; el.setAttribute("data-drag", ""); });
  el.addEventListener("pointermove", e => {
    if(!down) return;
    const dx = e.clientX - x0; moved = Math.max(moved, Math.abs(dx));
    if(moved > 4) el.scrollLeft = s0 - dx;
  });
  ["pointerup","pointercancel","pointerleave"].forEach(ev => el.addEventListener(ev, () => { down = false; el.removeAttribute("data-drag"); }));
  el.addEventListener("click", e => { if(moved > 6){ e.preventDefault(); e.stopPropagation(); } }, true);
}
function segEdge(seg){
  const over = seg.scrollWidth > seg.clientWidth + 2;
  seg.toggleAttribute("data-overflow", over);
  seg.toggleAttribute("data-end", over && seg.scrollLeft + seg.clientWidth >= seg.scrollWidth - 4);
}
function wireSegments(onChange){
  document.querySelectorAll(".seg").forEach(seg => {
    segEdge(seg);
    seg.addEventListener("scroll", () => segEdge(seg), { passive:true });
    dragScroll(seg);
    requestAnimationFrame(() => moveThumb(seg));
    if(document.fonts) document.fonts.ready.then(() => moveThumb(seg));
    seg.addEventListener("click", e => {
      const b = e.target.closest("button"); if(!b) return;
      seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      moveThumb(seg); onChange && onChange();
    });
  });
}
addEventListener("resize", () => document.querySelectorAll(".seg").forEach(seg => { moveThumb(seg); segEdge(seg); }));

/* ===================== EVENT SHEET ===================== */
let lastFocus = null, sheetHide = 0;

const SHEET_CHROME = '<div class="grabber"></div>' +
  '<button class="sheet-close" id="sheetClose" aria-label="Close">'+ICON.close+'</button>';

function sheetOpen(html){  const b = document.getElementById("sheet"), inner = document.getElementById("sheetInner");
  clearTimeout(sheetHide);                    /* reopened while still closing */
  const wasOpen = b.dataset.state === "open";
  if(!wasOpen) lastFocus = document.activeElement;
  b.dataset.state = "open";

  inner.innerHTML = SHEET_CHROME +
    '<div class="sheet-scroll" id="sheetScroll">' + html + '</div>';

  const scroll = document.getElementById("sheetScroll");
  scroll.scrollTop = 0;

  if(!wasOpen){
    b.hidden = false;
    lockScroll(true);
    requestAnimationFrame(() => { if(b.dataset.state === "open") b.classList.add("open"); });
  }
  const x = document.getElementById("sheetClose");
  if(x){ x.addEventListener("click", closeEvent); x.focus(); }

  wireSheetDrag(inner);

  /* The rail belongs to the scrolling region, not the panel, and appears once
     the opening transition has settled so it is not measured mid flight. */
  const rail = sheetRailFor();
  pageRail.hide();
  pageRail.el.dataset.off = "1";              /* the page cannot be scrolled while the sheet is open */
  rail.el.dataset.off = "0";
  setTimeout(() => rail.show(), 380);
}

/* Pull the panel down to let it go, the way a sheet behaves on a phone.

   This uses touch events rather than pointer events on purpose. The panel
   allows vertical panning so its content can scroll, and once the browser
   decides a gesture is a scroll it cancels the pointer stream. A non passive
   touchmove can still veto the scroll while the content is already at the top,
   which is exactly when the pull should take over. */
function wireSheetDrag(panel){
  if(panel.dataset.drag === "1") return;
  panel.dataset.drag = "1";

  /* The scrolling region is rebuilt every time the sheet opens, so it is
     looked up on each gesture rather than captured once. A captured node goes
     stale on the second open and reports a scroll position of zero forever. */
  const scroller = () => document.getElementById("sheetScroll");

  const back = document.getElementById("sheet");
  let y0 = 0, dy = 0, live = false, armed = false, t0 = 0;

  const paint = d => {
    panel.style.transform = d ? "translateY(" + d.toFixed(1) + "px)" : "";
    back.style.opacity = d ? String(Math.max(.12, 1 - d / (innerHeight * .8))) : "";
  };
  const rest = () => {
    live = false; armed = false; dy = 0;
    back.removeAttribute("data-drag");
    panel.style.transform = "";
    back.style.opacity = "";
  };

  panel.addEventListener("touchstart", e => {
    if(e.touches.length !== 1) { armed = false; return; }
    const t = e.touches[0];
    if(t.target && t.target.closest && t.target.closest("a,button")) { armed = false; return; }
    /* Either the content is already at the top, or the finger is on the grip. */
    const onGrip = (t.clientY - panel.getBoundingClientRect().top) < 34;
    const sc = scroller();
    armed = onGrip || !sc || sc.scrollTop <= 0;
    y0 = t.clientY; dy = 0; t0 = Date.now();
  }, { passive:true });

  panel.addEventListener("touchmove", e => {
    if(!armed || e.touches.length !== 1) return;
    const d = e.touches[0].clientY - y0;

    if(!live){
      if(d < 8) return;                       /* wait for a clear downward pull */
      const sc = scroller();
      if(sc && sc.scrollTop > 0){ armed = false; return; }
      live = true;
      back.setAttribute("data-drag", "");
    }
    if(e.cancelable) e.preventDefault();      /* the pull wins over the scroll */
    dy = d < 0 ? 0 : (d > 180 ? 180 + (d - 180) * .45 : d);
    paint(dy);
  }, { passive:false });

  const finish = () => {
    if(!live){ armed = false; return; }
    const flick = (Date.now() - t0) < 380 && dy > 46;
    const far = dy > Math.min(150, innerHeight * .18);
    if(far || flick){
      rest();
      closeEvent();
    }else{
      rest();                                   /* spring home under its own transition */
    }
  };
  panel.addEventListener("touchend", finish);
  panel.addEventListener("touchcancel", () => { if(live) rest(); else armed = false; });
}

function openEvent(i){
  const e = state.events[i]; if(!e) return;
  const span = fmtDate(e.date_start) + (e.date_end && e.date_end !== e.date_start ? " – " + fmtDate(e.date_end) : "");
  const facts = [["When", [span, e.time].filter(Boolean).join(", ")],
    ["Where", [e.venue, e.city].filter(Boolean).join(", ")], ["Price", e.price]].filter(([,v]) => v);
  sheetOpen(
    '<div class="sheet-banner"'+(safeUrl(e.banner_url) ? ' style="background-image:'+bg(e.banner_url)+'"' : "")+'></div>'+
    '<div class="sheet-body">'+(e.category ? '<span class="pill hot">'+esc(e.category)+'</span>' : "")+
      '<h2 id="sheetTitle" class="sheet-title">'+esc(e.title)+'</h2>'+
      factList(facts)+
      (e.description ? '<div class="prose sheet-prose">'+paras(e.description)+'</div>' : "")+
      (safeUrl(e.ticket_url) ? '<div class="actions"><a class="btn prominent" href="'+esc(safeUrl(e.ticket_url))+'" target="_blank" rel="noopener">Get tickets</a></div>' : "")+
    '</div>');
}

function closeEvent(){
  const b = document.getElementById("sheet");
  if(b.dataset.state !== "open") return;
  b.dataset.state = "closed";
  b.classList.remove("open");
  b.removeAttribute("data-drag");
  b.style.opacity = "";
  const panel = document.getElementById("sheetInner");
  if(panel) panel.style.transform = "";
  lockScroll(false);
  if(sheetRail){ sheetRail.hide(); sheetRail.el.dataset.off = "1"; }
  pageRail.el.dataset.off = "0";
  sheetHide = setTimeout(() => { b.hidden = true; }, 340);
  lastFocus?.focus();
}

let heldY = 0;
function lockScroll(on){
  const body = document.body;
  if(on){
    if(body.classList.contains("locked")) return;   /* already held; keep the first position */
    heldY = window.scrollY;
    body.style.top = -heldY + "px";
    body.classList.add("locked");
  }else if(body.classList.contains("locked")){
    body.classList.remove("locked");
    body.style.top = "";
    /* Putting the page back where it was is not a scroll the reader made,
       so the rail should not flash on the way out. */
    quietUntil = Date.now() + 400;
    window.scrollTo(0, heldY);
  }
}

/* keyboard focus stays inside the sheet while it is open */
addEventListener("keydown", e => {
  const b = document.getElementById("sheet");
  if(e.key !== "Tab" || b.hidden) return;
  const items = b.querySelectorAll("button, a[href]");
  if(!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});

document.getElementById("sheet").addEventListener("click", e => { if(e.target.id === "sheet") closeEvent(); });

document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-event]");
  if(t) openEvent(Number(t.dataset.event));
});

/* ===================== ROWS & SLIDES ===================== */
function reviewSlide(r){
  const art = slideArt(r);
  return '<div class="slide">'+ media(art.url, art.yt) +'<div class="slide-veil"></div>'+
    '<a class="slide-hit" href="'+reviewHref(r)+'" aria-label="'+esc(r.title)+'"></a>'+
    (art.yt ? playButton(art.yt, r.title) : "")+
    '<div class="slide-bar"><div class="slide-txt">'+
      '<h2>'+esc(r.title)+'</h2>'+
      '<div class="meta">'+(unreleased(r) ? esc(releaseLine(r)) : dots([r.year,r.language,runtime(r.runtime_min)]))+'</div>'+
    '</div><div class="slide-act">'+mark(r,"lg")+'</div></div></div>';
}

/* The play control sits outside the link, so a tap on it opens the trailer
   and a tap anywhere else opens the film. */
function playButton(id, title){
  return '<button class="play" data-yt="'+esc(id)+'" aria-label="Play the trailer for '+esc(title)+'">'+
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">'+
      '<path d="M8 5.2v13.6a.6.6 0 0 0 .93.5l10.5-6.8a.6.6 0 0 0 0-1l-10.5-6.8A.6.6 0 0 0 8 5.2Z" fill="currentColor"/>'+
    '</svg><span>Trailer</span></button>';
}
function eventSlide(e){
  const i = state.events.indexOf(e);
  return '<div class="slide">'+ media(e.banner_url, "") +'<div class="slide-veil"></div>'+
    '<button class="slide-hit" data-event="'+i+'" aria-label="'+esc(e.title)+'"></button>'+
    '<div class="slide-bar"><div class="slide-txt">'+
      (e.category ? '<p class="eyebrow">'+esc(e.category)+'</p>' : "")+
      '<h2>'+esc(e.title)+'</h2>'+
      '<div class="meta">'+dots([fmtDate(e.date_start), e.time, e.venue, e.city])+'</div>'+
    '</div><div class="slide-act"><button type="button" class="btn prominent" data-event="'+i+'" tabindex="-1">Details</button>'+
      (e.price ? '<span class="price">From '+esc(e.price)+'</span>' : "")+
    '</div></div></div>';
}
/* A YouTube id out of any of the shapes a link can take. */
function ytId(url){
  const u = safeUrl(url);
  if(!u) return "";
  const m = u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}
/* maxres is the wide, clean frame. It does not exist for every video, so the
   page checks and falls back to the one that always does. */
const ytArt = id => "https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg";
const ytArtFallback = id => "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";

/* The artwork for a slide, preferring the trailer frame because it is shot
   wide, which is the shape a banner needs. */
function slideArt(r){
  const id = ytId(r.trailer_url) || ytId(r.teaser_url);
  if(id) return { url: ytArt(id), yt: id };
  return { url: r.banner_url || r.poster_url, yt: "" };
}

const featured = (arr, fallbackAll) => {
  const f = arr.filter(isFeatured).slice(0, CONFIG.MAX_FEATURED);
  return f.length ? f : arr.slice(0, fallbackAll ? 1 : 0);
};

/* ===================== PAGES ===================== */
function pageHome(){
  const banners = featured(state.reviews, true).map(reviewSlide);
  const next = state.events.filter(upcoming).sort(byDate("date_start")).slice(0,5);
  const reviewed = state.reviews.filter(r => !unreleased(r));
  const soon = state.reviews.filter(unreleased).sort(byDate("release_date"));
  let h = banners.length ? '<div class="wrap">'+carousel(banners,"c-home")+'</div>' : "";
  h += '<div class="wrap"><section><div class="sec-head"><h2>Latest</h2><a href="#/movies">See all</a></div>'+
    (reviewed.length ? '<div class="grid">'+reviewed.slice(0,10).map(card).join("")+'</div>'
      : '<div class="empty">No reviews yet.</div>')+'</section>'+
    (soon.length ? '<section><div class="sec-head"><h2>Coming soon</h2><a href="#/calendar">View calendar</a></div>'+
      '<div class="grid">'+soon.slice(0,10).map(card).join("")+'</div></section>' : "")+
    (next.length ? '<section><div class="sec-head"><h2>Upcoming events</h2><a href="#/events">See all</a></div>'+
      '<div class="er-list">'+next.map(e => eventCard(e, false)).join("")+'</div></section>' : "")+'</div>';
  return h;
}

function pageMovies(){
  const reviewed = state.reviews.filter(r => !unreleased(r));
  const soon = state.reviews.filter(unreleased).sort(byDate("release_date"));
  const banners = featured(state.reviews, false).map(reviewSlide);
  const langs = [...new Set(reviewed.map(r => r.language).filter(Boolean))].sort();

  return '<div class="wrap">'+ (banners.length ? carousel(banners,"c-mov") : "") +
    '<section'+(banners.length ? "" : ' class="page-top"')+'><div class="sec-head"><h2>Reviews</h2>'+
      '<span class="meta">'+reviewed.length+' movie'+(reviewed.length === 1 ? "" : "s")+'</span></div>'+
      '<div class="toolbar"><label class="search glass">'+ICON.search+
        '<input id="q" type="search" placeholder="Search movies" aria-label="Search movies" value="'+esc(movieView.q)+'"></label>'+
        segmented("sort",[["new","Newest"],["rating","Top rated"],["az","A–Z"]],"Sort reviews", movieView.sort)+
        (langs.length > 1 ? segmented("lang",[["","All"],...langs.map(l => [l,l])],"Filter by language", movieView.lang) : "")+
      '</div><div id="results" class="grid"></div></section>'+
    (soon.length ? '<section><div class="sec-head"><h2>Coming soon</h2><a href="#/calendar">View calendar</a></div>'+
      '<div class="grid">'+soon.map(card).join("")+'</div></section>' : "")+
    '</div>';
}
const segValue = id => document.querySelector("#"+id+' [aria-pressed="true"]')?.dataset.v ?? "";
/* Kept between redraws, so a background refresh never wipes a search. */
const movieView = { q:"", sort:"new", lang:"" };
function applyFilters(){
  movieView.q = document.getElementById("q")?.value || "";
  movieView.sort = segValue("sort") || "new";
  movieView.lang = segValue("lang");
  const q = movieView.q.toLowerCase().trim(), lang = movieView.lang, sort = movieView.sort;
  let rows = state.reviews.filter(r => !unreleased(r)).filter(r =>
    (!q || [r.title,r.director,r.cast,r.genres,r.year].join(" ").toLowerCase().includes(q)) &&
    (!lang || r.language === lang));
  const when = r => parseDate(r.review_date)?.getTime() || parseDate(r.release_date)?.getTime() || 0;
  if(sort === "rating") rows.sort((a,b)=>(num(b.rating)||0)-(num(a.rating)||0));
  else if(sort === "az") rows.sort((a,b)=>String(a.title).localeCompare(String(b.title)));
  else rows.sort((a,b)=> when(b) - when(a));
  const el = document.getElementById("results");
  if(el) el.innerHTML = rows.length ? rows.map(card).join("")
    : '<div class="empty" style="grid-column:1/-1">No results.</div>';
  initTilt();
}

function pageReview(slug){
  const r = slug ? state.reviews.find(x => slugOf(x) === slug) : null;
  if(!r) return notFound();
  const soon = unreleased(r);
  /* The line under the title already carries year, language and runtime for a
     released film, so the table only repeats them for one still to come. */
  const facts = [["Director",r.director],["Cast",list(r.cast).join(", ")],["Genre",list(r.genres).join(", ")],
    ["Producer",r.producer],["Runtime", soon ? runtime(r.runtime_min) : ""],["Language", soon ? r.language : ""],
    ["In cinemas", r.release_date ? fmtDate(r.release_date) : ""],["Watch on",r.watch_on]].filter(([,v]) => v);
  const clips = [["Trailer", safeUrl(r.trailer_url), "prominent"], ["Teaser", safeUrl(r.teaser_url), "quiet"]]
    .filter(([,u]) => u)
    .map(([label,u,style]) => { const id = ytId(u); return id
      ? '<button type="button" class="btn '+style+'" data-yt="'+id+'">'+ICON.play+label+'</button>'
      : '<a class="btn '+style+'" href="'+esc(u)+'" target="_blank" rel="noopener">'+ICON.play+label+'</a>'; }).join("");
  const body = paras(r.review_body || r.synopsis);
  const badge = mark(r, "lg");
  /* The written review if there is one, otherwise the synopsis, otherwise a
     note that the review comes once the film is out. */
  const label = r.review_body ? "Kaydee review" : r.synopsis ? "Synopsis" : soon ? "Kaydee review" : "";
  return '<div class="wrap rise"><section class="page-top"><a class="backlink" href="#/movies">'+ICON.left+'Movies</a>'+
    '<div class="detail">'+
      '<div class="detail-head">'+(soon ? '<p class="eyebrow">Coming soon</p>' : "")+
        '<h1 class="detail-title">'+esc(r.title)+'</h1>'+
        '<div class="meta">'+(soon ? '<span class="card-soon">'+esc(releaseLine(r))+'</span>'
          : dots([r.year,r.language,runtime(r.runtime_min)]))+'</div></div>'+
      '<div class="detail-side">'+poster(r,false)+
        (badge ? '<div class="detail-score">'+badge+'</div>' : "")+
        (r.verdict ? '<div class="detail-verdict">'+esc(r.verdict)+'</div>' : "")+'</div>'+
      '<div class="detail-body">'+
        (clips ? '<div class="actions" style="margin:0 0 22px">'+clips+'</div>' : "")+
        factList(facts)+
        (label ? '<h2 class="rv-label">'+label+'</h2>' : "")+
        (body ? '<div class="prose">'+body+'</div>' : "")+
        (soon && !r.review_body ? '<p class="meta">Review to follow after release.</p>' : "")+
      '</div></div></section></div>';
}

/* The address organisers use to send an event in. */
const LIST_MAIL = () => "mailto:" + CONFIG.EMAIL + "?subject=List%20my%20event";
const PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';
/* Ended, but within the last three days. After that an event leaves the page. */
const recentPast = e => {
  const d = parseDate(e.date_end || e.date_start);
  return !!d && !upcoming(e) && d.getTime() >= today0() - 3 * 864e5;
};
const catKey = e => String(e.category || "").trim().toLowerCase() || "other";

/* One row design for every dated item on the site: events, and film release
   days in the calendar. A red date strip, a tag, the title and one line. */
function rowCard(o){
  const d = o.date;
  return '<'+o.tag+' class="er'+(o.past ? " er-past" : "")+'" '+o.attrs+' aria-label="'+esc(o.label)+'">'+
    '<span class="er-date">'+(d
      ? '<b>'+String(d.getDate()).padStart(2,"0")+'</b><span>'+MON[d.getMonth()].toUpperCase()+'</span><span>'+d.getFullYear()+'</span>'
      : '<b>TBA</b>')+'</span>'+
    '<span class="er-body">'+(o.pill ? '<span class="pill'+(o.past ? "" : " hot")+'">'+esc(o.pill)+'</span>' : "")+
      '<span class="er-title">'+esc(o.title)+'</span>'+
      (o.sub ? '<span class="er-where">'+(o.icon || "")+'<span>'+esc(o.sub)+'</span></span>' : "")+
    '</span><span class="chev" aria-hidden="true">'+ICON.right+'</span></'+o.tag+'>';
}
function eventCard(e, past){
  const d = parseDate(e.date_start), where = [e.venue, e.city].filter(Boolean).join(", ");
  return rowCard({ tag:"button", attrs:'type="button" data-event="'+state.events.indexOf(e)+'" data-cat="'+esc(catKey(e))+'"',
    date:d, past, pill:e.category, title:e.title, icon:PIN,
    sub:[e.time, where].filter(Boolean).join(" · "),
    label:[e.title, d ? fmtDate(e.date_start) : "Date TBA", e.venue].filter(Boolean).join(", ") });
}
function filmCard(r){
  const d = parseDate(r.release_date);
  return rowCard({ tag:"a", attrs:'href="'+reviewHref(r)+'"', date:d, past: !!d && d.getTime() < today0(),
    pill:"Movie", title:r.title, sub:[r.language, runtime(r.runtime_min)].filter(Boolean).join(" · "),
    label:[r.title, releaseLine(r)].join(", ") });
}

function pageEvents(){
  const up = state.events.filter(upcoming).sort(byDate("date_start"));
  const past = state.events.filter(recentPast).sort((a,b) => byDate("date_start")(b,a));
  const banners = featured(up, false).map(eventSlide);

  /* Chips come from the categories in use, so none of them can come up empty. */
  const cats = new Map();
  up.concat(past).forEach(e => { const k = catKey(e); if(!cats.has(k)) cats.set(k, k === "other" ? "Others" : String(e.category).trim()); });
  const chips = [...cats].sort((a,b) => (a[0] === "other") - (b[0] === "other") || a[1].localeCompare(b[1]));

  let h = '<div class="wrap">'+ (banners.length ? carousel(banners,"c-ev") : "") +
    '<section'+(banners.length ? "" : ' class="page-top"')+'>'+
    '<div class="sec-head"><h2>Upcoming events</h2><a href="#/calendar">View calendar</a></div>'+
    (chips.length > 1 ? '<div class="er-filter">'+segmented("evcat", [["","All"], ...chips], "Filter events")+'</div>' : "");
  h += up.length ? '<div class="er-list" id="evUp">'+up.map(e => eventCard(e, false)).join("")+'</div>'
    : '<div class="empty">No upcoming events yet.</div>';
  h += '<div class="empty" id="evNone" hidden>No results.</div>';
  if(past.length) h += '<div class="sec-head" style="margin-top:36px"><h2>Just ended</h2></div>'+
    '<div class="er-list">'+past.map(e => eventCard(e, true)).join("")+'</div>';
  h += '<div class="er-promo"><span class="er-promo-ico">'+ABOUT_ICON.cal+'</span>'+
      '<div><small>Organising an event?</small><h3>Reach more people</h3><p>List your event and get featured on kaydee.my.</p></div>'+
      '<a class="btn prominent" href="'+esc(LIST_MAIL())+'">List your event</a></div>'+
    '<p class="fine">Event submissions and promotion are subject to terms and conditions.</p>';
  return h + '</section></div>';
}
function filterEvents(){
  const v = segValue("evcat");
  let shown = 0;
  document.querySelectorAll(".er[data-cat]").forEach(r => {
    r.hidden = !!v && r.dataset.cat !== v;
    if(!r.hidden && !r.classList.contains("er-past")) shown++;
  });
  const none = document.getElementById("evNone"), upList = document.getElementById("evUp");
  if(none) none.hidden = !(upList && shown === 0);
}

/* ===================== CALENDAR ===================== */
const WEEKDAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let kcMonth = null, kcPick = null;     /* first day of the month on show, and the chosen day's key */

function calendarMap(){
  const map = {};
  const put = (k, v) => { (map[k] = map[k] || []).push(v); };
  state.reviews.forEach(r => { const d = parseDate(r.release_date); if(d) put(dayKey(d), { kind:"film", ref:r }); });
  state.events.forEach(e => {
    const a = parseDate(e.date_start); if(!a) return;
    const end = parseDate(e.date_end), b = end && end > a ? end : a;
    /* A bad end date must not be able to spin this loop for years. */
    for(let d = new Date(a), n = 0; d <= b && n < 62; d.setDate(d.getDate() + 1), n++) put(dayKey(d), { kind:"event", ref:e });
  });
  return map;
}
const dayRow = it => it.kind === "film" ? filmCard(it.ref) : eventCard(it.ref, !upcoming(it.ref));

/* Moves to a month and returns the direction travelled. With no day given,
   this month selects today and any other month shows its whole listing. */
function kcShow(y, m, pick){
  const to = new Date(y, m, 1), turn = to > kcMonth ? "next" : to < kcMonth ? "prev" : "";
  const now = new Date();
  kcMonth = to;
  kcPick = pick || (now.getFullYear() === to.getFullYear() && now.getMonth() === to.getMonth() ? dayKey(now) : null);
  return turn;
}

/* "1 release, 2 events" for a screen reader, instead of a bare number. */
const dayCount = items => {
  const f = items.filter(i => i.kind === "film").length, e = items.length - f;
  return [f && f + (f === 1 ? " release" : " releases"), e && e + (e === 1 ? " event" : " events")].filter(Boolean).map(x => ", " + x).join("");
};
function kcView(){
  const map = calendarMap(), today = dayKey(new Date());
  const y = kcMonth.getFullYear(), m = kcMonth.getMonth(), len = new Date(y, m + 1, 0).getDate();
  const lead = kcMonth.getDay();
  const picked = kcPick && kcPick.slice(0, 7) === dayKey(kcMonth).slice(0, 7) ? kcPick : null;
  const tabStop = picked || (today.slice(0, 7) === dayKey(kcMonth).slice(0, 7) ? today : dayKey(kcMonth));

  /* Always six weeks, so the card never changes height between months. */
  let cells = "";
  for(let i = 0; i < 42; i++){
    const d = new Date(y, m, 1 - lead + i), key = dayKey(d), items = map[key] || [];
    cells += '<button type="button" class="kc-day" data-kc-day="'+key+'"'+(d.getMonth() !== m ? " data-kc-out" : "")+
      (key === today ? ' aria-current="date"' : "")+' aria-pressed="'+(key === picked)+'" tabindex="'+(key === tabStop ? 0 : -1)+'"'+
      ' aria-label="'+WEEKDAY[d.getDay()]+", "+d.getDate()+" "+MONTH[d.getMonth()]+" "+d.getFullYear()+
      dayCount(items)+'">'+
      '<span class="kc-num">'+d.getDate()+'</span><span class="kc-dots">'+
      items.slice(0, 3).map(it => '<i data-kc-kind="'+it.kind+'"></i>').join("")+'</span></button>';
  }

  /* The month's listing, each film or event once, under the first day it falls on. */
  const seen = new Set(), mine = picked ? (map[picked] || []) : [];
  mine.forEach(it => seen.add(it.ref));
  let films = 0, events = 0, rest = "";
  const tally = it => { if(it.kind === "film") films++; else events++; };
  mine.forEach(tally);
  for(let n = 1; n <= len; n++){
    const d = new Date(y, m, n), fresh = (map[dayKey(d)] || []).filter(it => !seen.has(it.ref));
    if(!fresh.length) continue;
    fresh.forEach(it => { seen.add(it.ref); tally(it); });
    rest += '<p class="kc-label">'+WEEKDAY[d.getDay()].slice(0, 3)+" "+n+" "+MON[m]+'</p>'+
      '<div class="er-list">'+fresh.map(dayRow).join("")+'</div>';
  }

  let agenda;
  if(picked){
    const d = parseDate(picked);
    agenda = '<p class="kc-when">'+(picked === today ? "Today" : WEEKDAY[d.getDay()])+'</p>'+
      '<h3 class="kc-date">'+d.getDate()+" "+MONTH[m]+" "+y+'</h3>'+
      (mine.length ? '<div class="er-list">'+mine.map(dayRow).join("")+'</div>'
                   : '<p class="empty">Nothing on this day.</p>')+
      (rest ? '<p class="kc-when" style="margin-top:30px">'+(mine.length ? "More in " : "In ")+MONTH[m]+'</p>'+rest : "");
  }else{
    agenda = '<h3 class="kc-date">'+MONTH[m]+" "+y+'</h3>'+
      (rest || '<p class="empty">Nothing in '+MONTH[m]+' yet.</p>');
  }

  return '<div class="kc-card">'+
      '<div class="kc-head"><h3 class="kc-title"><span>'+y+'</span>'+MONTH[m]+'</h3><div class="kc-nav">'+
        '<button type="button" class="kc-btn" data-kc="prev" aria-label="Previous month">'+ICON.left+'</button>'+
        '<button type="button" class="kc-btn" data-kc="today">Today</button>'+
        '<button type="button" class="kc-btn" data-kc="next" aria-label="Next month">'+ICON.right+'</button></div></div>'+
      '<div class="kc-week" aria-hidden="true">'+WEEKDAY.map(d => '<span>'+d.slice(0, 3)+'</span>').join("")+'</div>'+
      '<div class="kc-grid" role="group" aria-label="'+MONTH[m]+" "+y+'">'+cells+'</div>'+
      '<div class="kc-foot"><span><i></i>'+(films || "No")+' release'+(films === 1 ? "" : "s")+'</span>'+
        '<span><i data-kc-kind="event"></i>'+(events || "No")+' event'+(events === 1 ? "" : "s")+'</span></div>'+
    '</div><div class="kc-agenda">'+agenda+'</div>';
}

function pageCalendar(){
  if(!kcMonth){ const n = new Date(); kcMonth = new Date(n.getFullYear(), n.getMonth(), 1); kcPick = dayKey(n); }
  return '<div class="wrap rise"><section class="page-top"><h2>Calendar</h2>'+
    '<p class="sub">Releases and events, by date.</p>'+
    '<div class="kc" id="kcRoot">'+kcView()+'</div></section></div>';
}

const ABOUT_ICON = {
  film:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="m3 8 2-5h16l-2 5M8 3 6 8m8-5-2 5m7-5-2 5"/><path d="m10 11 5 3-5 3z"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h2m4 0h2m-8 4h2"/></svg>',
  people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></svg>',
  music:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  screen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 7h18l-2-4H5zM8 3l2 4m4-4 2 4"/></svg>',
  tent:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 12h18L12 3ZM5 12l-2 9m16-9 2 9M9 12v9m6-9v9M3 21h18"/></svg>',
  art:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m4 18 6-5 4 3 3-4 4 5"/></svg>'
};
const RATING_SCALE = [
  ["10","Masterpiece","An exceptional film that stays with you long after the credits."],
  ["8–9","Great","Highly recommended and well worth your time."],
  ["7","Above average","An enjoyable film with more strengths than flaws."],
  ["5–6","Average","A mixed experience with both highs and lows."],
  ["1–4","Below average","Falls short in important areas and is hard to recommend."]
];
function pageAbout(){
  const mail = esc(LIST_MAIL());
  const item = cls => (i, t, d) => '<div class="'+cls+'"><span class="ab-ico">'+ABOUT_ICON[i]+'</span><div><strong>'+t+'</strong><p>'+d+'</p></div></div>';
  const feat = item("ab-feat"), type = item("ab-type");
  return '<div class="wrap rise">'+
    '<section class="page-top ab-hero"><p class="eyebrow">About kaydee.my</p>'+
      '<h1>Movies, events &amp; everything in between.</h1>'+
      '<p class="ab-lead">kaydee.my brings film reviews and live event updates together for Malaysia and the region. From the latest movies and premieres to concerts, festivals and local gatherings, discover what is worth watching and what is happening around you.</p>'+
      '<div class="ab-feats">'+
        feat("film","Discover","Film reviews and clear ratings to help you decide what to watch.")+
        feat("cal","Explore","See upcoming events, venues and ticket information in one place.")+
        feat("people","Be part of it","Help more people discover local experiences and communities.")+
      '</div>'+
      '<div class="actions">'+
        '<a class="btn prominent" href="'+esc(CONFIG.INSTAGRAM)+'" target="_blank" rel="noopener">Instagram</a>'+
        '<a class="btn quiet" href="'+esc(CONFIG.TIKTOK)+'" target="_blank" rel="noopener">TikTok</a>'+
        '<a class="btn quiet" href="'+mail+'">List your event</a></div>'+
      '<p class="fine">Event submissions and promotion are subject to terms and conditions.</p>'+
    '</section>'+
    '<section class="ab-sec"><p class="eyebrow">Movie ratings</p><h2>How we score</h2>'+
      '<p class="ab-intro">Every film on kaydee.my receives a score out of 10. Our ratings consider the overall viewing experience, storytelling, craft and how well a movie delivers on its promise.</p>'+
      '<div class="ab-scores">'+RATING_SCALE.map(([n,l,d], i) =>
        '<article class="ab-score"'+(i ? "" : " data-top")+'><b>'+n+'</b><strong>'+l+'</strong><p>'+d+'</p></article>').join("")+'</div>'+
      '<p class="ab-note">Scores reflect kaydee.my’s editorial perspective. Your favourite film might be different, and that’s part of the conversation.</p>'+
    '</section>'+
    '<section class="ab-sec"><div class="ab-events"><div>'+
      '<p class="eyebrow">Events on kaydee.my</p><h2>Find out what’s happening around you.</h2>'+
      '<p class="ab-intro">From live performances and film premieres to festivals, exhibitions and neighbourhood gatherings, kaydee.my helps you discover events taking place across Malaysia and the region. Find dates, venues and ticket details, then plan something worth going out for.</p>'+
      '<p class="ab-intro">Organising something? Share your event with kaydee.my so more people can find it. Whether it’s a big show or a community get-together, local events deserve to be seen.</p>'+
      '<div class="actions"><a class="btn prominent" href="#/events">Explore events</a><a class="btn quiet" href="'+mail+'">List your event</a></div>'+
    '</div><div class="ab-types">'+
      type("music","Concerts","Live music, performances and tours.")+
      type("screen","Premieres","Special screenings and film events.")+
      type("tent","Festivals","Culture, food and community celebrations.")+
      type("art","Exhibitions","Art, creativity and special showcases.")+
    '</div></div></section></div>';
}
function notFound(){
  return '<div class="wrap"><section class="page-top"><div class="empty"><h2>Page not found</h2>'+
    '<p>It may have moved, or the link is incomplete.</p><a class="btn quiet" href="#/">Home</a></div></section></div>';
}

/* ===================== ROUTER ===================== */
function markNav(key){
  document.querySelectorAll(".tabs a, .tabbar a")
    .forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + key));
  placeTabPill();
}

/* ===================== TAB BAR HIGHLIGHT ===================== */
/* Rests the red highlight on the current tab, or hides it on a page that
   belongs to no tab. */
function placeTabPill(){
  const bar = document.getElementById("tabbar");
  const pill = bar && bar.querySelector(".tb-pill"), a = bar && bar.querySelector("a.on");
  if(!pill) return;
  if(!a || !a.offsetWidth){ pill.removeAttribute("data-tb-set"); return; }
  pill.style.width = a.offsetWidth + "px";
  pill.style.height = a.offsetHeight + "px";
  pill.style.transform = "translate(" + a.offsetLeft + "px," + a.offsetTop + "px)";
  pill.setAttribute("data-tb-set", "");
}

function wireTabPill(){
  const bar = document.getElementById("tabbar"), pill = bar.querySelector(".tb-pill");
  const tabs = () => [...bar.querySelectorAll("a")];
  let x0 = 0, y0 = 0, axis = "", hot = null, on = false;

  const clear = () => {
    bar.removeAttribute("data-tb-drag");
    tabs().forEach(a => a.removeAttribute("data-tb-hot"));
    hot = null; axis = ""; on = false;
  };
  const follow = x => {
    const box = bar.getBoundingClientRect(), all = tabs();
    const first = all[0], last = all[all.length - 1];
    /* The tab whose middle is nearest the finger. */
    const at = x - box.left;
    const near = all.reduce((best, a) =>
      Math.abs(a.offsetLeft + a.offsetWidth / 2 - at) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - at) ? a : best);
    if(near !== hot){
      if(hot) hot.removeAttribute("data-tb-hot");
      hot = near;
      hot.setAttribute("data-tb-hot", "");
      pill.style.width = hot.offsetWidth + "px";
    }
    const w = hot.offsetWidth;
    const left = Math.min(Math.max(at - w / 2, first.offsetLeft), last.offsetLeft + last.offsetWidth - w);
    pill.style.transform = "translate(" + left.toFixed(1) + "px," + hot.offsetTop + "px) scale(1.06)";
  };

  bar.addEventListener("touchstart", e => {
    on = e.touches.length === 1 && !!bar.querySelector("a.on");
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; axis = "";
  }, { passive:true });
  bar.addEventListener("touchmove", e => {
    if(!on) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if(!axis){
      if(Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      axis = Math.abs(mx) >= Math.abs(my) ? "x" : "y";
      if(axis === "x") bar.setAttribute("data-tb-drag", "");
    }
    if(axis !== "x") return;
    if(e.cancelable) e.preventDefault();         /* a drag is not a tap and not a scroll */
    follow(e.touches[0].clientX);
  }, { passive:false });
  const lift = cancelled => () => {
    if(!on) return;
    const to = !cancelled && axis === "x" && hot ? hot.getAttribute("href") : "";
    clear();
    if(to && to !== location.hash && !(to === "#/" && !location.hash)) location.hash = to;
    else placeTabPill();
  };
  bar.addEventListener("touchend", lift(false));
  bar.addEventListener("touchcancel", lift(true));

  /* Tab widths change when the font arrives or the phone is turned. */
  if("ResizeObserver" in window) new ResizeObserver(placeTabPill).observe(bar);
  else addEventListener("resize", placeTabPill);
}

function render(keepScroll){
  const app = document.getElementById("app");
  if(!app) return;
  const [, seg, raw] = (location.hash.replace(/^#/, "") || "/").split("/");
  let param = raw || "";
  try{ param = decodeURIComponent(param); }catch(e){}
  let html, key = "/" + (seg === "review" ? "movies" : (seg || ""));
  if(seg === "reviews"){ location.replace("#/movies"); return; }   // old links keep working

  if(state.status !== "ready"){
    app.innerHTML = stateView();
    markNav(key);
    const retry = document.getElementById("retry");
    if(retry) retry.addEventListener("click", () => {
      state.status = "loading"; render();
      loadData().then(() => safeRender(true));
    });
    return;
  }

  if(!seg) html = pageHome();
  else if(seg === "movies") html = pageMovies();
  else if(seg === "review") html = pageReview(param || "");
  else if(seg === "events") html = pageEvents();
  else if(seg === "calendar") html = pageCalendar();
  else if(seg === "about") html = pageAbout();
  else { html = notFound(); key = ""; }

  app.innerHTML = html;
  markNav(key);
  const named = { movies:"Movies", events:"Events", calendar:"Calendar", about:"About" }[seg];
  const film = seg === "review" ? state.reviews.find(x => slugOf(x) === param) : null;
  document.title = film ? film.title + " | kaydee.my" : named ? named + " | kaydee.my"
    : seg ? "Page not found | kaydee.my" : "kaydee.my | Movies, Events & Everything In Between";
  if(!keepScroll) scrollTo(0, 0);
  if(seg === "calendar") wireCalendar();
  if(seg === "movies"){
    applyFilters();
    wireSegments(applyFilters);
    const q = document.getElementById("q");
    if(q) q.addEventListener("input", applyFilters);
  }
  if(seg === "events") wireSegments(filterEvents);
  initCarousels();
  checkTrailerArt();
  initMotion(!keepScroll);
  pageRail.paint();
}

/* The three states the page can be in before content exists. */
const LIQUID =
  '<div class="liquid" aria-hidden="true">' +
    '<span class="halo"></span>' +
    '<svg class="liquid-svg" viewBox="0 0 160 160" preserveAspectRatio="xMidYMid meet">' +
      '<defs>' +
        '<radialGradient id="kdBody" cx=".36" cy=".28" r=".85">' +
          '<stop offset="0" stop-color="#FF8F97"/><stop offset=".3" stop-color="#F82233"/>' +
          '<stop offset=".72" stop-color="#F30219"/><stop offset="1" stop-color="#8E020D"/>' +
        '</radialGradient>' +
        '<filter id="kdGoo" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="5.2" result="blur"/>' +
          '<feColorMatrix in="blur" type="matrix" result="goo" ' +
            'values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -13"/>' +
          '<feComposite in="SourceGraphic" in2="goo" operator="atop"/>' +
        '</filter>' +
      '</defs>' +
      '<g class="lq-cluster">' +
        '<g filter="url(#kdGoo)" fill="url(#kdBody)">' +
          '<circle class="lq-core" cx="80" cy="80" r="18"/>' +
          '<g class="lq-arm lq-a1"><circle class="lq-sat lq-s1" cx="80" cy="80" r="12.5"/></g>' +
          '<g class="lq-arm lq-a2"><circle class="lq-sat lq-s2" cx="80" cy="80" r="9.5"/></g>' +
          '<g class="lq-arm lq-a3"><circle class="lq-sat lq-s3" cx="80" cy="80" r="7"/></g>' +
        '</g>' +
        '<circle class="lq-spec" cx="73" cy="72" r="4.6" fill="rgba(255,255,255,.55)"/>' +
      '</g>' +
    '</svg>' +
  '</div>';

function stateView(){
  const offline = state.status === "offline";
  const empty = state.status === "empty";

  let note = "";
  if(offline){
    note = '<div class="load-note"><strong>Nothing loaded</strong>' +
      '<p>Check your connection and try again.</p>' +
      '<button class="btn prominent" style="margin-top:20px" id="retry">Try again</button></div>';
  } else if(empty){
    note = '<div class="load-note"><strong>Nothing here yet</strong>' +
      '<p>Reviews and events are on the way.</p></div>';
  }

  return '<div class="wrap"><div class="load" role="status" aria-live="polite">' +
    '<div>' + LIQUID + note +
    '<span class="sr-only">' +
      (offline ? "Nothing loaded" : empty ? "Nothing here yet" : "Loading") +
    '</span></div></div></div>';
}

/* Redraws the calendar alone. The rest of the page is left as it is. */
function kcPaint(turn, focus){
  const root = document.getElementById("kcRoot");
  if(!root) return;
  root.innerHTML = kcView();
  if(turn) root.querySelector(".kc-grid").setAttribute("data-kc-turn", turn);
  if(focus){ const el = root.querySelector(focus); if(el) el.focus({ preventScroll:true }); }
}

function wireCalendar(){
  const root = document.getElementById("kcRoot");
  if(!root) return;
  const pickDay = d => kcPaint(kcShow(d.getFullYear(), d.getMonth(), dayKey(d)), '[data-kc-day="'+dayKey(d)+'"]');
  const turnBy = (step, focus) => kcPaint(kcShow(kcMonth.getFullYear(), kcMonth.getMonth() + step), focus);

  root.addEventListener("click", e => {
    const nav = e.target.closest("[data-kc]"), day = e.target.closest("[data-kc-day]");
    if(nav){
      const v = nav.dataset.kc, focus = '[data-kc="'+v+'"]';
      if(v === "today"){ const n = new Date(); kcPaint(kcShow(n.getFullYear(), n.getMonth()), focus); }
      else turnBy(v === "next" ? 1 : -1, focus);
    }else if(day){
      const d = parseDate(day.dataset.kcDay);
      if(d) pickDay(d);
    }
  });

  /* Arrow keys walk the days, Page Up and Page Down walk the months. */
  root.addEventListener("keydown", e => {
    const day = e.target.closest("[data-kc-day]");
    const d = day && parseDate(day.dataset.kcDay);
    if(!d) return;
    const y = d.getFullYear(), m = d.getMonth(), n = d.getDate();
    const month = step => new Date(y, m + step, Math.min(n, new Date(y, m + step + 1, 0).getDate()));
    const to = { ArrowLeft:() => new Date(y, m, n - 1), ArrowRight:() => new Date(y, m, n + 1),
      ArrowUp:() => new Date(y, m, n - 7), ArrowDown:() => new Date(y, m, n + 7),
      Home:() => new Date(y, m, n - d.getDay()), End:() => new Date(y, m, n + 6 - d.getDay()),
      PageUp:() => month(-1), PageDown:() => month(1) }[e.key];
    if(!to) return;
    e.preventDefault();
    pickDay(to());
  });

  /* A sideways swipe on the grid carries the month with the finger. An upward
     or downward one is left alone so the page scrolls as usual. */
  let g = null;
  root.addEventListener("touchstart", e => {
    const grid = e.target.closest(".kc-grid");
    if(!grid || e.touches.length !== 1){ g = null; return; }
    g = { grid, x:e.touches[0].clientX, y:e.touches[0].clientY, axis:"", dx:0 };
    grid.removeAttribute("data-kc-turn");
    grid.removeAttribute("data-kc-settle");
  }, { passive:true });
  root.addEventListener("touchmove", e => {
    if(!g) return;
    const mx = e.touches[0].clientX - g.x, my = e.touches[0].clientY - g.y;
    if(!g.axis){
      if(Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      g.axis = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y";
    }
    if(g.axis !== "x") return;
    if(e.cancelable) e.preventDefault();
    g.dx = mx;
    g.grid.style.transform = "translateX(" + (mx * .6).toFixed(1) + "px)";
    g.grid.style.opacity = String(Math.max(.35, 1 - Math.abs(mx) / (g.grid.clientWidth || 320)));
  }, { passive:false });
  const lift = cancelled => () => {
    const s = g; g = null;
    if(!s || s.axis !== "x") return;
    if(!cancelled && Math.abs(s.dx) > Math.min(64, (s.grid.clientWidth || 320) * .18)) turnBy(s.dx < 0 ? 1 : -1);
    else{
      s.grid.setAttribute("data-kc-settle", "");
      s.grid.style.transform = "";
      s.grid.style.opacity = "";
    }
  };
  root.addEventListener("touchend", lift(false));
  root.addEventListener("touchcancel", lift(true));
}

/* ===================== CHROME ===================== */
document.getElementById("tabs").innerHTML = NAV.map(([h,l]) => '<a href="#'+h+'">'+l+'</a>').join("");
document.getElementById("tabbar").innerHTML = '<span class="tb-pill" aria-hidden="true"></span>' + NAV.map(([h,l,i]) => '<a href="#'+h+'">'+ICON[i]+'<span>'+l+'</span></a>').join("");
document.getElementById("social").innerHTML =
  [["Instagram", CONFIG.INSTAGRAM, "instagram"], ["TikTok", CONFIG.TIKTOK, "tiktok"],
   ["Facebook", CONFIG.FACEBOOK, "facebook"], ["Email", "mailto:" + CONFIG.EMAIL, "mail"]]
  .map(([name, url, icon]) => '<a href="'+url+'" target="_blank" rel="noopener" title="'+name+
    '" aria-label="'+(icon === "mail" ? "Email kaydee.my" : "kaydee.my on " + name)+'">'+ICON[icon]+'</a>').join("");
document.getElementById("yr").textContent = new Date().getFullYear();

/* Measure the logo so it is shown whole at its own proportions. */
function fitLogo(){
  const probe = new Image();
  probe.onload = () => {
    const ar = probe.naturalWidth / probe.naturalHeight;
    document.documentElement.style.setProperty("--logo", 'url("' + CONFIG.LOGO + '")');
    document.documentElement.style.setProperty("--logo-ar", (ar || 1).toFixed(4));
    document.documentElement.classList.add("has-logo");
  };
  probe.onerror = () => document.documentElement.classList.remove("has-logo");
  probe.src = CONFIG.LOGO;
}
fitLogo();

const THEME_KEY = "kd_theme";
let mode = (() => {
  try{ const t = localStorage.getItem(THEME_KEY); if(t === "light" || t === "dark") return t; }catch(e){}
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
})();
function setTheme(m){
  document.documentElement.setAttribute("data-theme", m);
  document.documentElement.style.colorScheme = m;
  document.getElementById("themeBtn").innerHTML = m === "dark" ? ICON.sun : ICON.moon;
  document.querySelectorAll('meta[name="theme-color"]').forEach(x => x.setAttribute("content", m === "dark" ? "#000000" : "#F2F2F5"));
}
setTheme(mode);
document.getElementById("themeBtn").addEventListener("click", () => {
  mode = mode === "dark" ? "light" : "dark";
  setTheme(mode);
  try{ localStorage.setItem(THEME_KEY, mode); }catch(e){}
  const b = document.getElementById("themeBtn");
  if(!reduceMotion()){
    b.classList.remove("theme-spin"); void b.offsetWidth; b.classList.add("theme-spin");
    setTimeout(() => b.classList.remove("theme-spin"), 540);
  }
});

wireTabPill();

let lastY = 0;
addEventListener("scroll", () => {
  const bar = document.getElementById("tabbar"), y = scrollY;
  const top = document.getElementById("topbar");
  bar.classList.toggle("min", y > lastY && y > 180);
  top.classList.toggle("scrolled", y > 24);
  lastY = y;
}, { passive:true });
/* A page that fails to draw is replaced by the retry screen, never left blank. */
function safeRender(keepScroll){
  try{ render(keepScroll); return true; }
  catch(err){
    try{ localStorage.removeItem(STORE_KEY); }catch(e){}
    if(state.status === "ready"){ state.status = "offline"; try{ render(); }catch(e){} }
    return false;
  }
}
addEventListener("hashchange", () => { closeEvent(); closeVideo(); safeRender(); });

safeRender();             /* the loader paints first, so the page is never blank */
loadData().then(changed => { if(changed) safeRender(true); });
