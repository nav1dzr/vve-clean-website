// Safe display-time formatting for customer-entered name/address/postcode/
// email values on invoice/receipt PDFs and emails. Deliberately
// conservative: this never touches stored data (it's applied only where a
// value is rendered), and it never blindly title-cases everything — mixed
// deliberate capitalisation (company names, initialisms) is left alone.
// Duplicated locally rather than shared with admin/src's client copy — the
// admin API (Node/serverless) and admin/src (Vite browser bundle) are two
// separate build targets that don't share code; see
// admin/api/_lib/escHtml.js's header for the same rationale.

const PRESERVED_UPPER_TOKENS = new Set(['UK', 'USA']);

// Only characters a genuine name/address would plausibly contain. Anything
// outside this set (angle brackets, "=", parentheses, etc.) is left
// completely untouched rather than risk re-casing something that was never
// a name to begin with (e.g. stray markup ending up in a form field).
const PLAUSIBLE_NAME_OR_ADDRESS = /^[a-zA-Z0-9 '\-.,&/]*$/;

function isAllLowerCase(str) {
  return str === str.toLowerCase() && str !== str.toUpperCase();
}

function isAllUpperCase(str) {
  return str === str.toUpperCase() && str !== str.toLowerCase();
}

// Capitalises the first letter of a word and each letter that follows a
// hyphen or apostrophe (so "smith-jones" -> "Smith-Jones" and "o'connor"
// -> "O'Connor"), lower-casing everything else.
function titleCaseWord(word) {
  return word
    .split(/([-'])/)
    .map((part) => (part === '-' || part === "'" ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('');
}

// Only converts case when the WHOLE value looks like it was typed entirely
// in one case (all-lowercase or all-uppercase) — a mixed-case value (e.g.
// "McDonald", "VVE Ltd") is assumed deliberate and left untouched. Tokens
// containing a digit (flat numbers, postcode fragments embedded in an
// address line) are never re-cased, and a small set of recognised
// uppercase abbreviations is preserved even when the rest of the value is
// converted.
export function smartTitleCase(value) {
  if (!value) return value;
  const str = String(value);
  if (!PLAUSIBLE_NAME_OR_ADDRESS.test(str)) return str;
  if (!isAllLowerCase(str) && !isAllUpperCase(str)) return str;

  return str
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/\d/.test(word)) return word;
      const upperWord = word.toUpperCase();
      if (PRESERVED_UPPER_TOKENS.has(upperWord)) return upperWord;
      return titleCaseWord(word);
    })
    .join(' ');
}

// Uppercases and normalises spacing to the standard UK "OUTWARD INWARD"
// form (single space before the 3-character inward code) regardless of how
// it was typed — "w23el" -> "W2 3EL", "nw37aj" -> "NW3 7AJ". Falls back to
// a plain uppercase/trim for anything too short to safely split.
export function formatPostcodeDisplay(value) {
  if (!value) return value;
  const cleaned = String(value).replace(/\s+/g, '').toUpperCase();
  if (cleaned.length < 5) return cleaned;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}

export function formatEmailDisplay(value) {
  if (!value) return value;
  return String(value).trim().toLowerCase();
}
