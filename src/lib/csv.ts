/**
 * Reads CSV text into rows of cells: quoted cells (with "" for a quote and line breaks inside),
 * CRLF or LF line ends, and a leading byte-order mark (Excel adds one). Comma-separated only.
 * Throws when a quoted cell is never closed.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = false;
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("A quoted cell is not closed. Check the file for a stray quote mark.");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * One CSV cell, quoted. Spreadsheet programs run text that starts with = + - @ (or a tab or carriage
 * return) as a formula, so a patient named "=HYPERLINK(...)" could execute when the file is opened
 * (CSV injection). A leading apostrophe turns it into plain text. Numbers are written as they are.
 */
export function csvCell(value: string | number) {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export const csvLine = (cells: (string | number)[]) => cells.map(csvCell).join(",");
