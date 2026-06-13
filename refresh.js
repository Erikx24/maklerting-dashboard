#!/usr/bin/env node
/**
 * Notion-Daten neu laden und data.json aktualisieren.
 * Danach: git add data.json && git commit -m "data: refresh" && git push
 *
 * Voraussetzung: claude CLI muss installiert und mit Notion MCP verbunden sein.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const prompt = [
  'Use the notion MCP tool notion-query-database-view to query',
  'view_url "view://37eeee07-459d-8101-ae04-000cfb7f70a7" with page_size 100.',
  'Output ONLY a valid JSON object with two fields:',
  '"lastUpdated": current ISO timestamp,',
  '"rows": array of objects with keys:',
  'person (string), datum (ISO date), waehlersuche (number),',
  'gf (number), pitch (number), terminiert (number),',
  'quali (number), sales (number), noshows (number),',
  'abschluesse (number), umsatz (number).',
  'Replace null/undefined with 0. Output ONLY the JSON, nothing else.'
].join(' ');

console.log('Lade Notion-Daten via Claude CLI…');

let stdout;
try {
  stdout = execSync(
    `claude -p "${prompt.replace(/"/g, '\\"')}" --output-format text`,
    { timeout: 90000, encoding: 'utf8' }
  );
} catch (e) {
  console.error('claude CLI Fehler:', e.message);
  process.exit(1);
}

const jsonMatch = stdout.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error('Kein JSON in der Ausgabe gefunden:\n', stdout.slice(0, 500));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(jsonMatch[0]);
} catch (e) {
  console.error('JSON Parse-Fehler:', e.message);
  process.exit(1);
}

if (!Array.isArray(data.rows) || data.rows.length === 0) {
  console.error('rows fehlt oder leer — Abbruch.');
  process.exit(1);
}

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log(`✓ data.json aktualisiert: ${data.rows.length} Einträge (${data.lastUpdated})`);
console.log('');
console.log('Jetzt pushen:');
console.log('  git add data.json');
console.log('  git commit -m "data: refresh $(date +%Y-%m-%d)"');
console.log('  git push');
