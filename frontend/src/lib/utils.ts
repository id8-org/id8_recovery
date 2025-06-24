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

// Converts a string from camelCase to snake_case
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, letter => `_${letter.toLowerCase()}`);
}

// Converts a string from snake_case to camelCase
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Recursively converts all object keys from camelCase to snake_case
export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        camelToSnake(key),
        toSnakeCase(value)
      ])
    );
  }
  return obj;
}

// Recursively converts all object keys from snake_case to camelCase
export function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        snakeToCamel(key),
        toCamelCase(value)
      ])
    );
  }
  return obj;
}
