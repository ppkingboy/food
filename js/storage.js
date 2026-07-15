'use strict';

// Storage module - handles IndexedDB operations
const Storage = (() => {
  const DB_NAME = 'what-to-eat';
  const DB_VERSION = 2;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('foods')) {
          db.createObjectStore('foods', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          const hs = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          hs.createIndex('foodId', 'foodId', { unique: false });
          hs.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function bulkPut(storeName, items) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function remove(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFoods() {
    let foods = await getAll('foods');
    if (foods.length === 0) {
      // First run - seed from inline data
      foods = JSON.parse(JSON.stringify(FOODS_DATA));
      await bulkPut('foods', foods);
    }
    return foods;
  }

  async function getTags() {
    let tags = await getAll('tags');
    if (tags.length === 0) {
      tags = JSON.parse(JSON.stringify(TAGS_DATA));
      await bulkPut('tags', tags);
    }
    return tags;
  }

  async function saveFood(food) {
    await put('foods', food);
  }

  async function deleteFood(id) {
    await remove('foods', id);
  }

  async function addHistory(foodId, scene) {
    const entry = {
      foodId,
      scene: scene || '随便吃',
      timestamp: Date.now()
    };
    await put('history', entry);
  }

  async function getHistory(limit = 50) {
    const all = await getAll('history');
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all.slice(0, limit);
  }

  async function clearHistory() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('history', 'readwrite');
      tx.objectStore('history').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getPreferences() {
    const all = await getAll('preferences');
    const obj = {};
    all.forEach(p => { obj[p.key] = p.value; });
    return obj;
  }

  async function savePreference(key, value) {
    await put('preferences', { key, value });
  }

  async function savePreferences(prefs) {
    for (const [key, value] of Object.entries(prefs)) {
      await savePreference(key, value);
    }
  }

  async function exportData() {
    const foods = await getAll('foods');
    const history = await getAll('history');
    const preferences = await getPreferences();
    return JSON.stringify({ foods, history, preferences, exportedAt: new Date().toISOString() }, null, 2);
  }

  async function importData(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (data.foods) await bulkPut('foods', data.foods);
    if (data.history) await bulkPut('history', data.history);
    if (data.preferences) await savePreferences(data.preferences);
  }

  return {
    getFoods, getTags, saveFood, deleteFood,
    addHistory, getHistory, clearHistory,
    getPreferences, savePreference, savePreferences,
    exportData, importData
  };
})();
/**
 * @preserve
 * @license MIT
 */
