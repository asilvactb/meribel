// Full-screen homepage hero: black & white Méribel photos (Unsplash), Ken Burns + crossfade,
// rolling-digit countdown, snow with depth, parallax and an orange marquee.

export const PHOTOS = [
  "1483521260200-abf26aaf98d6", // rider facing the peaks
  "1679261476716-7189b40e5397", // Méribel valley
  "1582491795316-0782a861c529", // summit at dusk
  "1454663501801-75a30ab23c6a", // Méribel lifts
  "1551036359-aaa8fdf6314b",    // chairlift at golden hour
];
export const photoUrl = id => {
  const w = Math.min(2400, Math.max(800, Math.round((innerWidth * (devicePixelRatio || 1)) / 200) * 200));
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=72&w=${w}`;
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function el(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  kids.flat(Infinity).forEach(k => k != null && e.append(k instanceof Node ? k : document.createTextNode(String(k))));
  return e;
}

/* ---------- rolling digits ---------- */
function setRoll(box, str) {
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
  let W = 0, H = 0, flakes = [], wind = 0, target = 0, run = true, raf;
  const resize = () => {
    const r = devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * r; canvas.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    const n = Math.round(Math.min(220, W * H / 7000));
    flakes = Array.from({ length: n }, () => mk(true));
  };
  const mk = any => { const z = Math.random(); return { x: Math.random() * W, y: any ? Math.random() * H : -10, z, r: .6 + z * 2.6, v: .35 + z * 1.4, ph: Math.random() * 6.28 }; };
  host.addEventListener("pointermove", e => { target = ((e.clientX / W) - .5) * 2.2; });
  const tick = () => {
    if (run) {
      wind += (target - wind) * .02;
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.ph += .01 + f.z * .01;
        f.y += f.v; f.x += Math.sin(f.ph) * .4 + wind * (.3 + f.z);
        if (f.y > H + 10) Object.assign(f, mk(false));
        if (f.x > W + 10) f.x = -10; if (f.x < -10) f.x = W + 10;
        ctx.globalAlpha = .25 + f.z * .6;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fillStyle = "#fff"; ctx.fill();
      }
    }
    raf = requestAnimationFrame(tick);
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { run = e.isIntersecting && !document.hidden; }).observe(host);
  resize(); if (!reduced()) tick();
}

/* ---------- build once ---------- */
let built = false, slideT;
export function buildHero(box, { start, end, onScrollDown }) {
  if (built) return;
  built = true;
  const slides = PHOTOS.map((id, i) => { const s = el("div", "slide" + (i === 0 ? " on" : "")); if (i < 2) s.style.backgroundImage = `url("${photoUrl(id)}")`; return s; });
  const media = el("div", "h-media", slides);
  const canvas = el("canvas", "h-snow");
  const dots = el("div", "h-dots", PHOTOS.map((_, i) => el("i", i === 0 ? "on" : null)));
  const unit = (id, label) => el("div", "u", Object.assign(el("span", "roll"), { id }), el("small", null, label));
  const words = ["Méribel 2027", "9 pessoas", "5 famílias", "Les 3 Vallées", "600 km de pistas", "5 — 10 janeiro", "Après-ski", "Fondue", "Primeira descida"];
  const line = () => el("div", "mq-set", words.map(w => [el("span", null, w), el("b", null, "✱")]));
  box.replaceChildren(
    media, el("div", "h-shade"), canvas, el("div", "h-grain"),
    el("div", "h-top", el("span", "acc", "Méribel — Les 3 Vallées"), el("span", "hide-s", "45°24′N  6°34′E  ·  1450 m"), el("span", null, "05—10.01.2027")),
    el("div", "h-main",
      el("p", "h-kicker", el("i"), el("span", null, "Faltam")),
      el("div", "h-days", Object.assign(el("span", "roll big"), { id: "cd-d" }), el("span", "h-unit", "dias")),
      el("div", "h-clock", unit("cd-h", "horas"), unit("cd-m", "minutos"), unit("cd-s", "segundos")),
      el("p", "h-sub", el("span", null), el("a", "h-cta", "Ver o que falta tratar →"))),
    dots,
    Object.assign(el("button", "h-down"), { type: "button", ariaLabel: "Descer", onclick: onScrollDown }),
    el("div", "h-marquee", el("div", "track", line(), line())),
    el("p", "h-credit", "Fotos · Unsplash"));
  box.querySelector(".h-cta").href = "#tratar";
  box.querySelector(".h-down").append(el("span", null, "Scroll"), el("i"));

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
  let cur = 0;
  const go = n => {
    const next = (n + PHOTOS.length) % PHOTOS.length, after = (next + 1) % PHOTOS.length;
    if (!slides[after].style.backgroundImage) slides[after].style.backgroundImage = `url("${photoUrl(PHOTOS[after])}")`;
    slides[cur].classList.remove("on"); slides[next].classList.add("on");
    [...dots.children].forEach((d, i) => d.classList.toggle("on", i === next));
    cur = next;
  };
  [...dots.children].forEach((d, i) => d.addEventListener("click", () => { go(i); clearInterval(slideT); slideT = setInterval(() => go(cur + 1), 7000); }));
  if (!reduced()) slideT = setInterval(() => go(cur + 1), 7000);

  // parallax: scroll + pointer
  const mainEl = box.querySelector(".h-main");
  let px = 0, py = 0;
  box.addEventListener("pointermove", e => { px = (e.clientX / innerWidth - .5); py = (e.clientY / innerHeight - .5); frame(); });
  const frame = () => {
    if (reduced()) return;
    const y = Math.min(scrollY, innerHeight);
    media.style.transform = `translate3d(${px * -18}px, ${y * .35 + py * -12}px, 0)`;
    mainEl.style.transform = `translate3d(${px * 10}px, ${y * -.18}px, 0)`;
    mainEl.style.opacity = String(1 - y / (innerHeight * .8));
  };
  addEventListener("scroll", frame, { passive: true });
  snow(canvas, box);
}

export function setHeroSub(box, text) {
  const s = box.querySelector(".h-sub span");
  if (s) s.textContent = text;
}

/* Login backdrop: same photography, one slow Ken Burns image. */
export function loginMedia(box) {
  if (box.childElementCount) return;
  const s = el("div", "slide on");
  s.style.backgroundImage = `url("${photoUrl(PHOTOS[0])}")`;
  box.append(s);
}
