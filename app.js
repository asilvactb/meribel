import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY, LOGINS } from "./config.js";
import { CATS, parseQuick, balances, settle, defaultStatus, NEXT_STATUS } from "./logic.js";
import { buildHero, setHeroSub, loginMedia, buildStory, preloader, cursor, progress } from "./hero.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "meribel-auth" } });

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
const svg = (d, cls) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); if (cls) s.setAttribute("class", cls); s.innerHTML = d; return s; };
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const TODAY = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const eurC = c => eur.format(c / 100);
const F = {
  wd: new Intl.DateTimeFormat("pt-PT", { weekday: "long" }),
  day: new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short" }),
  short: new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" }),
  dt: new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  time: new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }),
};
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
async function run(p, okMsg) { const { error } = await p; if (error) { toast("Não foi possível guardar: " + error.message); return false; } if (okMsg) toast(okMsg); return true; }

const ICON = {
  resumo: '<path d="m2.5 19 6.5-11 3.5 5.5 2.5-3.5 6.5 9z"/>',
  tratar: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  despesas: '<rect x="3" y="6" width="18" height="13" rx="4"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>',
  viagem: '<path d="M10.5 13.5 3 11l1.5-1.5 7 1 4-4.5a2 2 0 0 1 3 3l-4.5 4 1 7L14 21.5 11.5 14z"/>',
  plano: '<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  mala: '<rect x="4" y="7.5" width="16" height="12.5" rx="3.5"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M9 11v5M15 11v5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
};
const VIEWS = [["resumo", "Resumo"], ["tratar", "Tratar"], ["despesas", "Despesas"], ["viagem", "Viagem"], ["plano", "Plano"], ["mala", "Mala"], ["info", "Info"]];
const STATUS = {
  decidir: { t: "Por decidir", s: "?" },
  falta: { t: "Por tratar", s: "•" },
  tratado: { t: "Tratado", s: "✓" },
  nao: { t: "Não precisa", s: "–" },
};
const KINDS = { voo: "Voo", carro: "Carro", transfer: "Transfer", comboio: "Comboio", outro: "Outro" };
const SLOTS = { manha: "Manhã", dia: "Dia", tarde: "Tarde", noite: "Noite" };
const PACK_CATS = ["Documentos", "Roupa de neve", "Equipamento", "Roupa", "Higiene", "Outros"];

/* ================= state ================= */
const S = {
  me: null, view: "resumo", quick: [], malaFor: null, expFilter: "todas",
  families: [], people: [], settings: {}, expenses: [], transfers: [], items: [], status: [], todos: [], packing: [], packDone: [], travel: [], plan: [],
};
const TABLES = {
  families: ["trip_families", q => q.order("sort")], people: ["trip_people", q => q.order("sort")], settings: ["trip_settings"],
  expenses: ["trip_expenses", q => q.order("date", { ascending: false }).order("created_at", { ascending: false })],
  transfers: ["trip_transfers", q => q.order("created_at", { ascending: false })], items: ["trip_items", q => q.order("sort").order("created_at")],
  status: ["trip_item_status"], todos: ["trip_todos", q => q.order("created_at")], packing: ["trip_packing", q => q.order("sort").order("created_at")],
  packDone: ["trip_packing_done"], travel: ["trip_travel", q => q.order("depart_at", { nullsFirst: false })], plan: ["trip_plan", q => q.order("created_at")],
};
async function load(key) {
  const [table, mod] = TABLES[key];
  let q = sb.from(table).select("*");
  if (mod) q = mod(q);
  const { data, error } = await q;
  if (error) { console.warn(table, error.message); return; }
  if (key === "settings") S.settings = Object.fromEntries(data.map(r => [r.key, r.value]));
  else S[key] = data;
}
let rT;
const rerender = () => { clearTimeout(rT); rT = setTimeout(render, 60); };
function subscribe() {
  const ch = sb.channel("trip");
  for (const [key, [table]] of Object.entries(TABLES)) ch.on("postgres_changes", { event: "*", schema: "public", table }, () => load(key).then(rerender));
  ch.subscribe();
}

const person = id => S.people.find(p => p.id === id);
const family = id => S.families.find(f => f.id === id);
const pname = id => person(id)?.name.split(" ")[0] || "?";
const famMembers = fid => S.people.filter(p => p.family_id === fid);
const famLabel = fid => { const m = famMembers(fid); return m.length > 1 ? `${family(fid)?.name} (${m.length})` : family(fid)?.name; };
const trip = () => S.settings.trip || { start: "2027-01-06", end: "2027-01-11" };
const tripShort = () => { const t = trip(); return `${t.start.slice(8)}—${t.end.slice(8)}.${t.end.slice(5, 7)}`; };
const stay = () => S.settings.stay || {};
const statusOf = (item, pid) => S.status.find(s => s.item_id === item.id && s.person_id === pid)?.status || defaultStatus(item);

/* ================= auth ================= */
let picked = null;
// Who can log in comes from the database (so new people appear without a deploy); config.js is the fallback.
let logins = LOGINS;
async function loadLogins() {
  try { const { data, error } = await sb.rpc("trip_logins"); if (!error && data?.length) logins = data; } catch {}
}
async function showLogin() {
  await loadLogins();
  $("#app").hidden = true; $("#denied").hidden = true; $("#login").hidden = false;
  const sel = $("#login-who");
  sel.replaceChildren(h("option", { value: "", disabled: true }, "Escolhe o teu nome"), ...logins.map(l => h("option", { value: l.id }, l.name)));
  let last = null; try { last = localStorage.getItem("meribel_who"); } catch {}
  sel.value = logins.some(l => l.id === last) ? last : "";
  sel.onchange = () => { picked = logins.find(l => l.id === sel.value); $("#login-pass").focus(); };
  picked = logins.find(l => l.id === sel.value) || null;
  loginMedia($(".login-media"));
  requestAnimationFrame(() => document.body.classList.add("ready"));
  snow();
}
$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!picked) { $("#login-msg").textContent = "Escolhe primeiro o teu nome."; return; }
  const msg = $("#login-msg"); msg.textContent = "A entrar…";
  const { error } = await sb.auth.signInWithPassword({ email: picked.email, password: $("#login-pass").value });
  if (error) { msg.textContent = "Password errada. Tenta outra vez."; return; }
  try { localStorage.setItem("meribel_who", picked.id); } catch {}
  $("#login-pass").value = "";
  start();
});
$("#logout").addEventListener("click", async () => { await sb.auth.signOut(); location.hash = ""; showLogin(); });
$("#denied-out").addEventListener("click", async () => { await sb.auth.signOut(); showLogin(); });

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  await Promise.all(Object.keys(TABLES).map(load));
  const email = session.user.email.toLowerCase();
  S.me = S.people.find(p => p.email === email);
  if (!S.me) { $("#login").hidden = true; $("#app").hidden = true; $("#denied").hidden = false; $("#denied-email").textContent = email; return; }
  S.malaFor = S.me.id;
  $("#login").hidden = true; $("#denied").hidden = true; $("#app").hidden = false;
  $("#me-name").textContent = S.me.name.split(" ")[0];
  buildNav(); subscribe(); route();
}

