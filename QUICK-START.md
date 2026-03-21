# 🚀 Quick Start: Advanced Interactions

**Implementation time:** 15 minutes  
**Difficulty:** Easy

---

## ✅ What's Already Done

All hooks and components are created. You just need to wire them up.

---

## 🔌 3-Step Integration

### Step 1: Import everything (2 min)

Add to top of `App.tsx`:

```typescript
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBulkSelect } from './hooks/useBulkSelect';
import { useContextMenu } from './hooks/useContextMenu';
import { BulkActionsBar } from './components/BulkActionsBar';
import { ContextMenu } from './components/ContextMenu';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel';
```

---

### Step 2: Add hooks to your component (3 min)

```typescript
function App() {
  const [links, setLinks] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Initialize hooks
  const drag = useDragAndDrop(links, setLinks);
  const select = useBulkSelect(links);
  const menu = useContextMenu();
  
  // ... rest of your code
}
```

---

### Step 3: Update your LinkCard (5 min)

Find where you render `<LinkCard />` and add new props:

```typescript
{links.map((link, index) => (
  <LinkCard
    key={link.id}
    link={link}
    // ... existing props ...
    
    // NEW: Drag & Drop
    index={index}
    isDraggable={!isSelectionMode}
    isDragging={drag.draggedIndex === index}
    onDragStart={drag.handleDragStart}
    onDragEnter={drag.handleDragEnter}
    onDragEnd={drag.handleDragEnd}
    
    // NEW: Selection
    isSelectionMode={isSelectionMode}
    isSelected={select.isSelected(link.id)}
    onToggleSelect={select.toggleSelect}
    
    // NEW: Context Menu
    onContextMenu={menu.handleContextMenu}
  />
))}
```

---

### Step 4: Add UI components (3 min)

At the end of your return statement (before closing `</div>`):

```typescript
return (
  <div>
    {/* Your existing UI */}
    
    {/* NEW: Floating components */}
    <BulkActionsBar
      selectedCount={select.selectedCount}
      onDelete={() => {
        select.selectedIds.forEach(id => deleteLink(id));
        select.clearSelection();
      }}
      onMove={() => {/* TODO: show category picker */}}
      onClearSelection={select.clearSelection}
    />
    
    {menu.contextMenu && (
      <ContextMenu
        x={menu.contextMenu.x}
        y={menu.contextMenu.y}
        options={[
          {
            label: 'Open',
            icon: 'fas fa-external-link-alt',
            onClick: () => window.open(/* link url */, '_blank'),
          },
          // Add more options...
        ]}
      />
    )}
    
    <KeyboardShortcutsPanel />
  </div>
);
```

---

### Step 5: Add keyboard shortcuts (2 min)

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Skip if typing in input
    if (e.target instanceof HTMLInputElement) return;
    
    // Cmd/Ctrl + A - Select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      select.selectAll();
      setIsSelectionMode(true);
    }
  };
  
  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## 🎯 That's It!

You now have:
- ✅ Drag & drop reordering
- ✅ Multi-select with bulk actions
- ✅ Right-click context menu
- ✅ Keyboard shortcuts

---

## 📖 Full Documentation

For complete examples and customization:
- **Feature details:** `ADVANCED-INTERACTIONS.md`
- **Full integration:** `INTEGRATION-EXAMPLE.tsx`
- **Summary:** `IMPLEMENTATION-SUMMARY.md`

---

## 🐛 Quick Fixes

**Drag not working?**
- Check `isDraggable={true}` is set
- Make sure not in selection mode

**Selection not working?**
- Set `isSelectionMode={true}`
- Check `onToggleSelect` is passed

**Context menu not appearing?**
- Verify `onContextMenu` prop
- Check if options array is not empty

---

**Questions?** Check the full docs or the integration example.

**Ready to ship!** 🚀
