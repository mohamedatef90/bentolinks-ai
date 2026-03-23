# 🔖 BentoLinks AI

> AI-powered link manager with intelligent categorization, cloud sync, and beautiful dark UI

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://bentolinks-ai.vercel.app)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mohamedatef90/bentolinks-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<div align="center">
<img width="1200" height="475" alt="BentoLinks AI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

---

## ✨ Features

### 🤖 **AI-Powered**
- **Smart Analysis** - Automatically extracts title, description, and category using Google Gemini 2.5 Flash
- **Intelligent Categorization** - AI suggests relevant categories and icons
- **Real-Time News Feed** - Auto-scrolling tech news via Tavily API (TechCrunch, The Verge, Ars Technica, etc.)
- **Hover Tooltips** - Smart preview cards on link hover with full details

### ☁️ **Hybrid Storage**
- **Cloud Sync** - Supabase integration for cross-device access
- **Offline-First** - LocalStorage fallback when offline
- **Optimistic Updates** - Instant UI feedback

### 🎨 **Beautiful UI**
- **Modern Design** - Dark theme with neon accents (#c1ff00)
- **Smooth Animations** - 300ms transitions, gradient borders, glow effects
- **Responsive** - Mobile, tablet, and desktop optimized
- **Empty States** - Engaging illustrations and helpful CTAs
- **Custom Favicons** - Professional neon bookmark design (SVG + PNG + PWA manifest)
- **Vertical News Feed** - Auto-scrolling news with hover-to-pause

### ♿ **Accessible**
- **WCAG 2.1 AA/AAA** compliant
- **Keyboard Navigation** - Full keyboard shortcuts (Cmd+K, Cmd+I, ESC)
- **Screen Reader** support with ARIA labels
- **Touch Targets** - 44x44px minimum (WCAG AAA)

### ⚡ **Performance**
- **Virtual Scrolling** - Handle 1000+ links smoothly
- **Debounced Search** - 90% fewer re-renders
- **Code Splitting** - Optimized bundles (vendor, supabase, ai)
- **Lazy Loading** - Images load on-demand

### 🚀 **Advanced Features**
- **Drag & Drop** - Reorder links visually
- **Bulk Actions** - Multi-select for batch operations
- **Context Menu** - Right-click quick actions
- **Import/Export** - Import Chrome/Firefox bookmarks (HTML)
- **Themes** - Default (dark), Professional (light), Funny

---

## 🆕 Latest Updates (March 2026)

### **v1.3.0 - Major Enhancements**

#### 🎉 **New Features**
- ✅ **Vertical Auto-scroll News Feed** - Replaced carousel with smooth auto-scrolling feed
  - Auto-scroll with hover-to-pause
  - Purple-themed scrollbar
  - Infinite loop animation
  - Pause/Play button
  
- ✅ **Hover Tooltips** - Smart preview cards on link hover
  - 400px wide detail cards
  - Full untruncated title & description
  - Smart positioning (avoids screen edges)
  - 300ms delay to prevent accidental triggers
  
- ✅ **Professional Favicons** - Complete favicon suite
  - Custom SVG bookmark design (neon theme)
  - PNG fallbacks (32x32, 192x192)
  - PWA manifest with standalone mode
  - Apple touch icon for iOS

#### 🔧 **Technical Improvements**
- ✅ **Tavily News Integration** - Switched from Gemini to Tavily API
  - Saves 1,500 Gemini tokens/day
  - Real-time news from TechCrunch, The Verge, Ars Technica, Wired, etc.
  - 1-hour caching
  - 1,000 credits/month (plenty of headroom)
  
- ✅ **Gemini API Fixes** - Updated to latest stable model
  - Model: `gemini-2.5-flash` (June 2025 release)
  - Fixed API key variable: `import.meta.env.VITE_GEMINI_API_KEY`
  - Better retry logic: exponential backoff (5s, 10s, 20s)
  - Verified via Google API models endpoint

#### 📊 **Performance**
- Bundle size: 261.55 KB (gzip: 77.98 KB)
- +0.8 KB total for all new features (minimal impact!)
- Optimized code splitting maintained

---

## 🎯 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- (Optional) Gemini API key for AI features
- (Optional) Supabase account for cloud sync

### Installation

```bash
# Clone the repository
git clone https://github.com/mohamedatef90/bentolinks-ai.git
cd bentolinks-ai

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Open .env.local and add your API keys
# Required: VITE_GEMINI_API_KEY (get from https://aistudio.google.com/apikey)
# Optional: VITE_TAVILY_API_KEY (get from https://tavily.com)
# Optional: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (get from https://supabase.com)

# Run development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

### Get Free API Keys

| Service | Purpose | Free Tier | Get Key |
|---------|---------|-----------|---------|
| **Google Gemini** | AI link analysis (Required) | 1,500 requests/day | [Get Key](https://aistudio.google.com/apikey) |
| **Tavily** | Real-time news (Optional) | 1,000 credits/month | [Get Key](https://tavily.com) |
| **Supabase** | Cloud sync (Optional) | Free tier available | [Get Key](https://supabase.com) |

**Notes:**
- ✅ Works offline without Supabase (uses LocalStorage)
- ✅ News disabled gracefully without Tavily
- ⚠️ Gemini API key is required for AI features

---

## 📦 Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript 5.7, Vite 6 |
| **Styling** | Tailwind CSS v4, Custom Design System |
| **Database** | Supabase (PostgreSQL), LocalStorage |
| **AI** | Google Gemini 2.5 Flash (link analysis) |
| **News** | Tavily Search API (real-time tech news) |
| **Deployment** | Vercel |
| **Icons** | Font Awesome |

---

## 🏗️ Architecture

### **Design System**
- **8px Grid** - Consistent spacing throughout
- **Design Tokens** - Colors, typography, shadows, transitions
- **Component Library** - 20+ reusable components
- **Custom Hooks** - 14 specialized React hooks

### **Key Components**
```
components/
├── Button.tsx           # 4 variants, 3 sizes, loading states
├── Toast.tsx            # Notification system (4 types)
├── EmptyState.tsx       # Empty state with illustrations
├── ErrorBoundary.tsx    # Global error handling
├── LoadingSkeleton.tsx  # Loading placeholders
├── LinkCard.tsx         # Main link card with gradient borders
├── AddLinkModal.tsx     # Add/edit link modal
└── ... (13 more)
```

### **Custom Hooks**
```
hooks/
├── useAuth.ts           # Authentication state
├── useLinks.ts          # Links CRUD operations
├── useDebounce.ts       # Debounced values
├── useDragAndDrop.ts    # Drag & drop logic
├── useBulkSelect.ts     # Multi-select state
└── ... (9 more)
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Add new link |
| `Cmd/Ctrl + I` | Import bookmarks |
| `Cmd/Ctrl + /` | Show keyboard shortcuts |
| `ESC` | Close modal/panel |
| `Cmd/Ctrl + A` | Select all (bulk mode) |

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mohamedatef90/bentolinks-ai)

