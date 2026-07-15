'use strict';

// Main application module
const App = (() => {
  // State
  let foods = [];
  let tags = [];
  let preferences = {};
  let history = [];
  let currentFood = null;
  function getCurrentScene() {
    const active = document.querySelector('.scene-chip.active');
    return active ? active.dataset.scene : '随便吃';
  }
  let tips = null;
  let tipMode = 'gentle';

  // DOM refs
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ==================== Init ====================
  async function init() {
    loadTips();
    foods = await Storage.getFoods();
    tags = await Storage.getTags();
    preferences = await Storage.getPreferences();
    history = await Storage.getHistory(100);

    if (preferences.tipMode) tipMode = preferences.tipMode;

    // Check preferences setup
    const prefComplete = preferences.tastes && preferences.tastes.length > 0;
    if (!prefComplete) {
      showPage('onboarding');
      renderOnboarding();
    } else {
      showPage('home');
    }

    setupEventListeners();
    renderHomeStats();
  }

  function loadTips() {
    tips = TIPS_DATA;
  }

  function getRandomTip() {
    const arr = tips?.modes?.[tipMode] || tips?.modes?.gentle || ['想想今天吃什么...'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getResultTip() {
    const arr = tips?.resultTips?.[tipMode] || ['就它了！'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ==================== Page Routing ====================
  function showPage(name) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const page = $(`#page-${name}`);
    if (page) page.classList.add('active');
    // Update nav
    $$('.tab-item').forEach(t => t.classList.remove('active'));
    const tab = $(`.tab-item[data-page="${name}"]`);
    if (tab) tab.classList.add('active');
  }

  // ==================== Event Listeners ====================
  function setupEventListeners() {
    // Tab navigation
    $$('.tab-item').forEach(el => {
      el.addEventListener('click', () => {
        const page = el.dataset.page;
        if (page === 'home') showPage('home');
        else if (page === 'manage') { renderManage(); showPage('manage'); }
        else if (page === 'settings') { renderSettings(); showPage('settings'); }
        else if (page === 'history') { renderHistory(); showPage('history'); }
      });
    });

    // Decide button
    document.getElementById('btn-decide').addEventListener('click', handleDecide);

    // Accept / Retry
    document.getElementById('btn-accept').addEventListener('click', handleAccept);
    document.getElementById('btn-retry').addEventListener('click', handleRetry);

    // Scene selector
    document.getElementById('scene-selector').addEventListener('click', (e) => {
      const chip = e.target.closest('.scene-chip');
      if (!chip) return;
      document.querySelectorAll('.scene-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });

    // Onboarding
    document.getElementById('btn-onboarding-done').addEventListener('click', handleOnboardingDone);

    // Settings: save preferences
    document.getElementById('btn-save-prefs').addEventListener('click', handleSavePrefs);
    document.getElementById('btn-clear-history').addEventListener('click', handleClearHistory);
    document.getElementById('btn-export-data').addEventListener('click', handleExport);
    document.getElementById('btn-import-data').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', handleImport);
    document.getElementById('btn-reset-data').addEventListener('click', handleReset);

    // Tip mode selector
    $$('input[name="tipMode"]').forEach(el => {
      el.addEventListener('change', async (e) => {
        tipMode = e.target.value;
        await Storage.savePreference('tipMode', tipMode);
      });
    });

    // Manage page
    document.getElementById('btn-add-food').addEventListener('click', showAddFoodModal);
    document.getElementById('btn-batch-tags').addEventListener('click', showBatchTagModal);
    document.getElementById('manage-search').addEventListener('input', () => renderManageList());
    document.getElementById('manage-category-filter').addEventListener('change', () => renderManageList());

    // Modal close
    document.getElementById('modal-overlay').addEventListener('click', closeModal);
    document.getElementById('btn-modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-modal-save').addEventListener('click', handleModalSave);

    // Batch tag modal
    document.getElementById('btn-batch-cancel').addEventListener('click', closeBatchModal);
    document.getElementById('btn-batch-save').addEventListener('click', handleBatchSave);

    // Dark mode toggle
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (preferences.darkMode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      darkToggle.checked = true;
    }
    darkToggle.addEventListener('change', async (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      await Storage.savePreference('darkMode', theme);
    });

    // Manage: export / import single
    document.getElementById('btn-manage-export').addEventListener('click', handleManageExport);
  }

  // ==================== Home ====================
  function renderHomeStats() {
    const count = foods.length;
    const recentCount = history.filter(h => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return h.timestamp > d.getTime();
    }).length;
    document.getElementById('home-stats').textContent = `${count} 种餐品 · 本周已吃 ${recentCount} 次`;
  }

  // ==================== Recommendation ====================
  function handleDecide() {
    const btn = document.getElementById('btn-decide');
    btn.disabled = true;
    btn.textContent = '🤔 正在思考...';
    btn.classList.add('thinking');

    // Show recommendation view
    document.getElementById('home-content').style.display = 'none';
    document.getElementById('recommend-view').style.display = 'block';

    // Animate
    animateRecommend(() => {
      const result = Recommender.recommend(foods, preferences, getCurrentScene(), history);
      currentFood = result;
      showRecommendResult(result);
      btn.disabled = false;
      btn.textContent = '🎲 帮我决定';
      btn.classList.remove('thinking');
    });
  }

  function animateRecommend(callback) {
    const container = document.getElementById('recommend-animation');
    const resultArea = document.getElementById('recommend-result');
    resultArea.style.display = 'none';
    container.style.display = 'flex';
    container.innerHTML = '';

    // Slot machine animation
    let count = 0;
    const totalFrames = 20;
    const interval = setInterval(() => {
      const randomFood = foods[Math.floor(Math.random() * foods.length)];
      container.innerHTML = `
        <div class="slot-item">
          <span class="slot-emoji">${randomFood.emoji}</span>
          <span class="slot-name">${randomFood.name}</span>
        </div>
      `;
      count++;
      if (count >= totalFrames) {
        clearInterval(interval);
        container.style.display = 'none';
        resultArea.style.display = 'block';
        if (callback) callback();
      }
    }, 80);
  }

  function showRecommendResult(food) {
    const resultArea = document.getElementById('recommend-result');
    // Entrance animation
    resultArea.classList.remove('result-enter');
    void resultArea.offsetWidth;
    resultArea.classList.add('result-enter');

    document.getElementById('result-tip').textContent = getResultTip();
    document.getElementById('result-emoji').textContent = food.emoji;
    document.getElementById('result-name').textContent = food.name;
    document.getElementById('result-category').textContent = food.category;
    document.getElementById('result-taste').textContent = food.taste;

    // Tags
    const tagContainer = document.getElementById('result-tags');
    tagContainer.innerHTML = '';
    if (food.tags) {
      food.tags.slice(0, 4).forEach(tagId => {
        const tagObj = tags.find(t => t.id === tagId);
        if (tagObj) {
          const span = document.createElement('span');
          span.className = 'tag';
          span.textContent = tagObj.emoji + ' ' + tagObj.name;
          tagContainer.appendChild(span);
        }
      });
    }

    document.getElementById('result-scene').textContent = getCurrentScene();
  }

  function handleAccept() {
    if (currentFood) {
      Storage.addHistory(currentFood.id, getCurrentScene());
      history.push({ foodId: currentFood.id, scene: getCurrentScene(), timestamp: Date.now() });
    }
    // Back to home
    document.getElementById('home-content').style.display = 'block';
    document.getElementById('recommend-view').style.display = 'none';
    renderHomeStats();
  }

  function handleRetry() {
    if (!currentFood) return;
    const newResult = Recommender.recommendNext(foods, preferences, getCurrentScene(), history, currentFood.id);
    currentFood = newResult;
    showRecommendResult(newResult);
  }

  // ==================== Onboarding ====================
  function renderOnboarding() {
    const container = document.getElementById('onboarding-tastes');
    const tasteOptions = [
      { id: 'spicy', label: '🌶️ 辣', emoji: '🌶️' },
      { id: 'light', label: '🥬 清淡', emoji: '🥬' },
      { id: 'sweet', label: '🍯 甜', emoji: '🍯' },
      { id: 'salty', label: '🧂 咸', emoji: '🧂' },
      { id: 'sour', label: '🍋 酸', emoji: '🍋' },
      { id: 'numb', label: '🥴 麻', emoji: '🥴' },
      { id: 'heavy', label: '😈 重口', emoji: '😈' }
    ];

    container.innerHTML = '';
    tasteOptions.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'taste-btn';
      btn.dataset.tasteId = t.id;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
      });
      container.appendChild(btn);
    });
  }

  async function handleOnboardingDone() {
    const selected = document.querySelectorAll('#onboarding-tastes .taste-btn.selected');
    if (selected.length === 0) {
      showToast('至少选一个口味偏好哦～');
      return;
    }
    const tastes = Array.from(selected).map(el => el.dataset.tasteId);
    // Store scene preference
    const scene = document.getElementById('onboarding-scene').value;
    await Storage.savePreferences({
      tastes: tastes,
      defaultScene: scene,
      completed: true
    });
    preferences = await Storage.getPreferences();
    showPage('home');
  }

  // ==================== Manage ====================
  let manageSelectedFoods = new Set();

  function renderManage() {
    manageSelectedFoods = new Set();
    renderManageFilters();
    renderManageList();
  }

  function renderManageFilters() {
    const select = document.getElementById('manage-category-filter');
    const currentVal = select.value;
    const categories = [...new Set(foods.map(f => f.category))].sort();
    select.innerHTML = '<option value="all">全部分类</option>';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    select.value = currentVal;
  }

  function getFilteredFoods() {
    const query = document.getElementById('manage-search').value.toLowerCase();
    const cat = document.getElementById('manage-category-filter').value;
    return foods.filter(f => {
      if (cat !== 'all' && f.category !== cat) return false;
      if (query && !f.name.includes(query) && !f.tags?.some(t => t.includes(query))) return false;
      return true;
    });
  }

  function renderManageList() {
    const container = document.getElementById('manage-list');
    const filtered = getFilteredFoods();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">没有找到匹配的餐品</div>';
      return;
    }

    container.innerHTML = '';
    filtered.forEach(f => {
      const card = document.createElement('div');
      card.className = 'manage-card';
      if (manageSelectedFoods.has(f.id)) card.classList.add('selected');

      const tagSpans = (f.tags || []).slice(0, 3).map(t => {
        const tagObj = tags.find(tg => tg.id === t);
        return tagObj ? `<span class="mini-tag">${tagObj.emoji}</span>` : '';
      }).join('');

      card.innerHTML = `
        <div class="manage-card-left">
          <span class="manage-card-emoji">${f.emoji}</span>
          <div class="manage-card-info">
            <span class="manage-card-name">${f.name}</span>
            <span class="manage-card-meta">${f.category} · ${f.taste} · ¥${'💰'.repeat(f.priceLevel)}</span>
            <span class="manage-card-tags">${tagSpans}</span>
          </div>
        </div>
        <div class="manage-card-actions">
          <button class="btn-icon" data-edit="${f.id}" title="编辑">✏️</button>
          <button class="btn-icon" data-del="${f.id}" title="删除">🗑️</button>
        </div>
      `;

      // Multi-select
      card.addEventListener('click', (e) => {
        if (e.target.closest('.manage-card-actions')) return;
        card.classList.toggle('selected');
        if (manageSelectedFoods.has(f.id)) manageSelectedFoods.delete(f.id);
        else manageSelectedFoods.add(f.id);
        document.getElementById('manage-selected-count').textContent = manageSelectedFoods.size;
      });

      // Edit
      card.querySelector('[data-edit]').addEventListener('click', (e) => {
        e.stopPropagation();
        showEditFoodModal(f);
      });

      // Delete
      card.querySelector('[data-del]').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`确定删除「${f.name}」？`)) {
          await Storage.deleteFood(f.id);
          foods = foods.filter(x => x.id !== f.id);
          renderManageList();
        }
      });

      container.appendChild(card);
    });

    document.getElementById('manage-selected-count').textContent = manageSelectedFoods.size;
  }

  // ==================== Food Modal ====================
  let editingFood = null;

  function showAddFoodModal() {
    editingFood = null;
    document.getElementById('modal-title').textContent = '新增餐品';
    document.getElementById('food-name').value = '';
    document.getElementById('food-emoji').value = '';
    document.getElementById('food-category').value = '中餐';
    document.getElementById('food-taste').value = '清淡';
    document.getElementById('food-scene').value = '随便吃';
    document.getElementById('food-mealtime').value = '午餐';
    document.getElementById('food-price').value = '1';
    document.getElementById('food-weight').value = '8';
    renderTagSelections();
    openModal();
  }

  function showEditFoodModal(food) {
    editingFood = food;
    document.getElementById('modal-title').textContent = '编辑餐品';
    document.getElementById('food-name').value = food.name;
    document.getElementById('food-emoji').value = food.emoji || '';
    document.getElementById('food-category').value = food.category;
    document.getElementById('food-taste').value = food.taste;
    document.getElementById('food-scene').value = food.scene;
    document.getElementById('food-mealtime').value = food.mealTime;
    document.getElementById('food-price').value = food.priceLevel;
    document.getElementById('food-weight').value = food.weight;
    renderTagSelections(food.tags || []);
    openModal();
  }

  function renderTagSelections(selectedTags = []) {
    const container = document.getElementById('food-tags');
    container.innerHTML = '';
    tags.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'taste-btn small';
      if (selectedTags.includes(t.id)) btn.classList.add('selected');
      btn.dataset.tagId = t.id;
      btn.textContent = t.emoji + ' ' + t.name;
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
      container.appendChild(btn);
    });
  }

  function openModal() {
    document.getElementById('modal-overlay').classList.add('active');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  }

  async function handleModalSave() {
    const name = document.getElementById('food-name').value.trim();
    if (!name) { showToast('请输入餐品名称'); return; }

    const selectedTags = Array.from(document.querySelectorAll('#food-tags .taste-btn.selected')).map(el => el.dataset.tagId);
    const foodData = {
      name: name,
      emoji: document.getElementById('food-emoji').value || '🍽️',
      category: document.getElementById('food-category').value,
      taste: document.getElementById('food-taste').value,
      scene: document.getElementById('food-scene').value,
      mealTime: document.getElementById('food-mealtime').value,
      priceLevel: parseInt(document.getElementById('food-price').value),
      weight: parseInt(document.getElementById('food-weight').value),
      tags: selectedTags
    };

    if (editingFood) {
      foodData.id = editingFood.id;
      Object.assign(editingFood, foodData);
      await Storage.saveFood(editingFood);
      // Update in-memory array
      const idx = foods.findIndex(f => f.id === editingFood.id);
      if (idx >= 0) foods[idx] = editingFood;
      showToast('已更新');
    } else {
      foodData.id = 'f' + Date.now().toString(36);
      await Storage.saveFood(foodData);
      foods.push(foodData);
      showToast('已添加');
    }

    closeModal();
    renderManageList();
    renderHomeStats();
  }

  // ==================== Batch Tag ====================
  function showBatchTagModal() {
    if (manageSelectedFoods.size === 0) {
      showToast('请先选择要修改的餐品');
      return;
    }
    document.getElementById('batch-modal-overlay').classList.add('active');
    renderBatchTagOptions();
  }

  function closeBatchModal() {
    document.getElementById('batch-modal-overlay').classList.remove('active');
  }

  function renderBatchTagOptions() {
    const container = document.getElementById('batch-tag-list');
    container.innerHTML = '';
    tags.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'taste-btn small';
      btn.dataset.tagId = t.id;
      btn.textContent = t.emoji + ' ' + t.name;
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
      container.appendChild(btn);
    });
  }

  async function handleBatchSave() {
    const addTags = Array.from(document.querySelectorAll('#batch-tag-list .taste-btn.selected')).map(el => el.dataset.tagId);
    const action = document.getElementById('batch-action').value;

    for (const foodId of manageSelectedFoods) {
      const food = foods.find(f => f.id === foodId);
      if (!food) continue;
      if (!food.tags) food.tags = [];

      if (action === 'add') {
        addTags.forEach(t => { if (!food.tags.includes(t)) food.tags.push(t); });
      } else if (action === 'remove') {
        food.tags = food.tags.filter(t => !addTags.includes(t));
      } else if (action === 'replace') {
        food.tags = [...addTags];
      }

      await Storage.saveFood(food);
    }

    closeBatchModal();
    renderManageList();
    manageSelectedFoods = new Set();
    document.getElementById('manage-selected-count').textContent = '0';
    showToast(`已批量修改 ${manageSelectedFoods.size} 个餐品`);
  }

  // ==================== History ====================
  async function renderHistory() {
    history = await Storage.getHistory(200);
    const container = document.getElementById('history-list');

    if (history.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有饮食记录，快去吃点东西吧！</div>';
      return;
    }

    // Group by date
    const groups = {};
    history.forEach(h => {
      const date = new Date(h.timestamp);
      const key = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    });

    container.innerHTML = '';
    Object.entries(groups).forEach(([date, items]) => {
      const section = document.createElement('div');
      section.className = 'history-section';

      let itemsHtml = '';
      items.forEach(h => {
        const food = foods.find(f => f.id === h.foodId);
        const time = new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        itemsHtml += `
          <div class="history-item">
            <span class="history-emoji">${food?.emoji || '🍽️'}</span>
            <div class="history-info">
              <span class="history-name">${food?.name || '未知餐品'}</span>
              <span class="history-meta">${h.scene || '随便吃'} · ${time}</span>
            </div>
          </div>
        `;
      });

      section.innerHTML = `
        <div class="history-date">${date}</div>
        ${itemsHtml}
      `;
      container.appendChild(section);
    });
  }

  // ==================== Settings ====================
  function renderSettings() {
    document.getElementById('settings-scene').value = preferences.defaultScene || '随便吃';

    // Show current taste prefs
    const tastes = preferences.tastes || [];
    const container = document.getElementById('settings-tastes');
    container.innerHTML = '';
    const tasteOptions = [
      { id: 'spicy', label: '🌶️ 辣' },
      { id: 'light', label: '🥬 清淡' },
      { id: 'sweet', label: '🍯 甜' },
      { id: 'salty', label: '🧂 咸' },
      { id: 'sour', label: '🍋 酸' },
      { id: 'numb', label: '🥴 麻' },
      { id: 'heavy', label: '😈 重口' }
    ];
    tasteOptions.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'taste-btn';
      if (tastes.includes(t.id)) btn.classList.add('selected');
      btn.dataset.tasteId = t.id;
      btn.textContent = t.label;
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
      container.appendChild(btn);
    });

    // Tip mode
    if (preferences.tipMode) {
      const radio = document.querySelector(`input[name="tipMode"][value="${preferences.tipMode}"]`);
      if (radio) radio.checked = true;
    }
  }

  async function handleSavePrefs() {
    const tastes = Array.from(document.querySelectorAll('#settings-tastes .taste-btn.selected')).map(el => el.dataset.tasteId);
    if (tastes.length === 0) { showToast('至少选一个口味'); return; }
    const scene = document.getElementById('settings-scene').value;
    await Storage.savePreferences({ tastes, defaultScene: scene });
    preferences = await Storage.getPreferences();
    showToast('偏好已保存');
  }

  async function handleClearHistory() {
    if (confirm('确定清空所有历史记录？')) {
      await Storage.clearHistory();
      history = [];
      showToast('历史已清空');
      renderHistory();
    }
  }

  async function handleExport() {
    const data = await Storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `food-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('导入将合并数据，确定继续？')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await Storage.importData(ev.target.result);
        foods = await Storage.getFoods();
        history = await Storage.getHistory(100);
        showToast('导入成功');
        renderManageList();
        renderHomeStats();
      } catch (err) {
        showToast('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleManageExport() {
    const filtered = getFilteredFoods();
    const data = JSON.stringify(filtered, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manage-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReset() {
    if (!confirm('确定重置所有数据？此操作不可撤销！')) return;
    if (!confirm('再次确认：所有餐品、历史、偏好将被清除！')) return;

    // Delete all IndexedDB stores
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('what-to-eat', 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const stores = ['foods', 'history', 'preferences', 'tags'];
    for (const store of stores) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
    // Reload page
    window.location.reload();
  }

  // ==================== Toast ====================
  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // ==================== Start ====================
  document.addEventListener('DOMContentLoaded', init);

  return {};
})();
/**
 * @preserve
 * @license MIT
 */
