import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = path.join(root, 'fixtures', 'representative-links.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateCorpus() {
  const corpus = readJson(corpusPath);
  const errors = [];
  const ids = new Set();
  const categories = new Map();

  if (!Array.isArray(corpus.cases)) errors.push('cases must be an array');
  for (const [index, item] of (corpus.cases ?? []).entries()) {
    const where = `cases[${index}]`;
    if (!item.id) errors.push(`${where}: id is required`);
    if (ids.has(item.id)) errors.push(`${where}: duplicate id ${item.id}`);
    ids.add(item.id);
    if (!item.category) errors.push(`${where}: category is required`);
    if (!item.url && !item.required_env) errors.push(`${where}: url or required_env is required`);
    if (item.url && item.required_env) errors.push(`${where}: use url or required_env, not both`);
    if (!item.expected_source_type) errors.push(`${where}: expected_source_type is required`);
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
  }
  if ((corpus.cases ?? []).length < 30 || (corpus.cases ?? []).length > 50) {
    errors.push(`expected 30-50 cases, found ${(corpus.cases ?? []).length}`);
  }

  if (errors.length) {
    console.error(`Corpus validation failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Corpus valid: ${corpus.cases.length} cases`);
  for (const [category, count] of [...categories.entries()].sort()) {
    console.log(`- ${category}: ${count}`);
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function classify(item) {
  const issues = [];
  const meta = item.raw_metadata && typeof item.raw_metadata === 'object'
    ? item.raw_metadata
    : {};
  const ai = meta.ai && typeof meta.ai === 'object' ? meta.ai : {};
  const title = text(item.title);
  const status = text(item.status);

  if (!title || /^https?:\/\//i.test(title)) issues.push(['contract', 'invalid_title']);
  if (!text(item.source_type)) issues.push(['contract', 'missing_source_type']);
  if (status === 'ready') {
    if (!text(item.summary)) issues.push(['prompt', 'missing_summary']);
    if (!Array.isArray(item.key_points) || item.key_points.length === 0) issues.push(['prompt', 'missing_key_points']);
    if (!Array.isArray(item.tags) || item.tags.length === 0) issues.push(['prompt', 'missing_tags']);
    if (!text(item.topic)) issues.push(['prompt', 'missing_topic']);
    if (!text(item.language)) issues.push(['prompt', 'missing_language']);
    if (!item.has_embedding) issues.push(['search', 'missing_embedding']);
  }
  if (status === 'failed' || status === 'degraded') issues.push(['queue', `terminal_${status}`]);
  if (meta.parse_error) issues.push(['parsing', 'parse_error']);
  if (!text(meta.enriched_by) && !text(ai.model)) issues.push(['routing', 'missing_ai_provenance']);
  if (!text(item.content_type_label)) issues.push(['contract', 'missing_content_type_label']);
  if (!text(ai.prompt_version)) issues.push(['observability', 'missing_prompt_version']);
  if (!Number.isFinite(ai.input_chars)) issues.push(['observability', 'missing_input_chars']);
  if (!text(ai.extraction_quality)) issues.push(['observability', 'missing_extraction_quality']);
  if (!text(ai.enriched_at)) issues.push(['observability', 'missing_enriched_at']);
  if (!meta.parser && !meta.parser_name && !meta.text_source && !meta.transcript_source) {
    issues.push(['observability', 'missing_parser_provenance']);
  }
  return issues;
}

function analyze(file) {
  const items = readJson(file);
  if (!Array.isArray(items)) {
    console.error('Audit input must be a JSON array');
    process.exitCode = 1;
    return;
  }

  const counts = new Map();
  const affected = new Map();
  for (const item of items) {
    for (const [family, code] of classify(item)) {
      const key = `${family}:${code}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const ids = affected.get(key) ?? [];
      if (ids.length < 10) ids.push(String(item.id ?? '(missing-id)'));
      affected.set(key, ids);
    }
  }

  console.log(`# Qlip AI contract report\n\nItems analyzed: ${items.length}\n`);
  console.log('| Issue | Count | Sample item IDs |');
  console.log('| --- | ---: | --- |');
  for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`| ${key} | ${count} | ${(affected.get(key) ?? []).join(', ')} |`);
  }
  if (counts.size === 0) console.log('| none | 0 | — |');
}

const arg = process.argv[2];
if (arg === '--validate-corpus' || !arg) validateCorpus();
else analyze(path.resolve(arg));
