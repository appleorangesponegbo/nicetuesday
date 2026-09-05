const FAVORITES_KEY = "tcl-gameFavorites";
const STATS_KEY = "tcl-gameStats";

export function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || {};
  } catch {
    return {};
  }
}

export function isFavorite(id) {
  return !!loadFavorites()[id];
}

export function toggleFavorite(id) {
  const favs = loadFavorites();
  if (favs[id]) {
    delete favs[id];
  } else {
    favs[id] = true;
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return !!favs[id];
}

export function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || {};
  } catch {
    return {};
  }
}

export function getStats(id) {
  const stats = loadStats();
  return stats[id] || { lastPlayed: null, playCount: 0, totalPlayTime: 0 };
}

export function recordPlay(id) {
  const stats = loadStats();
  const entry = stats[id] || { lastPlayed: null, playCount: 0, totalPlayTime: 0 };
  const prevLastPlayed = entry.lastPlayed;
  entry.playCount = (entry.playCount || 0) + 1;
  entry.lastPlayed = Date.now();
  entry.totalPlayTime = entry.totalPlayTime || 0;
  stats[id] = entry;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return { playCount: entry.playCount, prevLastPlayed };
}

export function addPlayTime(id, ms) {
  if (!ms || ms <= 0) return getStats(id).totalPlayTime || 0;
  const stats = loadStats();
  const entry = stats[id] || { lastPlayed: null, playCount: 0, totalPlayTime: 0 };
  entry.totalPlayTime = (entry.totalPlayTime || 0) + ms;
  stats[id] = entry;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return entry.totalPlayTime;
}
