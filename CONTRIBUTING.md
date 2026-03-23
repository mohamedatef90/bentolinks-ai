# Contributing to BentoLinks AI

Thank you for considering contributing to BentoLinks AI! 🎉

## 🚀 Quick Start for Contributors

### 1. Fork & Clone
```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/bentolinks-ai.git
cd bentolinks-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your API keys
# Minimum required: VITE_GEMINI_API_KEY
```

**Get Free API Keys:**
- **Gemini (Required):** https://aistudio.google.com/apikey
  - Free: 1,500 requests/day
- **Tavily (Optional):** https://tavily.com
  - Free: 1,000 credits/month
- **Supabase (Optional):** https://supabase.com
  - Free tier available

### 4. Run Development Server
```bash
npm run dev
# Open http://localhost:5173
```

### 5. Make Your Changes
```bash
# Create a feature branch
git checkout -b feature/amazing-feature

# Make changes, then commit
git add .
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/amazing-feature
```

### 6. Open a Pull Request
Go to the original repository and open a PR from your fork.

---

## 📋 Development Guidelines

### Commit Message Format
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(news): add vertical auto-scroll feed
fix(tooltip): correct positioning on mobile
docs(readme): update setup instructions
style(button): improve hover animation
```

---

## 🎨 Code Style

### TypeScript
- Use TypeScript for all new code
- Add type annotations for parameters and return types
- Use interfaces for component props

```typescript
// Good ✅
interface LinkCardProps {
  link: Link;
  onDelete: (id: string) => void;
}

const LinkCard: React.FC<LinkCardProps> = ({ link, onDelete }) => {
  // ...
};

// Bad ❌
const LinkCard = ({ link, onDelete }: any) => {
  // ...
};
```

### React Components
- Use functional components with hooks
- Extract logic into custom hooks when reusable
- Keep components small and focused

```typescript
// Good ✅
const useLinks = () => {
  const [links, setLinks] = useState<Link[]>([]);
  // ... hook logic
  return { links, addLink, deleteLink };
};

// Use in component
const App = () => {
  const { links, addLink } = useLinks();
  // ...
};
```

### CSS/Tailwind
- Use Tailwind utility classes
- Follow the design system (8px grid, consistent colors)
- Use CSS variables for theme colors

```tsx
// Good ✅
<div className="bg-[#151518] rounded-2xl p-6 hover:bg-[#1a1a1e] transition-colors">

// Bad ❌
<div style={{ backgroundColor: '#151518', borderRadius: '16px' }}>
```

---

## 🧪 Testing

### Before Submitting a PR:
1. ✅ Build succeeds: `npm run build`
2. ✅ No TypeScript errors: `npm run type-check` (if available)
3. ✅ Code is formatted: `npm run format` (if available)
4. ✅ Manually test your feature in the browser

---

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description** - What happened?
2. **Steps to Reproduce** - How can we reproduce it?
3. **Expected Behavior** - What should happen?
4. **Screenshots** - If applicable
5. **Environment** - Browser, OS, Node version

**Example:**
```
**Bug:** Link cards not displaying on mobile

**Steps:**
1. Open https://bentolinks-ai.vercel.app on iPhone
2. Add a new link
3. Card doesn't appear in list

**Expected:** Card should appear immediately

**Environment:** iOS 17, Safari 17, iPhone 14
```

---

## 💡 Feature Requests

When suggesting features:

1. **Problem** - What problem does this solve?
2. **Solution** - Your proposed solution
3. **Alternatives** - Other solutions you considered
4. **Examples** - Screenshots/mockups if possible

---

## 🔒 Security

If you find a security vulnerability, please **DO NOT** open a public issue.

Email: matefm20@gmail.com with details.

---

## 📖 Project Structure

```
bentolinks-ai/
├── components/          # React components
│   ├── LinkCard.tsx
│   ├── AddLinkModal.tsx
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useLinks.ts
│   ├── useAuth.ts
│   └── ...
├── services/           # API services
│   ├── geminiService.ts
│   ├── tavilyService.ts
│   └── supabase.ts
├── types/              # TypeScript types
├── constants/          # Constants & config
└── App.tsx            # Main app component
```

---

## 🎯 Areas to Contribute

### 🟢 Good First Issues
- Improve error messages
- Add loading states
- Fix UI bugs on mobile
- Update documentation
- Add keyboard shortcuts

### 🟡 Intermediate
- Add new themes
- Improve accessibility
- Add unit tests
- Performance optimizations
- New export formats

### 🔴 Advanced
- Implement browser extensions
- Add desktop app (Electron)
- Multi-user collaboration
- Advanced search with filters
- API rate limiting & caching

---

## 🙏 Thank You!

Every contribution counts! Whether it's:
- 🐛 Bug fixes
- ✨ New features
- 📖 Documentation
- 🎨 UI improvements
- 💡 Feature ideas

**You're awesome!** 🚀

---

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.
