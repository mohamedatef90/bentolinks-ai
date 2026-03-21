# Advanced Interactions & Features

This document explains the advanced interaction features implemented in BentoLinks AI.

## 🎯 Features Overview

### 1. Drag & Drop Reordering
Users can reorder links by dragging and dropping them into their desired positions.

### 2. Bulk Actions (Multi-Select)
Select multiple links to perform batch operations like moving or deleting.

### 3. Context Menu (Right-Click)
Right-click on any link to access quick actions.

### 4. Keyboard Shortcuts
Power users can navigate the app using keyboard shortcuts.

---

## 📚 Implementation Details

### 1. Drag & Drop Reordering

**Hook:** `hooks/useDragAndDrop.ts`

**Usage:**
```typescript
import { useDragAndDrop } from '../hooks/useDragAndDrop';

const { draggedIndex, handleDragStart, handleDragEnter, handleDragEnd } = useDragAndDrop(
  links,
  (newLinks) => setLinks(newLinks)
);
```

**Features:**
- Generic type support: works with any array of items with `id` property
- Visual feedback: dragged items get opacity and scale effects
- Smooth transitions during drag operations
- Callback-based reordering for state management

**LinkCard Integration:**
```typescript
<LinkCard
  link={link}
  index={index}
  isDraggable={true}
  isDragging={draggedIndex === index}
  onDragStart={handleDragStart}
  onDragEnter={handleDragEnter}
  onDragEnd={handleDragEnd}
/>
```

---

### 2. Bulk Actions (Multi-Select)

**Hook:** `hooks/useBulkSelect.ts`

**Component:** `components/BulkActionsBar.tsx`

**Usage:**
```typescript
import { useBulkSelect } from '../hooks/useBulkSelect';
import { BulkActionsBar } from '../components/BulkActionsBar';

const {
  selectedIds,
  toggleSelect,
  selectAll,
  clearSelection,
  isSelected,
  selectedCount,
} = useBulkSelect(links);

// Enable selection mode
const [isSelectionMode, setIsSelectionMode] = useState(false);

// Render bulk actions bar
<BulkActionsBar
  selectedCount={selectedCount}
  onDelete={() => {
    // Delete selected links
    selectedIds.forEach(id => deleteLink(id));
    clearSelection();
  }}
  onMove={() => {
    // Show category picker modal
    // Move all selected links to chosen category
  }}
  onClearSelection={clearSelection}
/>
```

**LinkCard Integration:**
```typescript
<LinkCard
  link={link}
  isSelectionMode={isSelectionMode}
  isSelected={isSelected(link.id)}
  onToggleSelect={toggleSelect}
/>
```

**Features:**
- Multiple selection with checkboxes
- Select/deselect individual items
- Select all functionality
- Clear selection
- Floating action bar appears when items are selected
- Batch delete operation
- Batch move operation (to different category)

**Accessibility:**
- Minimum touch target size (44x44px)
- Proper ARIA labels
- Keyboard accessible

---

### 3. Context Menu (Right-Click)

**Hook:** `hooks/useContextMenu.ts`

**Component:** `components/ContextMenu.tsx`

**Usage:**
```typescript
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenu } from '../components/ContextMenu';

const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

// On link card
<LinkCard
  link={link}
  onContextMenu={handleContextMenu}
/>

// Render context menu
{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    options={[
      {
        label: 'Open',
        icon: 'fas fa-external-link-alt',
        onClick: () => window.open(getLink(contextMenu.itemId).url, '_blank'),
      },
      {
        label: 'Edit',
        icon: 'fas fa-edit',
        onClick: () => openEditModal(contextMenu.itemId),
      },
      {
        label: 'Copy URL',
        icon: 'fas fa-copy',
        onClick: () => copyToClipboard(getLink(contextMenu.itemId).url),
      },
      {
        label: 'Delete',
        icon: 'fas fa-trash',
        onClick: () => deleteLink(contextMenu.itemId),
        danger: true,
      },
    ]}
  />
)}
```

**Features:**
- Right-click to open context menu
- Position-aware (appears at cursor position)
- Auto-close on outside click
- Customizable menu options
- Visual distinction for dangerous actions (red color)
- Icons for each action

---

### 4. Keyboard Shortcuts

**Component:** `components/KeyboardShortcutsPanel.tsx`

**Usage:**
```typescript
import { KeyboardShortcutsPanel } from '../components/KeyboardShortcutsPanel';

// Add to main app component
<KeyboardShortcutsPanel />
```

**Default Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Add new link |
| `Cmd/Ctrl + I` | Import bookmarks |
| `Cmd/Ctrl + /` | Show/hide shortcuts panel |
| `Cmd/Ctrl + A` | Select all links |
| `ESC` | Close modal/panel |

**Features:**
- Toggle shortcuts panel with `Cmd/Ctrl + /`
- Close with `ESC` key
- Visual keyboard key indicators
- Cross-platform support (Cmd on Mac, Ctrl on Windows/Linux)
- Auto-detection of modifier keys

