import { useDroppable } from '@dnd-kit/core';

export const Droppable = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return children({ setNodeRef, isOver });
};