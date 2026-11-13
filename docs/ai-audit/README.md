# Qlip AI quality audit

This directory is the repeatable quality gate for the shared Qlip AI backend.
The web client and native Swift client consume the same `content_items`
contract; the retired Linkat Flutter app remains useful only as historical
product reference.

## Production baseline — 2026-07-21

Read-only aggregate queries against project `sjskpjgepbvblojohtlr` found:

| Signal | Count |
| --- | ---: |
| Total items | 1,763 |
| Missing summary | 1,263 |
| Missing embedding | 1,264 |
| Missing `raw_metadata.enriched_by` | 1,332 |
| Invalid/missing title | 13 |
| `raw_metadata.parse_error` | 37 |
| Failed or degraded | 223 |

The missing-provenance population is not one current-model failure. It contains
940 January article imports and 350 July RSS items, plus a small number of other
legacy rows. Current terminal job failures have clearer operational causes:

| Job | Error | Count |
| --- | --- | ---: |
| enrich | Gemini 429 after retries | 185 |
| enrich | worker timeout | 54 |
| parse | HTTP 403 | 15 |
| parse | PDF sent through HTML fallback | 6 |
| parse | worker timeout | 5 |
| parse | HTTP 400 | 5 |
| embed | worker timeout | 1 |

This proves at least four separate issue families: legacy/backfill coverage,
provider quota handling, worker time-budget design, and parser/fallback routing.

### Confirmed product and contract issues

The aggregate baseline and an authenticated read-only production UI inspection
confirmed the following. Counts are deliberately aggregate-only so the public
repository never contains private saved links.

| Family | Evidence | Impact |
| --- | --- | --- |
| Legacy coverage | 979 ready bookmarks have no summary; almost all global missing-summary/embedding counts are this legacy cohort | Global totals made the current pipeline look much worse than it is; a separate backfill decision is needed |
| Queue/provider | 185 enrichment jobs exhausted Gemini quota retries and 54 hit worker timeout | Items become `degraded` despite usable parsed content |
| Status contract | 145 degraded items contain at least 2,000 extracted characters; none has an AI summary | `degraded` currently conflates extraction quality with enrichment execution failure |
| Parser routing | 6 PDFs reached the HTML parser; 15 pages ended in HTTP 403 | Known source formats and blocked sites lose content before the model sees it |
| Feed parsing | 25 RSS items contain feed-wrapper fields such as an article URL instead of article body | The model can summarize feed plumbing rather than the linked source |
| Provenance | 1,332 items have no model stamp; current stamps contain only provider/model | Prompt, extraction quality, latency and fallback behavior cannot be audited per item |
| Worker design | Five jobs were claimed together while one deep-model call could outlive the 120s worker budget | Unprocessed claimed jobs appeared stuck and had to be reclaimed |
| Hallucination risk | The thin-content prompt explicitly instructed the model to infer a destination from URL/title | Confident claims could be produced without source evidence |
| Search wiring | The hybrid semantic-search Edge Function existed, but the web Library called FTS directly | Embeddings were generated and paid for without powering normal UI search |
| Library completeness | The production Library has 778 content rows but the client capped its query at 500 | 278 items were silently absent from the default Library result window |
| Filter usability | 1,907 distinct AI tags exist across content | Rendering every observed tag as a facet is noisy and makes the initial Library surface heavy |

Current content is healthier than the global legacy totals suggest: among 497
ready content items, only 2 lack summaries and 3 lack embeddings; among content
created in the last 30 days, 0 ready rows lack summaries and 1 lacks an embedding.
The dominant current defect is therefore queue/provider completion, not structured
output completeness after a successful enrichment.

## Issue taxonomy

- **Parsing:** AI received missing, truncated or incorrect source material.
- **Routing:** provider/tier choice did not match source type, extraction quality,
  input size or latency budget.
- **Prompt:** source material was sufficient but structured output was inaccurate.
- **Queue:** the job was delayed, retried, timed out or permanently failed.
- **Search:** the stored item cannot be found by the expected query.
- **UI:** persisted data is correct but a client displays or groups it incorrectly.

## Corpus

`fixtures/representative-links.json` defines 40 cases across articles, thin
bookmarks, YouTube, PDFs, social sources, multilingual content and failure
conditions. Public deterministic URLs are included directly. Social URLs are
runtime placeholders so private/user-specific links are never committed to this
public repository.

Validate the corpus:

```bash
npm run audit:ai:corpus
```

## Contract checker

Export audit rows as a JSON array containing the normal `content_items` fields
plus `raw_metadata` and a boolean `has_embedding`. Then run:

```bash
npm run audit:ai -- /path/to/sanitized-content-items.json
```

The checker never needs titles, URLs or full content in committed output. Its
report uses IDs and quality signals only. Keep live exports outside the repo.

## Target `content_items` contract

Every newly processed item must expose:

- a non-URL human title;
- correct `source_type` and a persisted AI `content_type_label`;
- `summary`, `key_points`, `tags`, `topic` and `language`;
- predictable `status` plus structured failure/degradation metadata;
- `raw_metadata.ai` provenance containing provider, model, prompt version,
  input characters, extraction quality and enrichment timestamp;
- an embedding, or an explicit terminal embedding error;
- parser provenance and processing duration for each pipeline stage.

## Contract v2 implementation

The first hardening pass adds:

- persisted `content_type_label` (`0015_ai_contract_v2.sql`);
- `raw_metadata.ai` with provider, model, tier, prompt version, input size,
  extraction quality, fallback source, timestamp and duration;
- `raw_metadata.parser` and terminal `raw_metadata.processing.<stage>` outcomes;
- evidence-bounded thin-content prompting;
- one-at-a-time job claiming and a model timeout that leaves room for fallback;
- hybrid semantic search in the Library with FTS fallback;
- deterministic 1,000-row paging loops in both web and Swift so PostgREST's
  per-response cap never hides older vault items.

Run the regression gates:

```bash
npm run audit:ai:corpus
npm run test:ai
npm run build
```

## Production smoke verification

Migration `0015_ai_contract_v2.sql` and `job-worker` v16 were deployed on
2026-07-21. A fresh public metadata-only URL completed the full live path:

- `pending → parsing → enriching → ready`;
- NVIDIA fast tier (`openai/gpt-oss-20b`) in 2.7 seconds;
- prompt version and extraction quality stored in `raw_metadata.ai`;
- parser, enrich and embed stages stored as `done`;
- `gemini-embedding-001` embedding present.

The smoke result also exposed a subtle classification defect: the model labeled a
metadata-only placeholder page as `News Article`. Contract v2.1 now forces generic
metadata-only destinations to `Other` (or `Social Post` for known social sources)
and explicitly forbids guessing that a thin destination is an article, tutorial,
product or news story. This is covered by the regression suite and was deployed
as `job-worker` v17.

The remaining quality exercise is a full corpus run through an isolated test user;
the deterministic contract, deployment and native-client prerequisites are complete.
The cross-client product requirements and release evidence are tracked in
[`../cross-client-release-audit.md`](../cross-client-release-audit.md).