Or manually:

```bash
# Build for production
npm run build

# Deploy
vercel deploy --prod
```

### Environment Variables

Add these in your Vercel dashboard (Settings → Environment Variables):

```env
# Required
VITE_GEMINI_API_KEY=your_gemini_api_key

# Optional
VITE_TAVILY_API_KEY=your_tavily_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

See `.env.example` for detailed documentation.

---

## 📖 Documentation

Comprehensive guides available in the repository:

| Document | Description |
|----------|-------------|
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | Design tokens, colors, typography (11 KB) |
| [COMPONENT-POLISH.md](COMPONENT-POLISH.md) | Component styling patterns (8 KB) |
| [EMPTY-STATES.md](EMPTY-STATES.md) | Empty state patterns (7 KB) |
| [ADVANCED-INTERACTIONS.md](ADVANCED-INTERACTIONS.md) | Drag & drop, bulk actions (10 KB) |
| [PERFORMANCE-OPTIMIZATIONS.md](PERFORMANCE-OPTIMIZATIONS.md) | Performance techniques (10 KB) |
| [UX_ACCESSIBILITY_FIXES.md](UX_ACCESSIBILITY_FIXES.md) | Accessibility compliance (9 KB) |
| [UI-DESIGN-AUDIT-REPORT.md](UI-DESIGN-AUDIT-REPORT.md) | Full UI audit (54 KB) |

**Total Documentation:** ~100 KB

---

## 🎨 UI/UX Highlights

### **Score: 9.2/10** 🎉

| Area | Score | Status |
|------|-------|--------|
| Visual Design | 9/10 | ⭐⭐⭐⭐⭐ |
| Accessibility | 9/10 | ♿ WCAG AA/AAA |
| Performance | 9/10 | ⚡ Optimized |
| User Experience | 9/10 | ✨ Polished |

### **Visual Features**
- ✅ Gradient borders with neon glow on hover
- ✅ Smooth 300ms transitions throughout
- ✅ Custom SVG illustrations for empty states
- ✅ Blurred modal backdrops
- ✅ Loading skeletons with pulse animation
- ✅ Consistent neon accent (#c1ff00) for primary actions

---

## 🛡️ Security

- ✅ Environment variables for sensitive keys
- ✅ Input validation utilities
- ✅ XSS prevention (sanitizeHtml)
- ✅ URL validation before processing
- ✅ No hardcoded credentials in code

---

## 🤝 Contributing

We welcome contributions from everyone! Whether you're fixing bugs, adding features, or improving documentation.

### Quick Start
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/bentolinks-ai.git`
3. Create a branch: `git checkout -b feature/amazing-feature`
4. Make your changes
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Guidelines
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Write TypeScript (not JavaScript)
- Use Tailwind CSS for styling
- Test your changes locally (`npm run build`)
- Update documentation if needed

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Good First Issues
- 🐛 Fix UI bugs
- 📖 Improve documentation
- ♿ Enhance accessibility
- 🎨 Add new themes
- ⌨️ Add keyboard shortcuts

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini 2.5 Flash** - AI-powered link analysis
- **Tavily Search API** - Real-time tech news aggregation
- **Supabase** - Backend & authentication
- **Vercel** - Hosting & deployment
- **Tailwind CSS v4** - Styling framework
- **React 19** - UI library

---

## 📧 Contact

**Mohamed Atef**  
- GitHub: [@mohamedatef90](https://github.com/mohamedatef90)
- Email: matefm20@gmail.com

---

## 🔗 Links

- **Live Demo:** https://bentolinks-ai.vercel.app
- **AI Studio:** https://ai.studio/apps/drive/1s3tfiLjQRZ_BZP1soqa_OPYnCFyUj9x8
- **Repository:** https://github.com/mohamedatef90/bentolinks-ai

---

<div align="center">

**Made with ❤️ and ☕ by Mohamed Atef**

⭐ Star this repo if you find it useful!

</div>
