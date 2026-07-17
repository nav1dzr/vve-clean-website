// Extracts the human-readable text drawn in a pdfkit-generated PDF for use
// in test assertions ("toContain('Amount Due')" etc).
//
// invoicePdf.js embeds a custom TrueType font (Space Grotesk) as a
// subsetted Type0/Identity-H composite font. Unlike pdfkit's built-in
// WinAnsiEncoded standard fonts (where a hex-encoded glyph code IS the
// literal ASCII/Latin-1 byte — see the old asText() helper this file
// replaces), an embedded subset font assigns arbitrary internal glyph
// codes per document, so the drawn hex tokens are meaningless without
// resolving each font's /ToUnicode CMap — the same mechanism PDF viewers
// use for "select all / copy text" on embedded-font documents. This walks
// every Page's content stream, tracks the active font via `Tf` operators,
// and decodes each `TJ`/`Tj` hex token through that font's ToUnicode map
// (or as literal Latin-1 bytes for a standard font, which has none).
//
// Requires the PDF to be generated with `compress: false` (uncompressed
// streams) — see invoicePdf.js's compress:false comment.

function findObjects(raw) {
  const objects = new Map();
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  let m;
  while ((m = re.exec(raw))) {
    objects.set(Number(m[1]), m[2]);
  }
  return objects;
}

function streamBody(objectText) {
  if (!objectText) return null;
  const m = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(objectText);
  return m ? m[1] : null;
}

function resolveRef(text, key) {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(text);
  return m ? Number(m[1]) : null;
}

function parseToUnicodeMap(streamText) {
  const map = new Map();
  const rangeRe = /beginbfrange\s*\r?\n([\s\S]*?)endbfrange/g;
  let rm;
  while ((rm = rangeRe.exec(streamText))) {
    const entryRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]+)\]/g;
    let em;
    while ((em = entryRe.exec(rm[1]))) {
      const start = parseInt(em[1], 16);
      const dstTokens = em[3].match(/<([0-9a-fA-F]+)>/g) || [];
      dstTokens.forEach((tok, i) => {
        const hex = tok.slice(1, -1);
        let chars = '';
        for (let j = 0; j < hex.length; j += 4) {
          chars += String.fromCharCode(parseInt(hex.slice(j, j + 4), 16));
        }
        map.set(start + i, chars);
      });
    }
  }
  return map;
}

export function extractPdfText(buffer) {
  const raw = buffer.toString('latin1');
  const objects = findObjects(raw);
  const dictOf = (objNum) => objects.get(objNum) || '';
  const fontDecoderCache = new Map();

  function fontDecoderFor(fontObjNum) {
    if (fontDecoderCache.has(fontObjNum)) return fontDecoderCache.get(fontObjNum);
    const text = dictOf(fontObjNum);
    const isType0 = /\/Subtype\s*\/Type0/.test(text);
    const toUniNum = resolveRef(text, 'ToUnicode');
    let unicodeMap = null;
    if (toUniNum != null) {
      const body = streamBody(dictOf(toUniNum));
      if (body) unicodeMap = parseToUnicodeMap(body);
    }
    const decoder = {
      // Hex digits per glyph code: Type0/Identity-H uses 2-byte CIDs (4 hex
      // digits); a standard Type1 font uses 1-byte codes (2 hex digits).
      byteWidth: isType0 ? 4 : 2,
      decode(code) {
        if (unicodeMap) return unicodeMap.get(code) || '';
        return String.fromCharCode(code);
      },
    };
    fontDecoderCache.set(fontObjNum, decoder);
    return decoder;
  }

  let output = '';
  const tokenRe = /\/(\S+)\s+[\d.]+\s+Tf|\[((?:<[0-9a-fA-F]+>|[-\d.]+|\s)+)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g;

  for (const [, pageText] of objects) {
    if (!/\/Type\s*\/Page\b/.test(pageText) || /\/Type\s*\/Pages\b/.test(pageText)) continue;
    const resourcesNum = resolveRef(pageText, 'Resources');
    const contentsNum = resolveRef(pageText, 'Contents');
    if (contentsNum == null) continue;

    const resourcesText = resourcesNum != null ? dictOf(resourcesNum) : '';
    const fontsDictMatch = /\/Font\s*<<([\s\S]*?)>>/.exec(resourcesText);
    const resourceFont = new Map();
    if (fontsDictMatch) {
      const entryRe = /\/(\S+)\s+(\d+)\s+0\s+R/g;
      let em;
      while ((em = entryRe.exec(fontsDictMatch[1]))) resourceFont.set(em[1], Number(em[2]));
    }

    const body = streamBody(dictOf(contentsNum));
    if (!body) continue;

    let currentDecoder = null;
    tokenRe.lastIndex = 0;
    let tm;
    while ((tm = tokenRe.exec(body))) {
      if (tm[1]) {
        const fontObjNum = resourceFont.get(tm[1]);
        currentDecoder = fontObjNum != null ? fontDecoderFor(fontObjNum) : null;
        continue;
      }
      const arrayOrSingle = tm[2] != null ? tm[2] : tm[3];
      if (arrayOrSingle == null || !currentDecoder) continue;
      const hexTokens = tm[2] != null
        ? (arrayOrSingle.match(/<([0-9a-fA-F]+)>/g) || [])
        : [`<${arrayOrSingle}>`];
      for (const hexTok of hexTokens) {
        const hex = hexTok.slice(1, -1);
        for (let i = 0; i < hex.length; i += currentDecoder.byteWidth) {
          const codeHex = hex.slice(i, i + currentDecoder.byteWidth);
          if (codeHex.length < currentDecoder.byteWidth) continue;
          output += currentDecoder.decode(parseInt(codeHex, 16));
        }
      }
    }
  }

  return output;
}
