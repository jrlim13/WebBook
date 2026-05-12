/* ============================================================
   storage.js — localStorage helpers for position + settings
   ============================================================ */

const PREFIX = "wb:";

function safeGet(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage may be disabled (e.g. private mode); fail silently */
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

export const DEFAULT_SETTINGS = {
  fontSize: 18,
  lineHeight: 1.6,
  paper: "cream",
};

export function loadSettings() {
  const raw = safeGet("settings");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  safeSet("settings", JSON.stringify(settings));
}

/**
 * Position is stored as the character offset within a chapter so that
 * repagination (different viewport / font size) can recover the place.
 */
export function loadPosition() {
  const raw = safeGet("position");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePosition(position) {
  safeSet("position", JSON.stringify(position));
}

export function loadBookmarks() {
  const raw = safeGet("bookmarks");
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks) {
  safeSet("bookmarks", JSON.stringify(bookmarks));
}

export function clearAll() {
  safeRemove("settings");
  safeRemove("position");
  safeRemove("bookmarks");
}
