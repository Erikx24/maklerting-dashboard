const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3333;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => res.redirect('/index.html'));

app.get('/api/data', (req, res) => {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch (e) {
    res.status(500).json({ error: 'data.json nicht gefunden', details: e.message });
  }
});

app.post('/api/refresh', (req, res) => {
  const prompt = [
    'Use the notion MCP tool mcp__83b61349-df9a-4b88-9cf3-60a81dcb1ac8__notion-query-database-view to query',
    'view_url "view://37eeee07-459d-8101-ae04-000cfb7f70a7" with page_size 100.',
    'Then output ONLY a valid JSON object (no markdown, no explanation) with two fields:',
    '"lastUpdated": ISO timestamp of now,',
    '"rows": array of objects, one per entry, each with keys:',
    'person (string: "Erik" or "Soufian"),',
    'datum (ISO date string from date:Datum:start),',
    'waehlersuche (number, Wählversuche or 0),',
    'gf (number, GF gesprochen or 0),',
    'pitch (number, Pitch or 0),',
    'terminiert (number, Terminiert or 0),',
    'quali (number, Quali Calls or 0),',
    'sales (number, Sales Calls or 0),',
    'noshows (number, No Shows or 0),',
    'abschluesse (number, Abschlüsse or 0),',
    'umsatz (number, Umsatz or 0).',
    'Replace null/undefined with 0. Output ONLY the JSON object.'
  ].join(' ');

  const cmd = `claude -p "${prompt.replace(/"/g, '\\"')}" --output-format text`;

  exec(cmd, { timeout: 90000, cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error('Claude CLI Fehler:', error.message);
      const cached = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return res.json({ ...cached, refreshError: error.message, refreshed: false });
    }

    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Kein JSON in Ausgabe:', stdout.slice(0, 500));
      const cached = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return res.json({ ...cached, refreshError: 'Kein JSON gefunden', refreshed: false });
    }

    try {
      const newData = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(newData.rows) || newData.rows.length === 0) {
        throw new Error('rows fehlt oder leer');
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
      return res.json({ ...newData, refreshed: true });
    } catch (parseErr) {
      console.error('Parse-Fehler:', parseErr.message);
      const cached = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return res.json({ ...cached, refreshError: parseErr.message, refreshed: false });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Maklerting Dashboard läuft auf http://localhost:${PORT}`);
  console.log(`Dashboard öffnen: http://localhost:${PORT}/dashboard.html`);
});
