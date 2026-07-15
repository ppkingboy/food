'use strict';

// Recommendation engine
const Recommender = (() => {
  const RECENT_PENALTY_DAYS = 3;
  const RECENT_PENALTY_POINTS = 30;
  const SCENE_SCORE = 20;
  const TASTE_SCORE = 15;
  const MEAL_TIME_SCORE = 10;
  const PRICE_SCORE = 5;

  function getCurrentMealTime() {
    const h = new Date().getHours();
    if (h < 10) return '早餐';
    if (h < 14) return '午餐';
    if (h < 17) return '下午茶';
    return '晚餐';
  }

  function calculateScores(foods, preferences, scene, history) {
    const currentMealTime = getCurrentMealTime();
    const recentFoodIds = new Set();
    const now = Date.now();
    const penaltyCutoff = now - RECENT_PENALTY_DAYS * 24 * 60 * 60 * 1000;

    history.forEach(h => {
      if (h.timestamp > penaltyCutoff) {
        recentFoodIds.add(h.foodId);
      }
    });

    const userTaste = preferences.taste || [];
    if (typeof userTaste === 'string') {
      // Handle legacy single string
    }

    return foods.map(food => {
      let score = food.weight * 2;

      // Scene matching
      if (food.scene === scene) {
        score += SCENE_SCORE;
      }

      // Taste matching
      if (userTaste && userTaste.length > 0 && food.tags) {
        const tasteTags = Array.isArray(userTaste) ? userTaste : [userTaste];
        const matchCount = tasteTags.filter(t => food.tags.includes(t)).length;
        score += matchCount * (TASTE_SCORE / 3);
      }

      // Meal time matching
      if (food.mealTime === currentMealTime) {
        score += MEAL_TIME_SCORE;
      }

      // Price level matching (prefer cheaper in 省钱模式, neutral otherwise)
      if (scene === '省钱模式') {
        score += (3 - food.priceLevel) * PRICE_SCORE;
      } else if (scene === '健康模式') {
        if (food.tags.includes('healthy')) score += PRICE_SCORE * 2;
        if (food.tags.includes('fried')) score -= PRICE_SCORE;
      } else if (scene === '想吃爽一点') {
        if (food.tags.includes('heavy') || food.tags.includes('meat') || food.tags.includes('fried')) {
          score += PRICE_SCORE;
        }
      } else if (scene === '很累模式') {
        if (food.tags.includes('comfort') || food.tags.includes('fast')) {
          score += PRICE_SCORE * 2;
        }
      } else if (scene === '聚餐模式') {
        if (food.priceLevel >= 2) score += PRICE_SCORE;
      }

      // Recent penalty
      if (recentFoodIds.has(food.id)) {
        score -= RECENT_PENALTY_POINTS;
      }

      // Add small randomness
      score += Math.random() * 5;

      food._score = Math.max(0, score);
      return food;
    });
  }

  function recommend(foods, preferences, scene, history) {
    const scored = calculateScores(foods, preferences, scene, history);
    scored.sort((a, b) => b._score - a._score);

    // Pick from top 30% randomly
    const topCount = Math.max(3, Math.ceil(scored.length * 0.3));
    const candidates = scored.slice(0, topCount);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];

    return pick;
  }

  function recommendNext(foods, preferences, scene, history, excludeId) {
    const filtered = foods.filter(f => f.id !== excludeId);
    return recommend(filtered, preferences, scene, history);
  }

  return { recommend, recommendNext, calculateScores };
})();
/**
 * @preserve
 * @license MIT
 */
