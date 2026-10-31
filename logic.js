// Pure trip logic: quick-entry parser, expense shares, family balances and settle-up.
// No DOM and no network, so it can be tested with plain Node.

export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const cents = x => Math.round(Number(x) * 100);

export const CATS = ["Alojamento", "Viagem", "Transfer", "Forfait", "Material", "Aulas", "Supermercado", "Restaurantes", "Après-ski", "Carro", "Outros"];

const CAT_KW = [
  [/aloja|chalet|apartamento|airbnb|booking|casa\b|renda|sinal|cau[cç]ao/, "Alojamento"],
  [/\bvoos?\b|aviao|ryanair|easyjet|tap\b|bilhetes? de aviao|bagagem|mala de porao/, "Viagem"],
  [/transfer|shuttle|altibus|taxi|uber|autocarro|comboio|navette/, "Transfer"],
  [/forfait|forfeit|lift ?pass|ski ?pass|passe|carre neige|seguro/, "Forfait"],
  [/material|aluguer|alugar|skis?\b|snowboard|botas|capacete|bastoes|intersport|skiset|sport 2000/, "Material"],
  [/aulas?|escola|esf\b|monitor|instrutor|prof/, "Aulas"],
  [/super|sherpa|carrefour|spar\b|compras|mercearia|pao|padaria|boulangerie|vinho|cerveja|agua/, "Supermercado"],
  [/jantar|almoco|restaur|pizza|fondue|raclette|cafe\b|lanche|crepe|pequeno.almoco/, "Restaurantes"],
  [/apres|bar\b|copos|folie douce|rond.point|shots|gin/, "Après-ski"],
  [/gasolina|gasoleo|combust|portage|peage|estaciona|parking|parque|aluguer de carro|rent.?a.?car|carro/, "Carro"],
];
export const guessCat = text => CAT_KW.find(([re]) => re.test(norm(text)))?.[1] || "Outros";

// Words that point to a person. Family heads (person id === family id) stand for their whole family.
export const ALIASES = {
  alexandre: ["alexandre", "alex", "eu", "mim"],
  jose: ["jose inacio", "jose", "ze", "inacio", "nacho"],
  ricardo: ["ricardo sarmento", "ricardo", "sarmento"],
  miguel: ["miguel"],
  guga: ["guga"],
  kika: ["kika"],
  daniel: ["daniel"],
  marina: ["marina"],
  tomas: ["tomas"],
};

function findNames(text, me) {
  const t = " " + norm(text) + " ", hits = [];
  for (const [id, words] of Object.entries(ALIASES))
    for (const w of words) {
      const re = new RegExp(`(^|[^a-z])${w}([^a-z]|$)`);
      if (re.test(t)) { hits.push(id === "alexandre" && (w === "eu" || w === "mim") ? me : id); break; }
    }
  return [...new Set(hits)];
}

// Expand a named person: a family head means the whole family; anyone else means just them.
export function expand(ids, people) {
  const out = new Set();
  for (const id of ids) {
    const p = people.find(x => x.id === id);
    if (!p) continue;
    if (p.id === p.family_id) people.filter(x => x.family_id === p.family_id).forEach(x => out.add(x.id));
    else out.add(p.id);
  }
  return [...out];
}

/* "120 sherpa, 45 jantar pago pelo miguel, 300 aulas só miguel e daniel, 80 gasolina sem josé, 60 portagens por família"
   → [{ amount, descr, cat, paid_by, split, mode }] */
const NAME = Object.values(ALIASES).flat().sort((a, b) => b.length - a.length).join("|");
const ART = "(?:(?:o|a|os|as)\\s+)?";
const LIST = `((?:${NAME})(?:\\s*(?:,|\\be\\b)?\\s*${ART}(?:${NAME})\\b)*)`;
const PAY_AFTER = new RegExp(`\\b(?:pago|paga|pagou|pagaram|pagos)\\s+(?:pel[oa]s?\\s+|por\\s+)?(${NAME})\\b`);
const PAY_BEFORE = new RegExp(`\\b(${NAME})\\s+(?:pagou|paga|pagaram)\\b`);
const ONLY = new RegExp(`\\b(?:so|apenas|somente|entre)\\s+${ART}${LIST}`);
const EXCEPT = new RegExp(`\\b(?:sem|exceto|excepto|menos|tirando)\\s+${ART}${LIST}`);