/* ================= nav ================= */
function buildNav() {
  const mk = cls => VIEWS.map(([k, t]) => h("a", { href: "#" + k, "data-v": k, class: cls }, svg(ICON[k]), h("span", null, t)));
  $("#nav").replaceChildren(h("i", { class: "ind" }), ...mk());
  $("#tabbar").replaceChildren(...mk());
}
function moveInd() {
  const a = $(`#nav a[data-v="${S.view}"]`), ind = $("#nav .ind");
  if (!a || !ind) return;
  ind.style.width = a.offsetWidth + "px"; ind.style.height = a.offsetHeight + "px";
  ind.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
}
function route() {
  const v = location.hash.slice(1);
  S.view = VIEWS.some(([k]) => k === v) ? v : "resumo";
  VIEWS.forEach(([k]) => { $("#v-" + k).hidden = k !== S.view; });
  $("#hero").hidden = S.view !== "resumo";
  $("#story").hidden = S.view !== "resumo";
  progress(S.view === "resumo");
  document.body.classList.toggle("view-resumo", S.view === "resumo");
  document.querySelectorAll("#nav a, #tabbar a").forEach(a => a.classList.toggle("on", a.dataset.v === S.view));
  render(); moveInd(); window.scrollTo({ top: 0 }); heroState();
}
window.addEventListener("hashchange", route);
window.addEventListener("resize", moveInd);
let lastY = 0;
const heroState = () => document.body.classList.toggle("on-hero", S.view === "resumo" && !!S.me && scrollY < innerHeight - 90);
window.addEventListener("scroll", () => { heroState(); const y = scrollY, top = $("#top"); top.classList.toggle("scrolled", y > 8); top.classList.toggle("hide", y > lastY && y > 140); lastY = y; }, { passive: true });

function render() {
  if (!S.me) return;
  ({ resumo: renderResumo, tratar: renderTratar, despesas: renderDespesas, viagem: renderViagem, plano: renderPlano, mala: renderMala, info: renderInfo })[S.view]();
}

