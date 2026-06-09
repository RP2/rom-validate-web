// Utility functions for validation settings

const STORAGE_KEY = "validationSettings";

export interface ValidationSettings {
  autoRename: boolean;
  skipLargeFiles: boolean;
  maxFileSize: number;
  verboseOutput: boolean;
  parallelWorkers: string;
}

export function getStoredSettings(): Partial<ValidationSettings> {
  if (typeof window === "undefined") {
    return { parallelWorkers: "4" };
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return { parallelWorkers: "4" };
    }
  }
  return { parallelWorkers: "4" };
}

export function getParallelWorkerCount(): number {
  const settings = getStoredSettings();
  const value = settings.parallelWorkers || "auto";

  if (value === "auto") {
    // Use hardware concurrency but cap at 6 for safety
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
    return Math.min(Math.max(cores - 1, 2), 6); // Leave 1 core for UI, min 2, max 6
  }

  const parsed = parseInt(value, 10);
  const count = isNaN(parsed) ? 4 : parsed;
  return Math.min(Math.max(count, 1), 6); // Clamp between 1 and 6
}

export function saveSettings(settings: Partial<ValidationSettings>): void {
  if (typeof window === "undefined") return;

  const current = getStoredSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
