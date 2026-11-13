# Qlip cross-client release audit

This checklist is the durable acceptance contract for the web app, native iOS
app, Share Extension, Supabase schema and AI pipeline. A row is complete only
when the cited source or runtime check proves the user-visible requirement.

| # | Requirement | Authoritative implementation evidence | Verification |
| ---: | --- | --- | --- |
| 1 | Qlip logo on white for the app and extension | `public/qlip-logo-white.png`; native `QlipLogo.imageset`; Share Extension `QlipLogo.imageset`; native `AppIcon.appiconset` | Asset hashes match; app and extension signed builds succeed |
| 2 | Domains → Bookmarks; articles, blogs, PDFs/e-books and individual social posts/videos → Reading | `_shared/canonical.ts`; persisted `kind_override`; `save-item`; MCP `save_link` | `npm run test:routing` covers homepage, article route, document and social cases |
| 3 | Social thumbnails on cards and detail views | social parsers write `thumbnail_url`; `LinkCard`, `ItemCard`, native `VaultCard` and both readers render it | TypeScript and signed Swift builds succeed |
| 4 | Swift shows the complete shared vault | `QlipStore.fetchAllItems()` pages `content_items` deterministically and loads folders, feeds, daily picks and API keys | Native build succeeds; authenticated app installed and launched on the physical iPhone |
| 5 | Web add classifies domains as Bookmarks | `AddLinkModal` sends `destination`; `api.items.save` calls `save-item`; automatic classification uses `inferItemKind` | Routing tests and live `save-item` v7 deployment |
| 6 | Minimum 1.5 second splash on web and Swift | web `StartupGate`; native splash gate plus `UILaunchScreen` | Both gates specify 1,500 ms; production builds succeed |
| 7 | Share Extension lets the user choose a destination | `ShareViewController` exposes Automatic, Bookmarks and Reading plus a category picker | Signed Share Extension build with shared app-group entitlement |
| 8 | Native categories appear and filter Bookmarks | native Library folder filter, card category actions and folder settings | Swift compile/build succeeds against the shared `folders` and `item_folders` schema |
| 9 | Native settings match the web controls and manage feeds | appearance, folders, feed add/sync/pause/delete, MCP key management and account controls in native Settings | Swift compile/build succeeds; authenticated database-backed views launch |
| 10 | Linkat behavior was checked before replacement | Linkat capture and app-group requirements informed `ShareInbox`, mobile origin and category behavior | Native README records the replacement architecture |
| 11 | Apify participates in the Swift capture flow safely | Swift saves to `save-item`; server worker dispatches social URLs to the Apify-backed reel/Facebook parsers | No Apify secret is shipped in the app; worker v19 is active |
| 12 | Mobile/manual domains stay Bookmarks; AI categorizes until the user changes category | capture-time `kind_override`; `assignment_source`; `assignBookmarkCategory` stops permanently on a user assignment | `npm run test:routing` and `npm run test:ai`; migrations 0016/0017; worker v19 |
| 13 | Vault Dashboard shows new feed processing in the existing AI Pipeline style | `App.tsx` AI Pipeline card combines processing captures with fresh feed intelligence | Web production build succeeds; production deployment is the remaining release gate |
| 14 | Priority Vault order is identical on web/mobile and stored in the database | `content_items.pin_position`; both clients read, write and reorder the same column | Migration 0017 applied; live database has ordered pinned rows; both builds succeed |
| 15 | Share Extension reliability recommendations are implemented | direct authenticated save, explicit destination/category/note, durable app-group inbox, deduplicated retries and background refresh | Signed app/extension entitlements match; physical-device launch succeeds |

## Release gates

Run before release:

```bash
npm run audit:ai:corpus
npm run test:routing
npm run test:ai
npm run build
xcodebuild -project ios/Qlip/Qlip.xcodeproj -scheme Qlip -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

The Supabase migrations and Edge Functions are already live. Publishing the
updated static web bundle is intentionally a separate, explicit production
action. After deployment, verify the AI Pipeline card, Priority Vault order and
domain-to-Bookmark capture against the production URL.