export function parseQuick(text, people, me) {
  const all = people.map(p => p.id);
  return String(text).split(/(?<!\d),|,(?!\d)|;|\n|\s+e\s+(?=\d)/i).map(s => s.trim()).filter(Boolean).map(chunk => {
    const m = chunk.match(/€?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?\b)?/i);
    if (!m) return null;
    const raw = /\.\d{3}/.test(m[1]) ? m[1].replace(/\./g, "").replace(",", ".") : m[1].replace(",", ".");
    const amount = Math.round(parseFloat(raw) * 100) / 100;
    if (!(amount > 0)) return null;
    const origTok = (chunk.slice(0, m.index) + " " + chunk.slice(m.index + m[0].length)).split(/\s+/).filter(Boolean);
    const normTok = origTok.map(norm);
    let n = normTok.join(" ");

    // who paid
    let paid_by = me, pm;
    if ((pm = n.match(PAY_AFTER)) || (pm = n.match(PAY_BEFORE))) { paid_by = findNames(pm[1], me)[0] || me; n = n.replace(pm[0], " "); }
    else if ((pm = n.match(/\bpaguei\b/))) { paid_by = me; n = n.replace(pm[0], " "); }

    // who shares it
    let split = all, mode = "pessoas";
    const onlyM = n.match(ONLY), exM = n.match(EXCEPT);
    if (/\b(so\s+)?(os\s+)?adultos\b/.test(n)) { split = people.filter(p => p.adult).map(p => p.id); n = n.replace(/\b(so\s+)?(os\s+)?adultos\b/, " "); }
    else if (/\b(so\s+)?(as\s+|os\s+)?(criancas|miudos|putos|filhos)\b/.test(n)) { split = people.filter(p => !p.adult).map(p => p.id); n = n.replace(/\b(so\s+)?(as\s+|os\s+)?(criancas|miudos|putos|filhos)\b/, " "); }
    else if (onlyM) { split = expand(findNames(onlyM[1], me), people); n = n.replace(onlyM[0], " "); }
    else if (exM) { const out = expand(findNames(exM[1], me), people); split = all.filter(id => !out.includes(id)); n = n.replace(exM[0], " "); }
    if (/\bpor\s+(familias?|casa|agregado)\b/.test(n)) { mode = "familias"; n = n.replace(/\bpor\s+(familias?|casa|agregado)\b/, " "); }
    if (/\bpor\s+(pessoa|cabeca)\b/.test(n)) { mode = "pessoas"; n = n.replace(/\bpor\s+(pessoa|cabeca)\b/, " "); }

    // description from what is left, keeping the original accents where possible
    const remTok = n.split(/\s+/).filter(Boolean), kept = [];
    for (let i = 0, k = 0; i < origTok.length && k < remTok.length; i++) if (normTok[i] === remTok[k]) { kept.push(origTok[i]); k++; }
    const STOP = new Set(["no", "na", "nos", "nas", "em", "de", "do", "da", "dos", "das", "o", "a", "os", "as", "gastei", "gastamos", "euro", "euros", "€", "e"]);
    while (kept.length && STOP.has(norm(kept[0]))) kept.shift();
    while (kept.length && STOP.has(norm(kept[kept.length - 1]))) kept.pop();
    let descr = kept.filter(w => !/^(gastei|gastámos|gastamos|euros?|€)$/i.test(w)).join(" ").trim();
    descr = descr ? descr.charAt(0).toUpperCase() + descr.slice(1) : null;
    const cat = guessCat(chunk);
    return { amount, descr: descr || cat, cat, paid_by, split, mode };
  }).filter(Boolean);
}

/* Per-family share of one expense, in cents. Leftover cents from rounding go to the payer's family first,
   so nobody else ends up owing a stray cent. */
export function familyShares(e, people) {
  const total = cents(e.amount), split = people.filter(p => e.split.includes(p.id));
  const out = {};
  if (!split.length) return out;
  const payerFam = people.find(p => p.id === e.paid_by)?.family_id;
  const payerFirst = fams => fams.includes(payerFam) ? [payerFam, ...fams.filter(f => f !== payerFam)] : fams;
  if (e.mode === "familias") {
    const fams = payerFirst([...new Set(split.map(p => p.family_id))]);
    const base = Math.floor(total / fams.length); let rem = total - base * fams.length;
    fams.forEach(f => { out[f] = base + (rem-- > 0 ? 1 : 0); });
  } else {
    const W = split.reduce((a, p) => a + Number(p.weight ?? 1), 0) || 1;
    let given = 0;
    const byFam = {};
    split.forEach(p => { byFam[p.family_id] = (byFam[p.family_id] || 0) + Number(p.weight ?? 1); });
    const fams = payerFirst(Object.keys(byFam));
    fams.forEach(f => { out[f] = Math.floor(total * byFam[f] / W); given += out[f]; });
    let rem = total - given, i = 0;
    while (rem > 0) { out[fams[i % fams.length]]++; rem--; i++; }
  }
  return out;
}

/* Balance per family in cents: positive = the group owes them, negative = they owe the group. */
export function balances(expenses, transfers, people, families) {
  const bal = Object.fromEntries(families.map(f => [f.id, 0]));
  const paid = Object.fromEntries(families.map(f => [f.id, 0]));
  const cost = Object.fromEntries(families.map(f => [f.id, 0]));
  const fam = id => people.find(p => p.id === id)?.family_id;
  for (const e of expenses) {
    const payer = fam(e.paid_by);
    if (payer in bal) { bal[payer] += cents(e.amount); paid[payer] += cents(e.amount); }
    for (const [f, c] of Object.entries(familyShares(e, people))) if (f in bal) { bal[f] -= c; cost[f] += c; }
  }
  for (const t of transfers) {
    if (t.from_family in bal) bal[t.from_family] += cents(t.amount);
    if (t.to_family in bal) bal[t.to_family] -= cents(t.amount);
  }
  return { bal, paid, cost };
}

/* Fewest transfers that settle everything: biggest debtor pays biggest creditor, repeat. */
export function settle(bal) {
  const deb = Object.entries(bal).filter(([, v]) => v < 0).map(([f, v]) => ({ f, v: -v })).sort((a, b) => b.v - a.v);
  const cre = Object.entries(bal).filter(([, v]) => v > 0).map(([f, v]) => ({ f, v })).sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0, j = 0;
  while (i < deb.length && j < cre.length) {
    const x = Math.min(deb[i].v, cre[j].v);
    if (x > 0) out.push({ from: deb[i].f, to: cre[j].f, cents: x });
    deb[i].v -= x; cre[j].v -= x;
    if (deb[i].v === 0) i++;
    if (cre[j].v === 0) j++;
  }
  return out;
}

/* Status of a person for a to-sort item. Missing row = default. */
export const defaultStatus = item => item.optional ? "decidir" : "falta";
export const NEXT_STATUS = { decidir: "falta", falta: "tratado", tratado: "nao", nao: "decidir" };
