import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a stoplight color class for effort values.
 * Green: effort <= 3
 * Yellow: 4 <= effort <= 6
 * Red: effort >= 7
 */
export function getEffortColor(effort: number): string {
  if (effort <= 3) return 'bg-green-500 text-white';
  if (effort <= 6) return 'bg-yellow-500 text-white';
  return 'bg-red-500 text-white';
}