/* ================= dialog ================= */
function openForm(title, fields, onSave, opts = {}) {
  const dlg = $("#dlg"), body = $("#dlg-body");
  const inputs = {};
  const rows = fields.map(f => {
    let el;
    if (f.type === "select") { el = h("select", null, f.options.map(([v, t]) => h("option", { value: v }, t))); el.value = f.value ?? ""; }
    else if (f.type === "textarea") { el = h("textarea", { rows: 3 }); el.value = f.value ?? ""; }
    else if (f.type === "check") { el = h("input", { type: "checkbox" }); el.checked = !!f.value; }
    else if (f.type === "people") {
      const sel = new Set(f.value || []);
      el = h("div", { class: "chips" }, S.people.map(p => h("button", { type: "button", class: "chip" + (sel.has(p.id) ? " on" : ""), onclick: e => { sel.has(p.id) ? sel.delete(p.id) : sel.add(p.id); e.currentTarget.classList.toggle("on"); } }, p.name.split(" ")[0])));
      el.value = () => [...sel];
      inputs[f.k] = el;
      return h("div", { class: "frow" }, h("span", { class: "flabel" }, f.label), el);
    }
    else { el = h("input", { type: f.type || "text", inputmode: f.inputmode, step: f.step, placeholder: f.placeholder || "" }); el.value = f.value ?? ""; }
    inputs[f.k] = el;
    return h("label", { class: "frow" + (f.type === "check" ? " fcheck" : "") }, h("span", { class: "flabel" }, f.label), el);
  });
  const get = () => Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, typeof el.value === "function" ? el.value() : el.type === "checkbox" ? el.checked : el.value.trim()]));
  let armed = false;
  body.replaceChildren(
    h("h3", null, title), ...rows,
    h("div", { class: "dlg-actions" },
      opts.onDelete ? h("button", { type: "button", class: "link danger", onclick: async e => { if (!armed) { armed = true; e.currentTarget.textContent = "Carrega outra vez para apagar"; return; } if (await opts.onDelete()) dlg.close(); } }, "Apagar") : h("span"),
      h("span", { class: "grow" }),
      h("button", { type: "button", class: "pill ghost sm", onclick: () => dlg.close() }, "Cancelar"),
      h("button", { type: "button", class: "pill sm", onclick: async () => { if (await onSave(get())) dlg.close(); } }, opts.saveText || "Guardar")));
  dlg.showModal();
  const first = body.querySelector("input:not([type=checkbox]),textarea"); if (first && !opts.noFocus) first.focus();
}
$("#dlg").addEventListener("click", e => { if (e.target.id === "dlg") e.target.close(); });
const peopleOpts = (blank) => [...(blank ? [["", blank]] : []), ...S.people.map(p => [p.id, p.name])];
const adultOpts = () => S.people.filter(p => p.adult).map(p => [p.id, p.name]);
const toLocalInput = iso => { if (!iso) return ""; const d = new Date(iso); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/* ================= shared bits ================= */
const head = (title, sub, ...right) => {
  const i = VIEWS.findIndex(([k]) => k === S.view);
  return h("div", { class: "view-head" },
    h("div", { class: "vh-top" }, h("span", { class: "lbl" }, `${pad(i + 1)} / ${pad(VIEWS.length)}`), h("span", { class: "lbl" }, `Méribel 2027 · ${tripShort()}`)),
    h("div", { class: "vh-row" }, h("h2", { class: "display-s" }, h("span", { class: "ln" }, h("span", null, title))), h("div", { class: "head-r" }, sub ? h("p", null, sub) : null, ...right)));
};
const empty = t => h("p", { class: "empty" }, t);
function splitLabel(e) {
  const n = e.split.length, all = S.people.length;
  const fams = [...new Set(S.people.filter(p => e.split.includes(p.id)).map(p => p.family_id))];
  const whole = fams.every(f => famMembers(f).every(p => e.split.includes(p.id)));
  let who = n === all ? "Todos" : whole ? fams.map(f => family(f).name.split(" ")[0]).join(", ") : S.people.filter(p => e.split.includes(p.id)).map(p => p.name.split(" ")[0]).join(", ");
  if (n !== all && S.people.length - n <= 2 && n > 3) who = "Todos menos " + S.people.filter(p => !e.split.includes(p.id)).map(p => p.name.split(" ")[0]).join(" e ");
  return e.mode === "familias" ? `${who} · por família` : `${who} · ${n} ${n === 1 ? "pessoa" : "pessoas"}`;
}

/* quick entry bar, shared by Resumo and Despesas */
function quickBar() {
  const inp = h("input", { id: "quick-in", type: "text", enterkeyhint: "go", autocomplete: "off", placeholder: "120 sherpa, 45 jantar pago pelo miguel, 300 aulas só miguel e daniel" });
  const prev = h("div", { class: "qprev-wrap" });
  const form = h("form", { class: "quick-row", autocomplete: "off", onsubmit: e => { e.preventDefault(); S.quick = parseQuick(inp.value, S.people, S.me.id); if (!S.quick.length) toast("Começa por um valor, ex.: 40 supermercado"); drawQuick(prev, inp); } },
    inp, h("button", { class: "pill sm", type: "submit" }, "Ler"));
  drawQuick(prev, inp);
  return h("div", { class: "quick" },
    h("div", { class: "quick-label" }, h("span", null, "Nova despesa"), h("button", { type: "button", class: "link small", onclick: quickHelp }, "Como escrever")),
    form, prev);
}
function quickHelp() {
  openForm("Como escrever despesas", [], async () => true, { saveText: "Percebi", noFocus: true });
  $("#dlg-body h3").after(h("div", { class: "help" },
    h("p", null, "Escreve o valor e o que foi. Várias de uma vez, separadas por vírgulas."),
    h("ul", null,
      h("li", null, h("code", null, "120 sherpa"), " — pagaste tu, dividido por todos"),
      h("li", null, h("code", null, "45 jantar pago pelo miguel"), " — quem pagou"),
      h("li", null, h("code", null, "300 aulas só miguel e daniel"), " — só essas famílias"),
      h("li", null, h("code", null, "80 gasolina sem josé"), " — todos menos ele"),
      h("li", null, h("code", null, "60 portagens por família"), " — partes iguais por família"),
      h("li", null, h("code", null, "90 copos só adultos"), " · ", h("code", null, "25 lanches crianças"))),
    h("p", { class: "muted small" }, "Dizer o nome do Miguel ou do Daniel inclui a família toda. Antes de registar podes sempre corrigir quem pagou e quem divide.")));
}
function drawQuick(box, inp) {
  box.replaceChildren();
  if (!S.quick.length) return;
  box.append(h("div", { class: "qprev" },
    S.quick.map((q, i) => {
      const payer = h("select", { "aria-label": "Quem pagou" }, adultOpts().map(([v, t]) => h("option", { value: v }, "pagou " + t.split(" ")[0]))); payer.value = q.paid_by; payer.onchange = () => q.paid_by = payer.value;
      const cat = h("select", { "aria-label": "Categoria" }, CATS.map(c => h("option", null, c))); cat.value = q.cat; cat.onchange = () => q.cat = cat.value;
      const mode = h("button", { type: "button", class: "chip sm" + (q.mode === "familias" ? " on" : ""), onclick: () => { q.mode = q.mode === "familias" ? "pessoas" : "familias"; drawQuick(box, inp); } }, "por família");
      const ppl = h("div", { class: "chips sm" }, S.people.map(p => h("button", { type: "button", class: "chip sm" + (q.split.includes(p.id) ? " on" : ""), onclick: () => { q.split = q.split.includes(p.id) ? q.split.filter(x => x !== p.id) : [...q.split, p.id]; drawQuick(box, inp); } }, p.name.split(" ")[0])));
      const share = q.split.length ? (q.mode === "familias" ? eur.format(q.amount / new Set(S.people.filter(p => q.split.includes(p.id)).map(p => p.family_id)).size) + "/família" : eur.format(q.amount / q.split.length) + "/pessoa") : "ninguém selecionado";
      return h("div", { class: "qcard" },
        h("div", { class: "qtop" }, h("b", { class: "num" }, eur.format(q.amount)), h("input", { class: "qdesc", value: q.descr, oninput: e => q.descr = e.target.value }), h("button", { class: "x", type: "button", "aria-label": "Tirar", onclick: () => { S.quick.splice(i, 1); drawQuick(box, inp); } }, "×")),
        h("div", { class: "qmeta" }, payer, cat, mode, h("span", { class: "muted small num" }, share)), ppl);
    }),
    h("div", { class: "qactions" },
      h("button", { class: "pill", type: "button", onclick: () => saveQuick(box, inp) }, S.quick.length === 1 ? "Registar despesa" : `Registar ${S.quick.length} despesas`),
      h("button", { class: "link", type: "button", onclick: () => { S.quick = []; drawQuick(box, inp); } }, "Cancelar"))));
}
async function saveQuick(box, inp) {
  if (S.quick.some(q => !q.split.length)) return toast("Há uma despesa sem ninguém a dividir");
  const rows = S.quick.map(q => ({ amount: q.amount, descr: q.descr || q.cat, cat: q.cat, paid_by: q.paid_by, split: q.split, mode: q.mode, date: ymd(TODAY()), created_by: S.me.id }));
  if (await run(sb.from("trip_expenses").insert(rows), rows.length === 1 ? "Despesa registada" : `${rows.length} despesas registadas`)) { S.quick = []; inp.value = ""; drawQuick(box, inp); await load("expenses"); render(); }
}

/* ================= RESUMO ================= */
function renderResumo() {
  const v = $("#v-resumo"), t = trip(), st = stay();
  const days = Math.round((parseYmd(t.start) - TODAY()) / 864e5);
  const { bal, paid } = balances(S.expenses, S.transfers, S.people, S.families);
  const total = Object.values(paid).reduce((a, b) => a + b, 0);
  const myBal = bal[S.me.family_id] || 0;
  const pending = S.items.reduce((a, it) => a + S.people.filter(p => ["falta", "decidir"].includes(statusOf(it, p.id))).length, 0);
  const cells = S.items.length * S.people.length || 1;
  const done = S.items.reduce((a, it) => a + S.people.filter(p => ["tratado", "nao"].includes(statusOf(it, p.id))).length, 0);

  buildHero($("#hero"), { start: parseYmd(t.start), end: addDays(parseYmd(t.end), 1), people: S.people.length, families: S.families.length, onScrollDown: () => window.scrollTo({ top: innerHeight - 70, behavior: "smooth" }) });
  buildStory($("#story"), { people: S.people.length, families: S.families.length });
  setHeroSub($("#hero"), st.name ? `${st.name}${st.address ? " · " + st.address : ""}` : `Alojamento por fechar · ${pending} coisas por tratar`);

  const kpis = h("div", { class: "kpis" },
    kpi("Gasto pelo grupo", eurC(total), `${eurC(Math.round(total / S.people.length))} por pessoa`, "#despesas"),
    kpi(S.me.family_id === S.me.id && famMembers(S.me.family_id).length > 1 ? "Saldo da tua família" : "O teu saldo", (myBal > 0 ? "+" : "") + eurC(myBal), myBal > 0 ? "o grupo deve-te" : myBal < 0 ? "deves ao grupo" : "tudo certo", "#despesas", myBal > 0 ? "good" : myBal < 0 ? "bad" : ""),
    kpi("Coisas a tratar", String(pending), `${Math.round(done / cells * 100)}% resolvido`, "#tratar", pending ? "warn" : "good"),
    kpi("Tarefas abertas", String(S.todos.filter(x => !x.done).length), "do grupo", "#tratar"));

  // what my family still needs
  const mine = famMembers(S.me.family_id);
  const myRows = S.items.map(it => ({ it, open: mine.filter(p => ["falta", "decidir"].includes(statusOf(it, p.id))) })).filter(r => r.open.length);
  const mineBlock = h("div", { class: "block" },
    h("div", { class: "block-head" }, h("h3", null, mine.length > 1 ? "O que falta à tua família" : "O que te falta"), h("a", { href: "#tratar", class: "link small" }, "Ver tudo")),
    myRows.length ? h("div", { class: "list" }, myRows.map(({ it, open }) => h("div", { class: "row" },
      h("span", { class: "t" }, it.title, it.owner ? h("span", { class: "muted small" }, ` · trata ${pname(it.owner)}`) : null),
      h("span", { class: "tags" }, open.map(p => h("span", { class: "tag " + statusOf(it, p.id) }, mine.length > 1 ? p.name.split(" ")[0] : STATUS[statusOf(it, p.id)].t)))))) : empty("Está tudo tratado."));

  const todos = S.todos.filter(x => !x.done).slice(0, 6);
  const todoBlock = h("div", { class: "block" },
    h("div", { class: "block-head" }, h("h3", null, "Próximas tarefas"), h("a", { href: "#tratar", class: "link small" }, "Gerir")),
    todos.length ? h("div", { class: "list" }, todos.map(todoRow)) : empty("Sem tarefas abertas."));

  const recent = S.expenses.slice(0, 5);
  const expBlock = h("div", { class: "block" },
    h("div", { class: "block-head" }, h("h3", null, "Últimas despesas"), h("a", { href: "#despesas", class: "link small" }, "Ver saldos")),
    recent.length ? h("div", { class: "list" }, recent.map(expRow)) : empty("Ainda não há despesas."));

  v.replaceChildren(h("div", { class: "sec-title" }, h("h2", null, "Ponto de situação"), h("span", { class: "lbl" }, cap(F.day.format(TODAY())))), quickBar(), kpis, h("div", { class: "grid-2" }, mineBlock, h("div", { class: "stack" }, todoBlock, expBlock)));
}
function kpi(label, value, sub, href, tone) {
  return h("a", { class: "kpi " + (tone || ""), href }, h("span", { class: "kl" }, label), h("b", { class: "kv num" }, value), h("span", { class: "ks" }, sub));
}

/* ================= TRATAR ================= */
function renderTratar() {
  const v = $("#v-tratar");
  const legend = h("div", { class: "legend" }, Object.entries(STATUS).map(([k, s]) => h("span", { class: "lg" }, h("i", { class: "cell " + k }, s.s), s.t)));
  const fams = S.families;
  const table = h("table", { class: "matrix" },
    h("thead", null,
      h("tr", { class: "fam-row" }, h("th", { rowspan: 2, class: "it-h" }, "O quê"), fams.map(f => { const m = famMembers(f.id); return m.length > 1 ? h("th", { colspan: m.length, class: "fam" }, f.name.split(" ")[0]) : h("th", { rowspan: 2, class: "fam solo" }, m[0].name.split(" ")[0]); })),
      h("tr", null, fams.flatMap(f => famMembers(f.id).length > 1 ? famMembers(f.id).map((p, i) => h("th", { class: "p" + (i === 0 ? " first" : "") + (p.adult ? "" : " kid") }, p.name.split(" ")[0])) : []))),
    h("tbody", null, S.items.map(it => {
      const st = S.people.map(p => statusOf(it, p.id));
      const need = st.filter(s => s === "falta" || s === "tratado").length, ok = st.filter(s => s === "tratado").length;
      return h("tr", null,
        h("th", { class: "it" }, h("div", { class: "it-in" },
          h("button", { class: "it-title", type: "button", onclick: () => editItem(it) }, it.title, it.optional ? h("span", { class: "opt" }, "opcional") : null),
          h("span", { class: "it-meta" }, it.owner ? `Trata: ${pname(it.owner)}` : "Ninguém a tratar", " · ", need ? `${ok}/${need}` : "—",
            st.includes("falta") ? h("button", { class: "link small", type: "button", onclick: () => allDone(it) }, "Marcar tratado") : null),
          need ? h("i", { class: "bar" }, h("i", { style: `width:${ok / need * 100}%` })) : null)),
        fams.flatMap(f => famMembers(f.id).map((p, i) => {
          const s = statusOf(it, p.id);
          return h("td", { class: i === 0 ? "first" : "" }, h("button", { type: "button", class: "cell " + s, title: `${p.name}: ${STATUS[s].t}`, "aria-label": `${it.title}, ${p.name}: ${STATUS[s].t}`, onclick: () => setStatus(it, p.id, NEXT_STATUS[s]) }, STATUS[s].s));
        })));
    })));
  const addIn = h("input", { placeholder: "Adicionar coisa a tratar (ex.: Seguro de viagem)" });
  const addForm = h("form", { class: "add-row", onsubmit: async e => { e.preventDefault(); const t = addIn.value.trim(); if (!t) return; if (await run(sb.from("trip_items").insert({ title: t, sort: S.items.length + 1, optional: true }))) { addIn.value = ""; await load("items"); render(); } } }, addIn, h("button", { class: "pill sm", type: "submit" }, "Adicionar"));

  const todoIn = h("input", { placeholder: "Nova tarefa do grupo (ex.: Reservar mesa na Folie Douce)" });
  const todoOwner = h("select", { "aria-label": "Responsável" }, peopleOpts("Ninguém").filter(([id]) => !id || person(id).adult).map(([v, t]) => h("option", { value: v }, t.split(" ")[0])));
  const todoForm = h("form", { class: "add-row", onsubmit: async e => { e.preventDefault(); const t = todoIn.value.trim(); if (!t) return; if (await run(sb.from("trip_todos").insert({ title: t, owner: todoOwner.value || null }))) { todoIn.value = ""; await load("todos"); render(); } } }, todoIn, todoOwner, h("button", { class: "pill sm", type: "submit" }, "Adicionar"));
  const open = S.todos.filter(x => !x.done), closed = S.todos.filter(x => x.done);

  v.replaceChildren(
    head("Coisas a tratar", "Toca numa célula para mudar o estado. A maioria trata-se em grupo: usa “Marcar tratado” quando estiver feito para todos."),
    legend,
    h("div", { class: "block flush" }, h("div", { class: "matrix-wrap" }, table), addForm),
    h("div", { class: "block" }, h("div", { class: "block-head" }, h("h3", null, "Tarefas do grupo"), h("span", { class: "muted small" }, `${open.length} abertas`)),
      todoForm, open.length ? h("div", { class: "list" }, open.map(todoRow)) : empty("Sem tarefas abertas."),
      closed.length ? h("details", { class: "done-list" }, h("summary", null, `${closed.length} feitas`), h("div", { class: "list" }, closed.map(todoRow))) : null));
}
async function setStatus(it, pid, status) {
  const row = { item_id: it.id, person_id: pid, status, updated_by: S.me.id, updated_at: new Date().toISOString() };
  const i = S.status.findIndex(s => s.item_id === it.id && s.person_id === pid);
  if (i >= 0) S.status[i] = row; else S.status.push(row);
  render();
  await run(sb.from("trip_item_status").upsert(row));
}
async function allDone(it) {
  const rows = S.people.filter(p => statusOf(it, p.id) === "falta").map(p => ({ item_id: it.id, person_id: p.id, status: "tratado", updated_by: S.me.id, updated_at: new Date().toISOString() }));
  if (await run(sb.from("trip_item_status").upsert(rows), `${it.title}: tratado para ${rows.length}`)) { await load("status"); render(); }
}
function editItem(it) {
  openForm(it.title, [
    { k: "title", label: "Nome", value: it.title },
    { k: "owner", label: "Quem trata", type: "select", options: peopleOpts("Ninguém").filter(([id]) => !id || person(id).adult), value: it.owner || "" },
    { k: "optional", label: "Opcional (nem todos precisam)", type: "check", value: it.optional },
    { k: "note", label: "Notas", type: "textarea", value: it.note || "" },
  ], async d => {
    if (!d.title) return toast("Falta o nome"), false;
    const ok = await run(sb.from("trip_items").update({ title: d.title, owner: d.owner || null, optional: d.optional, note: d.note || null }).eq("id", it.id));
    if (ok) { await load("items"); render(); }
    return ok;
  }, { onDelete: async () => { const ok = await run(sb.from("trip_items").delete().eq("id", it.id), "Apagado"); if (ok) { await load("items"); render(); } return ok; } });
}
function todoRow(x) {
  return h("div", { class: "row todo" + (x.done ? " done" : "") },
    h("button", { type: "button", class: "tick" + (x.done ? " on" : ""), "aria-label": x.done ? "Reabrir" : "Feito", onclick: async () => { x.done = !x.done; render(); await run(sb.from("trip_todos").update({ done: x.done, done_at: x.done ? new Date().toISOString() : null }).eq("id", x.id)); } }, svg('<path d="m6 12.5 4 4 8-9"/>')),
    h("button", { type: "button", class: "t plain", onclick: () => editTodo(x) }, x.title),
    h("span", { class: "muted small" }, [x.owner ? pname(x.owner) : null, x.due ? F.short.format(parseYmd(x.due)) : null].filter(Boolean).join(" · ")));
}
function editTodo(x) {
  openForm("Tarefa", [
    { k: "title", label: "O quê", value: x.title },
    { k: "owner", label: "Quem", type: "select", options: peopleOpts("Ninguém").filter(([id]) => !id || person(id).adult), value: x.owner || "" },
    { k: "due", label: "Até quando", type: "date", value: x.due || "" },
  ], async d => {
    const ok = await run(sb.from("trip_todos").update({ title: d.title || x.title, owner: d.owner || null, due: d.due || null }).eq("id", x.id));
    if (ok) { await load("todos"); render(); } return ok;
  }, { onDelete: async () => { const ok = await run(sb.from("trip_todos").delete().eq("id", x.id)); if (ok) { await load("todos"); render(); } return ok; } });
}

/* ================= DESPESAS ================= */
function renderDespesas() {
  const v = $("#v-despesas");
  const { bal, paid, cost } = balances(S.expenses, S.transfers, S.people, S.families);
  const total = Object.values(paid).reduce((a, b) => a + b, 0);
  const plan = settle(bal);

  const balBlock = h("div", { class: "block" },
    h("div", { class: "block-head" }, h("h3", null, "Saldos por família"), h("span", { class: "muted small num" }, `Total ${eurC(total)}`)),
    h("div", { class: "bal-list" }, S.families.map(f => {
      const b = bal[f.id] || 0, max = Math.max(1, ...Object.values(bal).map(Math.abs));
      return h("div", { class: "bal" + (f.id === S.me.family_id ? " me" : "") },
        h("div", { class: "bal-n" }, h("b", null, famLabel(f.id)), h("span", { class: "muted small num" }, `pagou ${eurC(paid[f.id] || 0)} · gastou ${eurC(cost[f.id] || 0)}`)),
        h("div", { class: "bal-bar" }, h("i", { class: b >= 0 ? "pos" : "neg", style: `width:${Math.abs(b) / max * 50}%` })),
        h("b", { class: "num bal-v " + (b > 0 ? "good" : b < 0 ? "bad" : "") }, (b > 0 ? "+" : "") + eurC(b)));
    })));

  const settleBlock = h("div", { class: "block dark" },
    h("div", { class: "block-head" }, h("h3", null, "Para acertar"), h("span", { class: "small dim" }, plan.length ? `${plan.length} ${plan.length === 1 ? "transferência" : "transferências"}` : "")),
    plan.length ? h("div", { class: "list" }, plan.map(p => h("div", { class: "row" },
      h("span", { class: "t inline" }, h("b", null, family(p.from).name.split(" ")[0]), " paga a ", h("b", null, family(p.to).name.split(" ")[0])),
      h("b", { class: "num" }, eurC(p.cents)),
      h("button", { class: "pill sm light", type: "button", onclick: () => markPaid(p) }, "Já pagou")))) : h("p", { class: "dim" }, S.expenses.length ? "Está tudo acertado." : "Quando houver despesas, aparece aqui quem paga a quem, com o mínimo de transferências."));

  // weights
  const weights = h("details", { class: "block weights" }, h("summary", null, h("h3", null, "Como se divide"), h("span", { class: "muted small" }, "Peso de cada pessoa nas despesas “por pessoa”")),
    h("p", { class: "muted small" }, "1 = paga uma parte inteira. Põe 0,5 se as crianças pagarem meia parte, ou 0 se não entrarem. Despesas “por família” dividem-se em partes iguais por família."),
    h("div", { class: "w-grid" }, S.people.map(p => {
      const sel = h("select", { "aria-label": `Peso de ${p.name}` }, ["1", "0.75", "0.5", "0.25", "0"].map(w => h("option", { value: w }, w.replace(".", ",")))); sel.value = String(+p.weight);
      sel.onchange = async () => { if (await run(sb.from("trip_people").update({ weight: +sel.value }).eq("id", p.id), `${p.name}: peso ${sel.value.replace(".", ",")}`)) { await load("people"); render(); } };
      return h("label", { class: "w" }, h("span", null, p.name.split(" ")[0], p.adult ? "" : h("span", { class: "muted small" }, " criança")), sel);
    })));

  // categories
  const byCat = {};
  S.expenses.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + Math.round(e.amount * 100));
  const catMax = Math.max(1, ...Object.values(byCat));
  const catBlock = Object.keys(byCat).length ? h("div", { class: "block" }, h("h3", null, "Por categoria"),
    h("div", { class: "cats" }, Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => h("div", { class: "catrow" }, h("span", null, c), h("i", { class: "cbar" }, h("i", { style: `width:${v / catMax * 100}%` })), h("b", { class: "num" }, eurC(v)))))) : null;

  // list
  const filters = ["todas", "minhas", ...CATS.filter(c => S.expenses.some(e => e.cat === c))];
  const list = S.expenses.filter(e => S.expFilter === "todas" ? true : S.expFilter === "minhas" ? person(e.paid_by)?.family_id === S.me.family_id || e.split.some(id => person(id)?.family_id === S.me.family_id) : e.cat === S.expFilter);
  const byDate = {};
  list.forEach(e => (byDate[e.date] ||= []).push(e));
  const listBlock = h("div", { class: "block" },
    h("div", { class: "block-head" }, h("h3", null, "Despesas"), h("span", { class: "muted small" }, `${S.expenses.length}`)),
    h("div", { class: "chips scroll" }, filters.map(f => h("button", { type: "button", class: "chip" + (S.expFilter === f ? " on" : ""), onclick: () => { S.expFilter = f; render(); } }, f === "todas" ? "Todas" : f === "minhas" ? "Da minha família" : f))),
    list.length ? Object.entries(byDate).map(([d, es]) => h("div", { class: "day-group" }, h("p", { class: "day-h" }, cap(F.day.format(parseYmd(d)))), h("div", { class: "list" }, es.map(expRow)))) : empty("Ainda não há despesas. Usa a barra lá em cima."),
    S.transfers.length ? h("details", { class: "done-list" }, h("summary", null, `${S.transfers.length} ${S.transfers.length === 1 ? "acerto registado" : "acertos registados"}`),
      h("div", { class: "list" }, S.transfers.map(t => h("div", { class: "row" }, h("span", { class: "t" }, `${family(t.from_family).name.split(" ")[0]} → ${family(t.to_family).name.split(" ")[0]}`, h("span", { class: "muted small" }, " · " + F.short.format(parseYmd(t.date)))),
        h("b", { class: "num" }, eur.format(t.amount)),
        h("button", { class: "link small danger", type: "button", onclick: async () => { if (await run(sb.from("trip_transfers").delete().eq("id", t.id), "Acerto apagado")) { await load("transfers"); render(); } } }, "Anular"))))) : null);

  v.replaceChildren(head("Despesas", "Tudo o que se paga em conjunto. Os saldos são por família."), quickBar(),
    h("div", { class: "grid-2" }, h("div", { class: "stack" }, balBlock, settleBlock, catBlock, weights), listBlock));
}
function expRow(e) {
  return h("button", { type: "button", class: "row exp", onclick: () => editExpense(e) },
    h("span", { class: "cat-dot", "data-c": e.cat }, e.cat.slice(0, 1)),
    h("span", { class: "t" }, h("b", null, e.descr), h("span", { class: "muted small" }, `${pname(e.paid_by)} pagou · ${splitLabel(e)}`)),
    h("b", { class: "num" }, eur.format(e.amount)));
}
function editExpense(e) {
  openForm("Despesa", [
    { k: "amount", label: "Valor (€)", type: "text", inputmode: "decimal", value: String(e.amount).replace(".", ",") },
    { k: "descr", label: "O quê", value: e.descr },
    { k: "cat", label: "Categoria", type: "select", options: CATS.map(c => [c, c]), value: e.cat },
    { k: "paid_by", label: "Quem pagou", type: "select", options: adultOpts(), value: e.paid_by },
    { k: "date", label: "Data", type: "date", value: e.date },
    { k: "familias", label: "Dividir em partes iguais por família", type: "check", value: e.mode === "familias" },
    { k: "split", label: "Quem divide", type: "people", value: e.split },
  ], async d => {
    const amount = Math.round(parseFloat(String(d.amount).replace(/\s/g, "").replace(",", ".")) * 100) / 100;
    if (!(amount > 0)) return toast("Valor inválido"), false;
    if (!d.split.length) return toast("Escolhe quem divide"), false;
    const ok = await run(sb.from("trip_expenses").update({ amount, descr: d.descr || e.descr, cat: d.cat, paid_by: d.paid_by, date: d.date || e.date, mode: d.familias ? "familias" : "pessoas", split: d.split }).eq("id", e.id), "Guardado");
    if (ok) { await load("expenses"); render(); } return ok;
  }, { noFocus: true, onDelete: async () => { const ok = await run(sb.from("trip_expenses").delete().eq("id", e.id), "Despesa apagada"); if (ok) { await load("expenses"); render(); } return ok; } });
}
async function markPaid(p) {
  if (await run(sb.from("trip_transfers").insert({ from_family: p.from, to_family: p.to, amount: p.cents / 100, created_by: S.me.id }), "Acerto registado")) { await load("transfers"); render(); }
}