**Customization:**
Edit the `shortcuts` array in `KeyboardShortcutsPanel.tsx`:
```typescript
const shortcuts = [
  { keys: ['Cmd/Ctrl', 'K'], action: 'Add new link' },
  { keys: ['Cmd/Ctrl', 'N'], action: 'New category' },
  // Add more shortcuts
];
```

**Implementation in App:**
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Cmd/Ctrl + K - Add link
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowAddLinkModal(true);
    }
    
    // Cmd/Ctrl + A - Select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isInputFocused(e)) {
      e.preventDefault();
      selectAll();
      setIsSelectionMode(true);
    }
  };

  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## 🎨 Design Considerations

### Visual Feedback
- **Drag**: Opacity 50%, scale 95% on dragged item
- **Selection**: Neon ring (`ring-[#c1ff00]`) + background tint
- **Hover**: Elevated shadow + color transitions
- **Context Menu**: Dark theme, smooth animations

### Accessibility
- All interactive elements have minimum 44x44px touch targets
- Proper ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader friendly

### Performance
- Hooks use `useRef` for drag operations (no re-renders)
- Context menu uses event delegation
- Keyboard listeners properly cleaned up
- Minimal re-renders with Set-based selection

---

## 🚀 Integration Guide

### Step 1: Add to App.tsx
```typescript
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBulkSelect } from './hooks/useBulkSelect';
import { useContextMenu } from './hooks/useContextMenu';
import { BulkActionsBar } from './components/BulkActionsBar';
import { ContextMenu } from './components/ContextMenu';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel';
```

### Step 2: Initialize hooks
```typescript
const [isSelectionMode, setIsSelectionMode] = useState(false);

const { draggedIndex, handleDragStart, handleDragEnter, handleDragEnd } = 
  useDragAndDrop(links, setLinks);

const { selectedIds, toggleSelect, selectAll, clearSelection, isSelected, selectedCount } = 
  useBulkSelect(links);

const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();
```

### Step 3: Update LinkCard props
```typescript
<LinkCard
  link={link}
  index={index}
  isDraggable={!isSelectionMode}
  isDragging={draggedIndex === index}
  onDragStart={handleDragStart}
  onDragEnter={handleDragEnter}
  onDragEnd={handleDragEnd}
  isSelectionMode={isSelectionMode}
  isSelected={isSelected(link.id)}
  onToggleSelect={toggleSelect}
  onContextMenu={handleContextMenu}
/>
```

### Step 4: Add UI components
```typescript
{/* Bulk actions bar */}
<BulkActionsBar
  selectedCount={selectedCount}
  onDelete={handleBulkDelete}
  onMove={handleBulkMove}
  onClearSelection={clearSelection}
/>

{/* Context menu */}
{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    options={contextMenuOptions}
  />
)}

{/* Keyboard shortcuts */}
<KeyboardShortcutsPanel />
```

---

## 🔧 Customization

### Custom Drag Behavior
Modify `useDragAndDrop.ts` to add:
- Drag preview
- Drop zones
- Restricted drag areas
- Animations

### Custom Context Menu Options
Pass different options array to `ContextMenu`:
```typescript
const options = [
  { label: 'Share', icon: 'fas fa-share', onClick: handleShare },
  { label: 'Export', icon: 'fas fa-download', onClick: handleExport },
  // ... custom options
];
```

### Additional Keyboard Shortcuts
Add to `KeyboardShortcutsPanel.tsx` and implement handlers in App.tsx.

---

## 📦 Files Created

1. **Hooks:**
   - `hooks/useDragAndDrop.ts`
   - `hooks/useBulkSelect.ts`
   - `hooks/useContextMenu.ts`

2. **Components:**
   - `components/BulkActionsBar.tsx`
   - `components/ContextMenu.tsx`
   - `components/KeyboardShortcutsPanel.tsx`

3. **Updated:**
   - `components/LinkCard.tsx` (added drag & select support)

4. **Documentation:**
   - `ADVANCED-INTERACTIONS.md` (this file)

---

## 🎯 Next Steps

1. **Implement in App.tsx**: Integrate all hooks and components
2. **Add keyboard shortcuts**: Implement global keyboard handlers
3. **Test interactions**: Verify drag, select, context menu work correctly
4. **Add move modal**: Create category picker for bulk move operation
5. **Persist order**: Save reordered links to backend/storage
6. **Add undo/redo**: Implement action history for bulk operations

---

## 🐛 Known Limitations

- Drag & drop works best on desktop (touch support needs enhancement)
- Context menu position may need adjustment near viewport edges
- Multiple selection doesn't work with drag (disabled when selection mode is active)
- Keyboard shortcuts may conflict with browser defaults (document before release)

---

**Built with:**
- React 18
- TypeScript
- TailwindCSS
- Font Awesome icons

**Estimated implementation time:** 7 minutes ✅
