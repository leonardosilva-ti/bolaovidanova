// ---------- HTML seguro ----------

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marca uma string como HTML confiável (não será escapada). */
export const raw = (value) => new SafeHtml(String(value));

function renderValue(value) {
  if (value == null || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return escapeHtml(value);
}

/** Template literal que escapa automaticamente todos os valores interpolados. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += renderValue(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

export function render(el, content) {
  el.innerHTML = renderValue(content);
}

// ---------- Texto / números ----------

export const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
export const pad2 = (n) => String(n).padStart(2, "0");

export function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatDateMask(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** "dd/mm/aaaa" -> "aaaa-mm-dd" (ou "" se inválida). */
export function brToIsoDate(value) {
  const m = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const valid = date.getFullYear() === Number(yyyy) && date.getMonth() === Number(mm) - 1 &&
    date.getDate() === Number(dd) && date < new Date() && Number(yyyy) > 1900;
  return valid ? `${yyyy}-${pad2(mm)}-${pad2(dd)}` : "";
}

export const isoToBrDate = (iso) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? "");
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (value) => BRL.format(Number(value) || 0);

/** Exibe o prêmio estimado: números são formatados, textos livres são mantidos. */
export function formatPremio(value) {
  if (value === "" || value == null) return "";
  if (typeof value === "number") return formatBRL(value);
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return formatBRL(Number(s));
  return s.toUpperCase().startsWith("R$") ? s : `R$ ${s}`;
}

/** Aceita "05,14,23..." ou "05 14 23..." e retorna array de números. */
export function parseNumberList(value) {
  return String(value ?? "").split(/[^\d]+/).filter(Boolean).map(Number);
}

/** Valida 6 dezenas únicas entre 1 e 60. Retorna { ok, dezenas, error }. */
export function validarDezenas(nums, label = "O jogo") {
  if (nums.length !== 6 || nums.some((n) => !Number.isInteger(n))) return { ok: false, error: `${label} precisa ter 6 dezenas.` };
  if (nums.some((n) => n < 1 || n > 60)) return { ok: false, error: `${label} tem dezenas fora de 01–60.` };
  if (new Set(nums).size !== 6) return { ok: false, error: `${label} tem dezenas repetidas.` };
  return { ok: true, dezenas: [...nums].sort((a, b) => a - b).map(pad2) };
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores sem Clipboard API (ou contexto não seguro)
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export const storage = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* indisponível */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* indisponível */ } },
};
