/**
 * Pure progress/streak logic for the Vietnam War study course.
 * No DOM, no localStorage access here — app.js owns persistence and
 * calls into these functions with plain data, which keeps this file
 * runnable both in the browser (as a plain script, window.Progress)
 * and under Node for tests (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Progress = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toDateStr(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function daysBetween(dateStrA, dateStrB) {
    const a = new Date(dateStrA + 'T12:00:00');
    const b = new Date(dateStrB + 'T12:00:00');
    return Math.round((b - a) / 86400000);
  }

  function createInitialState() {
    return { completedIds: [], lastCompletedDate: null, streak: 0 };
  }

  function completeCard(state, cardId, now = new Date()) {
    const today = toDateStr(now);
    const alreadyDone = state.completedIds.includes(cardId);

    if (alreadyDone) {
      return { ...state, completedIds: state.completedIds.slice() };
    }

    const completedIds = [...state.completedIds, cardId];

    if (!state.lastCompletedDate) {
      return { completedIds, lastCompletedDate: today, streak: 1 };
    }

    const gap = daysBetween(state.lastCompletedDate, today);

    if (gap < 0) {
      // System clock moved backward relative to a previously recorded
      // date — keep the existing date/streak rather than corrupt them.
      return { completedIds, lastCompletedDate: state.lastCompletedDate, streak: state.streak };
    }

    let streak;
    if (gap === 0) {
      streak = state.streak;
    } else if (gap === 1) {
      streak = state.streak + 1;
    } else {
      streak = 1;
    }

    return { completedIds, lastCompletedDate: today, streak };
  }

  function getDisplayStreak(state, now = new Date()) {
    if (!state.lastCompletedDate || state.streak === 0) return 0;
    const gap = daysBetween(state.lastCompletedDate, toDateStr(now));
    return gap <= 1 ? state.streak : 0;
  }

  function getNextCard(state, orderedCards) {
    const completed = new Set(state.completedIds);
    return orderedCards.find((c) => !completed.has(c.id)) || null;
  }

  function getProgressSummary(state, orderedCards, now = new Date()) {
    const total = orderedCards.length;
    const completed = orderedCards.filter((c) => state.completedIds.includes(c.id)).length;
    const next = getNextCard(state, orderedCards);
    const currentPhase = next ? next.phase : (total ? orderedCards[total - 1].phase : null);

    return {
      total,
      completed,
      remaining: total - completed,
      currentPhase,
      streak: getDisplayStreak(state, now),
    };
  }

  return {
    toDateStr,
    daysBetween,
    createInitialState,
    completeCard,
    getDisplayStreak,
    getNextCard,
    getProgressSummary,
  };
});
