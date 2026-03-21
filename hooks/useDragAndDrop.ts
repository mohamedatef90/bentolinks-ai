import { useState, useRef } from 'react';

export const useDragAndDrop = <T extends { id: string }>(
  items: T[],
  onReorder: (newItems: T[]) => void
) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const newItems = [...items];
      const draggedItem = newItems[dragItem.current];
      newItems.splice(dragItem.current, 1);
      newItems.splice(dragOverItem.current, 0, draggedItem);
      onReorder(newItems);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggedIndex(null);
  };

  return {
    draggedIndex,
    handleDragStart,
    handleDragEnter,
    handleDragEnd,
  };
};
