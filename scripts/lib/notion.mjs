const NOTION_VERSION = '2025-09-03';
const BASE_URL = 'https://api.notion.com/v1';

async function notionFetch(path, options = {}) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error('NOTION_TOKEN environment variable is not set.');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API error ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

// Pulls every row from a Notion data source (a database's collection), following pagination.
export async function queryDataSource(dataSourceId) {
  const results = [];
  let cursor;
  do {
    const body = cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 };
    const page = await notionFetch(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return results;
}

function plainText(richTextArr) {
  return (richTextArr || []).map((t) => t.plain_text).join('');
}

// Reads a single property off a Notion page object into a plain JS value.
export function prop(page, name) {
  const p = page.properties?.[name];
  if (!p) return undefined;
  switch (p.type) {
    case 'title':
      return plainText(p.title);
    case 'rich_text':
      return plainText(p.rich_text);
    case 'number':
      return p.number;
    case 'select':
      return p.select?.name;
    case 'status':
      return p.status?.name;
    case 'date':
      return p.date;
    case 'checkbox':
      return p.checkbox;
    case 'formula': {
      const f = p.formula;
      if (!f) return undefined;
      return f[f.type];
    }
    default:
      return undefined;
  }
}
