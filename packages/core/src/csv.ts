/** Parses CSV text into rows, handling quoted fields, escaped quotes and CRLF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const delimiter = detectDelimiter(text);

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

// Spreadsheet exports in Indonesian locales often use semicolons.
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
}

const WEBSITE_HEADER = /^(website|web|url|domain|situs|site|homepage)$/i;
const LOOKS_LIKE_WEBSITE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

/**
 * Finds website addresses in a CSV export: the column headed "website", "url", "domain" etc., or
 * else every cell that looks like a website address.
 */
export function websitesFromCsv(text: string): string[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const header = rows[0] ?? [];
  const column = header.findIndex((h) => WEBSITE_HEADER.test(h.trim()));

  const values =
    column >= 0
      ? rows.slice(1).map((r) => r[column] ?? '')
      : rows.flat().filter((cell) => LOOKS_LIKE_WEBSITE.test(cell.trim()) && !cell.includes('@'));

  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}