/* ================= VIAGEM ================= */
function renderViagem() {
  const v = $("#v-viagem"), st = stay();
  const maps = st.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.address)}` : null;
  const stayBlock = h("div", { class: "block stay" },
    h("div", { class: "block-head" }, h("h3", null, "Alojamento"), h("button", { class: "link small", type: "button", onclick: editStay }, st.name ? "Editar" : "Adicionar")),
    st.name ? h("div", { class: "stay-in" },
      h("p", { class: "display-xs" }, st.name),
      h("dl", { class: "facts" },
        st.address ? [h("dt", null, "Morada"), h("dd", null, st.address, " ", h("a", { class: "link small", href: maps, target: "_blank", rel: "noopener" }, "Mapa"))] : null,
        st.checkin ? [h("dt", null, "Check-in"), h("dd", null, st.checkin)] : null,
        st.checkout ? [h("dt", null, "Check-out"), h("dd", null, st.checkout)] : null,
        st.price ? [h("dt", null, "Preço"), h("dd", { class: "num" }, st.price)] : null,
        st.rooms ? [h("dt", null, "Quartos"), h("dd", { style: "white-space:pre-line" }, st.rooms)] : null,
        st.link ? [h("dt", null, "Reserva"), h("dd", null, h("a", { class: "link", href: st.link, target: "_blank", rel: "noopener" }, "Abrir"))] : null,
        st.notes ? [h("dt", null, "Notas"), h("dd", { style: "white-space:pre-line" }, st.notes)] : null)) : empty("Ainda por fechar. Quando estiver reservado, mete aqui a morada, horários e a distribuição dos quartos."));

  const items = S.travel;
  const travelBlock = h("div", { class: "block" },
    h("div", { class: "block-head" }, h("h3", null, "Voos, carros e transfers"), h("button", { class: "pill sm", type: "button", onclick: () => editTravel() }, "Adicionar")),
    items.length ? h("div", { class: "list" }, items.map(t => h("button", { type: "button", class: "row travel", onclick: () => editTravel(t) },
      h("span", { class: "kind" }, KINDS[t.kind]),
      h("span", { class: "t" }, h("b", null, t.title), h("span", { class: "muted small" }, [t.depart_at ? fmtAt(F_DT, t.depart_at, legTz(t.title, "from")) : null, t.arrive_at ? "chega " + fmtAt(F_TIME, t.arrive_at, legTz(t.title, "to")) : null].filter(Boolean).join(" → ") || "sem horário"),
        t.details ? h("span", { class: "small", style: "white-space:pre-line" }, t.details) : null),
      h("span", { class: "tags" }, (t.who.length === S.people.length ? ["Todos"] : t.who.map(pname)).map(n => h("span", { class: "tag" }, n)))))) : empty("Sem viagens registadas."));

  // who is not covered by any travel entry yet
  const covered = new Set(S.travel.flatMap(t => t.who));
  const missing = S.people.filter(p => !covered.has(p.id));
  v.replaceChildren(head("Viagem", "Alojamento e como cada um chega e volta."),
    h("div", { class: "grid-2" }, stayBlock, h("div", { class: "stack" }, travelBlock,
      S.travel.length && missing.length ? h("p", { class: "muted small pad" }, "Ainda sem viagem: " + missing.map(p => p.name.split(" ")[0]).join(", ")) : null)));
}
function editStay() {
  const st = stay();
  openForm("Alojamento", [
    { k: "name", label: "Nome", value: st.name || "", placeholder: "Chalet …" },
    { k: "address", label: "Morada", value: st.address || "" },
    { k: "checkin", label: "Check-in", value: st.checkin || "", placeholder: "Ter 5 jan · 16h" },
    { k: "checkout", label: "Check-out", value: st.checkout || "", placeholder: "Seg 11 jan · 10h" },
    { k: "price", label: "Preço total", value: st.price || "" },
    { k: "rooms", label: "Quartos", type: "textarea", value: st.rooms || "" },
    { k: "link", label: "Link da reserva", type: "url", value: st.link || "" },
    { k: "notes", label: "Notas", type: "textarea", value: st.notes || "" },
  ], async d => {
    const value = Object.fromEntries(Object.entries(d).map(([k, x]) => [k, x || null]));
    const ok = await run(sb.from("trip_settings").upsert({ key: "stay", value, updated_at: new Date().toISOString() }), "Guardado");
    if (ok) { await load("settings"); render(); } return ok;
  });
}
function editTravel(t) {
  t ||= { kind: "voo", title: "", who: [], depart_at: null, arrive_at: null, details: "" };
  openForm(t.id ? t.title : "Nova viagem", [
    { k: "kind", label: "Tipo", type: "select", options: Object.entries(KINDS), value: t.kind },
    { k: "title", label: "Descrição", value: t.title, placeholder: "Porto → Genebra · TP 1234" },
    { k: "depart_at", label: "Partida", type: "datetime-local", value: toLocalInput(t.depart_at) },
    { k: "arrive_at", label: "Chegada", type: "datetime-local", value: toLocalInput(t.arrive_at) },
    { k: "who", label: "Quem", type: "people", value: t.who },
    { k: "details", label: "Detalhes", type: "textarea", value: t.details || "", placeholder: "Reserva, bagagem, quem conduz…" },
  ], async d => {
    if (!d.title) return toast("Falta a descrição"), false;
    const row = { kind: d.kind, title: d.title, who: d.who, details: d.details || null, depart_at: d.depart_at ? new Date(d.depart_at).toISOString() : null, arrive_at: d.arrive_at ? new Date(d.arrive_at).toISOString() : null };
    const ok = await run(t.id ? sb.from("trip_travel").update(row).eq("id", t.id) : sb.from("trip_travel").insert(row), "Guardado");
    if (ok) { await load("travel"); render(); } return ok;
  }, t.id ? { onDelete: async () => { const ok = await run(sb.from("trip_travel").delete().eq("id", t.id)); if (ok) { await load("travel"); render(); } return ok; } } : {});
}

/* Flight times are shown in the airport's local time: anything in France or Geneva uses Paris time. */
const ALPS = /lyon|lys|genebra|gen[eè]ve|gva|chamb[eé]ry|grenoble|m[eé]ribel|mo[uû]tiers/i;
function legTz(title, side) {
  const [a, b] = String(title).split(/→|->/);
  const part = side === "from" ? a : b;
  return part && ALPS.test(part) ? "Europe/Paris" : "Europe/Lisbon";
}
const F_DT = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
const F_TIME = { hour: "2-digit", minute: "2-digit" };
const fmtAt = (opts, iso, timeZone) => new Intl.DateTimeFormat("pt-PT", { ...opts, timeZone }).format(new Date(iso));

/* ================= PLANO ================= */
function renderPlano() {
  const v = $("#v-plano"), t = trip();
  const days = [];
  for (let d = parseYmd(t.start); d <= parseYmd(t.end); d.setDate(d.getDate() + 1)) days.push(new Date(d));
  const order = Object.keys(SLOTS);
  const cards = days.map((d, i) => {
    const k = ymd(d), items = S.plan.filter(p => p.date === k).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
    const inp = h("input", { placeholder: "Adicionar…" });
    const slot = h("select", { "aria-label": "Quando" }, Object.entries(SLOTS).map(([v, t]) => h("option", { value: v }, t))); slot.value = "dia";
    return h("div", { class: "block day" + (k === ymd(TODAY()) ? " today" : "") },
      h("div", { class: "day-top" }, h("span", { class: "dn num" }, d.getDate()), h("span", null, h("b", null, cap(F.wd.format(d))), h("span", { class: "muted small" }, i === 0 ? "Chegada" : i === days.length - 1 ? "Regresso" : `Dia ${i} de ski`))),
      items.length ? h("div", { class: "list" }, items.map(p => h("button", { type: "button", class: "row plan", onclick: () => editPlan(p) }, h("span", { class: "slot" }, SLOTS[p.slot]), h("span", { class: "t" }, p.title, p.note ? h("span", { class: "muted small" }, p.note) : null)))) : null,
      h("form", { class: "add-row sm", onsubmit: async e => { e.preventDefault(); const x = inp.value.trim(); if (!x) return; if (await run(sb.from("trip_plan").insert({ date: k, slot: slot.value, title: x }))) { inp.value = ""; await load("plan"); render(); } } }, inp, slot, h("button", { class: "icon-btn", type: "submit", "aria-label": "Adicionar" }, "+")));
  });
  v.replaceChildren(head("Plano", "Dia a dia. Pistas, jantares, après-ski."), h("div", { class: "days" }, cards));
}
function editPlan(p) {
  openForm("Plano", [
    { k: "title", label: "O quê", value: p.title },
    { k: "slot", label: "Quando", type: "select", options: Object.entries(SLOTS), value: p.slot },
    { k: "note", label: "Notas", type: "textarea", value: p.note || "" },
  ], async d => {
    const ok = await run(sb.from("trip_plan").update({ title: d.title || p.title, slot: d.slot, note: d.note || null }).eq("id", p.id));
    if (ok) { await load("plan"); render(); } return ok;
  }, { onDelete: async () => { const ok = await run(sb.from("trip_plan").delete().eq("id", p.id)); if (ok) { await load("plan"); render(); } return ok; } });
}

/* ================= MALA ================= */
function renderMala() {
  const v = $("#v-mala");
  const who = person(S.malaFor) || S.me;
  const mine = famMembers(S.me.family_id), others = S.people.filter(p => p.family_id !== S.me.family_id);
  const pickBtn = p => h("button", { type: "button", class: "chip" + (p.id === who.id ? " on" : ""), onclick: () => { S.malaFor = p.id; render(); } }, p.name.split(" ")[0]);
  // shared items (no owner) for everyone, plus this person's own items
  const items = S.packing.filter(i => i.owner ? i.owner === who.id : (!i.kids_only || !who.adult));
  const done = new Set(S.packDone.filter(d => d.person_id === who.id).map(d => d.item_id));
  const n = items.filter(i => done.has(i.id)).length;
  const groups = PACK_CATS.concat([...new Set(items.map(i => i.cat))].filter(c => !PACK_CATS.includes(c))).map(c => [c, items.filter(i => i.cat === c)]).filter(([, xs]) => xs.length);
  const toWho = who.id === S.me.id ? "à tua mala" : `à mala de ${who.name.split(" ")[0]}`;
  const inp = h("input", { placeholder: `Adicionar ${toWho}` });
  const cat = h("select", { "aria-label": "Categoria" }, PACK_CATS.map(c => h("option", null, c))); cat.value = "Outros";
  const scope = h("select", { "aria-label": "Para quem" }, h("option", { value: "me" }, who.id === S.me.id ? "Só para mim" : `Só para ${who.name.split(" ")[0]}`), h("option", { value: "all" }, "Para todos"));
  scope.onchange = () => { inp.placeholder = scope.value === "all" ? "Adicionar à lista de todos" : `Adicionar ${toWho}`; };
  v.replaceChildren(
    head("Mala", "Há uma lista base para todos e cada um junta as suas coisas. Os pais podem tratar da mala dos filhos."),
    h("div", { class: "chips" }, mine.map(pickBtn), h("span", { class: "sep" }), others.map(pickBtn)),
    h("div", { class: "block" },
      h("div", { class: "block-head" }, h("h3", null, who.id === S.me.id ? "A tua mala" : `Mala de ${who.name.split(" ")[0]}`), h("span", { class: "muted small num" }, `${n}/${items.length}`)),
      h("i", { class: "bar big" }, h("i", { style: `width:${items.length ? n / items.length * 100 : 0}%` })),
      groups.map(([c, xs]) => h("div", { class: "pack-group" }, h("p", { class: "day-h" }, c), h("div", { class: "list" }, xs.map(i => h("div", { class: "row todo" + (done.has(i.id) ? " done" : "") },
        h("button", { type: "button", class: "tick" + (done.has(i.id) ? " on" : ""), "aria-label": i.title, onclick: () => togglePack(i, who) }, svg('<path d="m6 12.5 4 4 8-9"/>')),
        h("span", { class: "t" }, i.title),
        i.owner ? h("span", { class: "tag" }, "só " + (i.owner === S.me.id ? "teu" : pname(i.owner))) : null,
        h("button", { type: "button", class: "x", "aria-label": i.owner ? "Tirar" : "Tirar da lista de todos", title: i.owner ? "Tirar" : "Tirar da lista de todos", onclick: e => removePack(i, e) }, "×")))))),
      h("form", { class: "add-row", onsubmit: async e => {
        e.preventDefault(); const t = inp.value.trim(); if (!t) return;
        const row = { title: t, cat: cat.value, sort: 100, owner: scope.value === "all" ? null : who.id };
        if (await run(sb.from("trip_packing").insert(row), scope.value === "all" ? "Adicionado à lista de todos" : `Adicionado ${toWho}`)) { inp.value = ""; await load("packing"); render(); }
      } }, inp, cat, scope, h("button", { class: "pill sm", type: "submit" }, "Adicionar"))));
}
async function togglePack(i, who) {
  const has = S.packDone.some(d => d.item_id === i.id && d.person_id === who.id);
  if (has) S.packDone = S.packDone.filter(d => !(d.item_id === i.id && d.person_id === who.id)); else S.packDone.push({ item_id: i.id, person_id: who.id });
  render();
  await run(has ? sb.from("trip_packing_done").delete().eq("item_id", i.id).eq("person_id", who.id) : sb.from("trip_packing_done").insert({ item_id: i.id, person_id: who.id }));
}
async function removePack(i, e) {
  const b = e.currentTarget;
  if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Tirar?"; setTimeout(() => { b.classList.remove("armed"); b.textContent = "×"; }, 2500); return; }
  if (await run(sb.from("trip_packing").delete().eq("id", i.id), "Tirado da lista")) { await load("packing"); render(); }
}

/* ================= INFO ================= */
function renderInfo() {
  const v = $("#v-info");
  const card = (title, ...kids) => h("div", { class: "block" }, h("h3", null, title), ...kids);
  const facts = rows => h("dl", { class: "facts" }, rows.map(([k, val]) => [h("dt", null, k), h("dd", null, val)]));
  const a = (href, t) => h("a", { class: "link", href, target: "_blank", rel: "noopener" }, t);
  v.replaceChildren(
    head("Info útil", "Valores indicativos da época 2026/27, recolhidos em outubro de 2026. Confirmar antes de comprar."),
    h("div", { class: "grid-2" },
      card("Forfait",
        facts([
          ["Época", "5 dez 2026 — 18 abr 2027. 6–11 jan é época alta."],
          ["3 Vallées, 6 dias", "Adulto (18–74) ≈ 421 € · Criança (5–17) ≈ 345 €"],
          ["Méribel Vallée, 6 dias", "≈ 356 € adulto. Mais barato, mas só o vale de Méribel."],
          ["Family Flex", "2 adultos + 1 a 6 crianças pagam todos o preço de criança. Mesma duração, uma só compra."],
          ["Grátis", "Menos de 5 anos e mais de 75, com comprovativo."],
          ["Carré Neige", "Seguro de ski ≈ 21 € por pessoa para 6 dias."],
        ]),
        h("p", { class: "small muted" }, "Chegamos a 6 à noite e o voo de volta é a 11 às 18:35 em Lyon: são 4 dias completos de ski (7 a 10). Vale a pena decidir em grupo e comprar tudo de uma vez."),
        h("p", { class: "small" }, a("https://www.skipassmeribelmottaret.com/en/skipass-prices-3-vallees", "Preços 3 Vallées"), " · ", a("https://www.skipassmeribelmottaret.com/en/meribel-skipass-prices", "Preços Méribel"))),
      card("Como chegar",
        facts([
          ["Lyon (LYS)", "É onde chegamos: qua 6 jan às 17:45, volta seg 11 jan às 18:35. ≈ 2h–2h30 de estrada até Méribel. Confirmar que o transfer vai até Méribel e não só até Moûtiers."],
          ["Genebra (GVA)", "≈ 2h15–3h de estrada. Transfer partilhado ≈ 60–85 € p.p.; privado ≈ 300–500 € por carrinha."],
          ["Chambéry", "O mais perto (≈ 1h15), mas com poucos voos."],
          ["Comboio", "Estação de Moûtiers, a 18 km. Depois autocarro (≈ 45 min) ou táxi."],
        ]),
        h("p", { class: "small muted" }, "Para 8 pessoas com malas e uma criança, um transfer privado tende a sair parecido com lugares partilhados e é bem mais simples. Na volta, sair de Méribel por volta das 14h."),
        h("p", { class: "small" }, a("https://seemeribel.com/transfers/guide", "Guia de transfers"))),
      card("Na neve",
        facts([
          ["Emergência", h("a", { class: "link", href: "tel:112" }, "112"), ],
          ["Pistas", "Os pisteiros-socorristas tratam dos acidentes em pista. Guardar o número que vem no mapa das pistas."],
          ["Seguro", "Levar o Cartão Europeu de Seguro de Doença. O resgate em pista paga-se à parte, daí o Carré Neige."],
          ["Supermercado", "Há supermercados em Méribel e em Mottaret. Fazer as compras grandes no caminho sai mais barato."],
        ])),
      card("Logins",
        h("p", { class: "small muted" }, "Cada adulto tem o seu login. As crianças não precisam: os pais tratam das coisas delas."),
        h("div", { class: "tags" }, S.people.filter(p => p.email).map(p => h("span", { class: "tag" }, p.name))))));
}

/* ================= login snow ================= */
function snow() { snowIn(document.querySelector(".snow"), 60); }
function snowIn(box, count) {
  if (!box || box.childElementCount || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < count; i++) {
    const s = h("i"), size = 2 + Math.random() * 4;
    s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${8 + Math.random() * 10}s;animation-delay:${-Math.random() * 18}s;opacity:${.35 + Math.random() * .5}`;
    box.append(s);
  }
}

/* ================= boot ================= */
cursor();
await preloader();
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { S.me = null; } });
start();
