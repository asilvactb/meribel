// Homepage experience: preloader, full-screen B&W hero with rolling countdown,
// a pinned scroll story, custom cursor and a 00/100 scroll counter.
// Photos: Unsplash (free licence), shown in black & white.

export const PHOTOS = [
  "1483521260200-abf26aaf98d6", // rider facing the peaks
  "1679261476716-7189b40e5397", // Méribel valley
  "1582491795316-0782a861c529", // summit at dusk
  "1454663501801-75a30ab23c6a", // Méribel lifts
  "1551036359-aaa8fdf6314b",    // chairlift at golden hour
  "1562429063-db53fd1027d8",    // chalets in the snow
];
export const photoUrl = (id, max = 2400) => {
  const w = Math.min(max, Math.max(800, Math.round((innerWidth * (devicePixelRatio || 1)) / 200) * 200));
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=72&w=${w}`;
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function el(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  kids.flat(Infinity).forEach(k => k != null && e.append(k instanceof Node ? k : document.createTextNode(String(k))));
  return e;
}

/* ---------- preloader: once per session ---------- */
export function preloader() {
  let seen = false; try { seen = sessionStorage.getItem("meribel_loaded") === "1"; } catch {}
  if (seen || reduced()) return Promise.resolve();
  const n = el("span", "ld-n", "000");
  const box = el("div", null,
    el("div", "ld-mark", el("span", null, "M"), el("span", null, "—"), el("span", null, "2"), el("span", null, "7")),
    el("div", "ld-foot", el("span", "lbl", "A preparar a descida"), n));
  box.id = "loader";
  document.body.append(box);
  // warm up the first photo while the counter runs
  const img = new Image(); img.src = photoUrl(PHOTOS[0]);
  return new Promise(res => {
    const t0 = performance.now(), dur = 1700;
    const step = now => {
      const p = clamp((now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      n.textContent = String(Math.round(e * 100)).padStart(3, "0");
      if (p < 1) return requestAnimationFrame(step);
      box.classList.add("out");
      try { sessionStorage.setItem("meribel_loaded", "1"); } catch {}
      setTimeout(() => box.remove(), 1200);
      res();
    };
    requestAnimationFrame(step);
  });
}

/* ---------- cursor: orange dot that grows on anything clickable ---------- */
let cursorOn = false;
export function cursor() {
  if (cursorOn || !matchMedia("(pointer:fine)").matches || reduced()) return;
  cursorOn = true;
  const c = el("div", "cursor"); document.body.append(c);
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener("pointermove", e => { x = e.clientX; y = e.clientY; c.classList.toggle("big", !!e.target.closest("a,button,select,.cell,.chip,label")); }, { passive: true });
  document.addEventListener("pointerleave", () => c.style.opacity = "0");
  document.addEventListener("pointerenter", () => c.style.opacity = "1");
  const loop = () => { cx += (x - cx) * .2; cy += (y - cy) * .2; c.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); };
  loop();
}

/* ---------- rolling digits ---------- */
function setRoll(box, str) {
  if (!box) return;
  while (box.children.length < str.length) {
    const strip = el("span", "strip", ...Array.from({ length: 10 }, (_, i) => el("span", null, i)));
    box.prepend(el("span", "dg", strip));
  }
  while (box.children.length > str.length) box.firstChild.remove();
  [...box.children].forEach((dg, i) => { dg.firstChild.style.transform = `translateY(${-Number(str[i]) * 10}%)`; });
}

/* ---------- snow with depth, drifting with the pointer ---------- */
function snow(canvas, host) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, flakes = [], wind = 0, target = 0, run = true;
  const mk = any => { const z = Math.random(); return { x: Math.random() * W, y: any ? Math.random() * H : -10, z, r: .5 + z * 2.4, v: .3 + z * 1.3, ph: Math.random() * 6.28 }; };
  const resize = () => {
    const r = devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * r; canvas.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    flakes = Array.from({ length: Math.round(Math.min(200, W * H / 8000)) }, () => mk(true));
  };
  host.addEventListener("pointermove", e => { target = ((e.clientX / W) - .5) * 2; });
  const tick = () => {
    if (run) {
      wind += (target - wind) * .02;
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.ph += .01 + f.z * .01; f.y += f.v; f.x += Math.sin(f.ph) * .4 + wind * (.3 + f.z);
        if (f.y > H + 10) Object.assign(f, mk(false));
        if (f.x > W + 10) f.x = -10; if (f.x < -10) f.x = W + 10;
        ctx.globalAlpha = .2 + f.z * .55;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fillStyle = "#E4E1D9"; ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { run = e.isIntersecting; }).observe(host);
  resize(); if (!reduced()) tick();
}

/* ---------- hero, built once ---------- */
let built = false;
export function buildHero(box, { start, end, onScrollDown, people = 0, families = 0 }) {
  if (built) return;
  built = true;
  const HERO = PHOTOS.slice(0, 5);
  const slides = HERO.map((id, i) => { const s = el("div", "slide" + (i === 0 ? " on" : "")); if (i < 2) s.style.backgroundImage = `url("${photoUrl(id)}")`; return s; });
  const media = el("div", "h-media", slides);
  const canvas = el("canvas", "h-snow");
  const dots = el("div", "h-dots", HERO.map((_, i) => el("i", i === 0 ? "on" : null)));
  const unit = (id, label) => el("div", "u", Object.assign(el("span", "roll"), { id }), el("small", null, label));
  const words = ["Méribel 2027", `${people} pessoas`, `${families} famílias`, "Les 3 Vallées", "600 km de pistas", "5 — 10 janeiro", "Après-ski", "Fondue", "Primeira descida"];
  const line = () => el("div", "mq-set", words.map(w => [el("span", null, w), el("b", null, "✱")]));
  const cta = el("a", "pill h-cta", "Ver o que falta tratar", el("span", null, "→")); cta.href = "#tratar";
  const down = el("button", "h-down", el("i"), el("span", null, "Scroll para explorar")); down.type = "button"; down.onclick = onScrollDown;
  box.replaceChildren(
    media, el("div", "h-shade"), canvas, el("div", "h-grain"),
    el("div", "h-top", el("span", "acc", "Méribel — Les 3 Vallées"), el("span", "hide-s", "45°24′N  6°34′E  ·  1450 m"), el("span", null, "05—10.01.2027")),
    el("div", "h-main",
      el("p", "h-kicker", el("i"), el("span", null, "Faltam")),
      el("div", "h-days", Object.assign(el("span", "roll big"), { id: "cd-d" }), el("span", "h-unit", "dias")),
      el("div", "h-clock", unit("cd-h", "horas"), unit("cd-m", "minutos"), unit("cd-s", "segundos")),
      el("div", "h-sub", el("span", "h-note"), cta)),
    dots, down,
    el("div", "h-marquee", el("div", "track", line(), line())),
    el("p", "h-credit", "Fotos · Unsplash"));

  // countdown
  const done = el("h2", "h-done");
  const paint = () => {
    const now = new Date(), ms = start - now;
    if (ms <= 0) {
      box.classList.add("live");
      done.textContent = now < end ? "Estamos na neve." : "Até à próxima.";
      if (!done.isConnected) box.querySelector(".h-main").prepend(done);
      return;
    }
    const d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60, ss = Math.floor(ms / 1e3) % 60;
    const p2 = n => String(n).padStart(2, "0");
    setRoll(document.getElementById("cd-d"), String(d));
    setRoll(document.getElementById("cd-h"), p2(hh));
    setRoll(document.getElementById("cd-m"), p2(mm));
    setRoll(document.getElementById("cd-s"), p2(ss));
    box.querySelector(".h-unit").textContent = d === 1 ? "dia" : "dias";
  };
  paint(); setInterval(paint, 1000);

  // slideshow
  let cur = 0, slideT;
  const go = n => {
    const next = (n + HERO.length) % HERO.length, after = (next + 1) % HERO.length;
    if (!slides[after].style.backgroundImage) slides[after].style.backgroundImage = `url("${photoUrl(HERO[after])}")`;
    slides[cur].classList.remove("on"); slides[next].classList.add("on");
    [...dots.children].forEach((d, i) => d.classList.toggle("on", i === next));
    cur = next;
  };
  [...dots.children].forEach((d, i) => d.addEventListener("click", () => { go(i); clearInterval(slideT); slideT = setInterval(() => go(cur + 1), 7000); }));
  if (!reduced()) slideT = setInterval(() => go(cur + 1), 7000);

  // parallax: scroll + pointer
  const mainEl = box.querySelector(".h-main");
  let px = 0, py = 0;
  const frame = () => {
    if (reduced() || box.hidden) return;
    const y = Math.min(scrollY, innerHeight);
    media.style.transform = `translate3d(${px * -18}px, ${y * .4 + py * -12}px, 0)`;
    mainEl.style.transform = `translate3d(${px * 10}px, ${y * -.2}px, 0)`;
    mainEl.style.opacity = String(1 - y / (innerHeight * .75));
  };
  box.addEventListener("pointermove", e => { px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; frame(); });
  addEventListener("scroll", frame, { passive: true });
  snow(canvas, box);
}

export function setHeroSub(box, text) {
  const s = box.querySelector(".h-note");
  if (s) s.textContent = text;
}

/* ---------- pinned story: giant lines slide and blur while a photo opens up ---------- */
const NUM = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze"];
const word = n => NUM[n] || String(n);
const STEPS = [
  ["Nove pessoas,", "cinco famílias."], // replaced with live counts in buildStory
  ["Seiscentos quilómetros", "de pistas."],
  ["Uma conta partilhada.", "Zero confusões."],
  ["Só falta", "lá chegar."],
];
let storyBuilt = false;
export function buildStory(box, { people = 0, families = 0 } = {}) {
  if (storyBuilt) return;
  storyBuilt = true;
  if (people) STEPS[0] = [`${word(people).replace(/^./, c => c.toUpperCase())} ${people === 1 ? "pessoa" : "pessoas"},`, `${word(families)} ${families === 1 ? "família" : "famílias"}.`];
  const lines = el("div", "st-lines", el("div", null, "Primeira descida"), el("div", null, "Último après-ski"), el("div", null, "Todos juntos"));
  const ids = [PHOTOS[5], PHOTOS[1], PHOTOS[3], PHOTOS[0]];
  const phs = ids.map((id, i) => { const p = el("div", "ph" + (i === 0 ? " on" : "")); p.style.backgroundImage = `url("${photoUrl(id, 2000)}")`; return p; });
  const photo = el("div", "st-photo", phs);
  const lbl = el("span", "lbl"), cap = el("p");
  const count = el("div", "st-count", "01");
  box.replaceChildren(el("div", "st-pin", lines, photo, el("div", "st-cap", lbl, cap), count));
  let step = -1;
  const setStep = i => {
    if (i === step) return; step = i;
    lbl.textContent = `${String(i + 1).padStart(2, "0")} / ${String(STEPS.length).padStart(2, "0")}`;
    cap.replaceChildren(...STEPS[i].map((t, k) => [el("span", null, t), k === 0 ? el("br") : null]).flat().filter(Boolean));
    [...cap.children].forEach((s, k) => s.style && (s.style.animationDelay = `${k * .06}s`));
    count.textContent = String(i + 1).padStart(2, "0");
    phs.forEach((p, k) => p.classList.toggle("on", k === i));
  };
  setStep(0);
  const rows = [...lines.children];
  const frame = () => {
    if (box.hidden) return;
    const r = box.getBoundingClientRect(), total = box.offsetHeight - innerHeight;
    const p = clamp(-r.top / total);
    // lines drift sideways in alternating directions and blur away as the photo takes over
    rows.forEach((row, i) => { row.style.transform = `translate3d(${(i % 2 ? 1 : -1) * (p * 40 - 6)}vw,0,0)`; });
    const blur = clamp((p - .12) / .3) * 14;
    lines.style.filter = `blur(${blur}px)`;
    lines.style.opacity = String(1 - clamp((p - .3) / .3) * .75);
    // photo opens from a centred card to full bleed
    const o = clamp(p / .45), ix = (1 - o) * 32, iy = (1 - o) * 26;
    photo.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${(1 - o) * 18}px)`;
    phs.forEach(ph => { ph.style.transform = `scale(${1.15 - o * .15})`; });
    setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * .999)));
  };
  addEventListener("scroll", frame, { passive: true });
  addEventListener("resize", frame);
  frame();
}

/* ---------- 00 / 100 scroll counter ---------- */
let progEl;
export function progress(show) {
  if (!progEl) {
    progEl = el("div", "progress", el("b"), " / 100");
    document.body.append(progEl);
    addEventListener("scroll", () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      progEl.firstChild.textContent = String(Math.round(max > 0 ? scrollY / max * 100 : 0)).padStart(2, "0");
      progEl.classList.toggle("dim", scrollY < innerHeight * .6);
    }, { passive: true });
    progEl.firstChild.textContent = "00"; progEl.classList.add("dim");
  }
  progEl.hidden = !show;
}

/* Login backdrop: same photography, one slow Ken Burns image. */
export function loginMedia(box) {
  if (box.childElementCount) return;
  const s = el("div", "slide on");
  s.style.backgroundImage = `url("${photoUrl(PHOTOS[0])}")`;
  box.append(s);
}
