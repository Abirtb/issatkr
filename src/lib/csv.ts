// One CSV cell for files opened in Excel: quoted, and neutralised when it would
// otherwise be read as a formula (=, +, -, @, tab, CR at the start).
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[], separator = ";") {
  return values.map(csvCell).join(separator);
}
