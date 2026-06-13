#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = 'e131a55b-0bdf-437f-8f17-7ef748eb8416';
const DATA_FILE = path.join(__dirname, 'data.json');

function notionQuery(cursor) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {})
    });
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/databases/${DB_ID}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function num(props, key) {
  return props[key]?.number ?? 0;
}

async function main() {
  if (!TOKEN) {
    console.error('Fehler: NOTION_TOKEN nicht gesetzt.');
    console.error('Lokal: NOTION_TOKEN=ntn_... node refresh.js');
    process.exit(1);
  }

  console.log('Lade Notion-Daten...');
  let allResults = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const data = await notionQuery(cursor);
    if (data.object === 'error') {
      console.error('Notion API Fehler:', data.message);
      process.exit(1);
    }
    allResults.push(...data.results);
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  const rows = allResults
    .filter(p => !p.in_trash && !p.is_archived)
    .map(p => {
      const props = p.properties;
      return {
        person: props['Person']?.select?.name ?? '',
        datum: props['Datum']?.date?.start ?? '',
        waehlersuche: num(props, 'Wählversuche'),
        gf: num(props, 'GF gesprochen'),
        pitch: num(props, 'Pitch'),
        terminiert: num(props, 'Terminiert'),
        quali: num(props, 'Quali Calls'),
        sales: num(props, 'Sales Calls'),
        noshows: num(props, 'No Shows'),
        abschluesse: num(props, 'Abschlüsse'),
        umsatz: num(props, 'Umsatz')
      };
    })
    .filter(r => r.person && r.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const output = {
    lastUpdated: new Date().toISOString(),
    rows
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  console.log(`✓ data.json aktualisiert: ${rows.length} Einträge (${output.lastUpdated})`);
}

main().catch(e => { console.error(e); process.exit(1); });
