(function () {
  'use strict';

  var STORAGE_KEY = 'vnHistoryProgressV1';

  var CARDS = (window.CARDS_DATA && window.CARDS_DATA.cards ? window.CARDS_DATA.cards.slice() : [])
    .sort(function (a, b) { return a.order - b.order; });
  var PHASES = (window.CARDS_DATA && window.CARDS_DATA.phases) || [];

  function phaseTitle(phaseId) {
    var p = PHASES.find(function (p) { return p.id === phaseId; });
    return p ? p.title : phaseId;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Progress.createInitialState();
      var parsed = JSON.parse(raw);
      var valid = parsed &&
        Array.isArray(parsed.completedIds) &&
        (parsed.lastCompletedDate === null || typeof parsed.lastCompletedDate === 'string') &&
        typeof parsed.streak === 'number';
      if (!valid) return Progress.createInitialState();
      return parsed;
    } catch (e) {
      return Progress.createInitialState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();

  // ---------- Card rendering ----------

  // ---------- Content block renderers ----------
  // Each reading card is a sequence of typed blocks so it reads as a small
  // illustrated brief rather than a wall of prose. Every renderer returns
  // a DOM node; unknown/malformed blocks are skipped rather than crashing
  // the card, since content is authored data, not code.

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  var BLOCK_RENDERERS = {
    p: function (b) {
      return el('p', 'block block-p', b.text);
    },
    lede: function (b) {
      return el('p', 'block block-lede', b.text);
    },
    quote: function (b) {
      var wrap = el('blockquote', 'block block-quote');
      wrap.appendChild(el('span', null, b.text));
      if (b.attribution) wrap.appendChild(el('span', 'block-quote-attribution', '— ' + b.attribution));
      return wrap;
    },
    callout: function (b) {
      var wrap = el('div', 'block block-callout');
      if (b.label) {
        var label = el('span', 'block-callout-label');
        label.appendChild(document.createTextNode((b.icon ? b.icon + ' ' : '') + b.label));
        wrap.appendChild(label);
      }
      wrap.appendChild(el('p', 'block-callout-text', b.text));
      return wrap;
    },
    timeline: function (b) {
      var wrap = el('div', 'block block-timeline');
      if (b.title) wrap.appendChild(el('p', 'block-timeline-title', b.title));
      var list = el('div', 'timeline');
      (b.items || []).forEach(function (item) {
        var row = el('div', 'timeline-item');
        row.appendChild(el('span', 'timeline-dot'));
        row.appendChild(el('div', 'timeline-when', item.when));
        row.appendChild(el('div', 'timeline-text', item.text));
        list.appendChild(row);
      });
      wrap.appendChild(list);
      return wrap;
    },
    flow: function (b) {
      var wrap = el('div', 'block block-flow');
      if (b.title) wrap.appendChild(el('p', 'block-flow-title', b.title));
      var steps = el('div', 'flow-steps');
      (b.steps || []).forEach(function (step, i) {
        if (i > 0) steps.appendChild(el('div', 'flow-arrow', '↓'));
        steps.appendChild(el('div', 'flow-step', step));
      });
      wrap.appendChild(steps);
      return wrap;
    },
    stats: function (b) {
      var wrap = el('div', 'block block-stats');
      (b.items || []).forEach(function (item) {
        var chip = el('div', 'stat-chip');
        chip.appendChild(el('div', 'stat-chip-value', item.value));
        chip.appendChild(el('div', 'stat-chip-label', item.label));
        wrap.appendChild(chip);
      });
      return wrap;
    },
    figures: function (b) {
      var wrap = el('div', 'block block-figures');
      if (b.title) wrap.appendChild(el('p', 'block-figures-title', b.title));
      var row = el('div', 'figures-row');
      (b.items || []).forEach(function (person) {
        var chip = el('div', 'figure-chip');
        var initials = (person.name || '?').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
        chip.appendChild(el('span', 'figure-avatar', initials));
        var text = el('span', 'figure-text');
        text.appendChild(el('span', 'figure-name', person.name));
        if (person.role) text.appendChild(el('span', 'figure-role', person.role));
        chip.appendChild(text);
        row.appendChild(chip);
      });
      wrap.appendChild(row);
      return wrap;
    },
    compare: function (b) {
      var wrap = el('div', 'block block-compare');
      var grid = el('div', 'compare-grid');
      [b.left, b.right].forEach(function (col) {
        if (!col) return;
        var colEl = el('div', 'compare-col');
        colEl.appendChild(el('div', 'compare-col-title', col.title));
        var ul = el('ul');
        (col.points || []).forEach(function (point) { ul.appendChild(el('li', null, point)); });
        colEl.appendChild(ul);
        grid.appendChild(colEl);
      });
      wrap.appendChild(grid);
      return wrap;
    },
  };

  function renderBlocks(container, blocks) {
    (blocks || []).forEach(function (b) {
      var renderer = BLOCK_RENDERERS[b.type];
      if (!renderer) return;
      container.appendChild(renderer(b));
    });
  }

  function renderCardInto(container, card, opts) {
    opts = opts || {};
    container.innerHTML = '';
    container.setAttribute('data-phase', card.phase);

    var BADGE_LABELS = { flashcard: 'Active recall', essay: 'Essay practice', reading: 'Reading' };
    var badge = document.createElement('span');
    badge.className = 'card-type-badge ' + card.type;
    badge.textContent = BADGE_LABELS[card.type] || 'Reading';
    container.appendChild(badge);

    var h2 = document.createElement('h2');
    h2.textContent = card.title;
    container.appendChild(h2);

    var meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = phaseTitle(card.phase);
    container.appendChild(meta);

    if (card.type === 'flashcard') {
      var q = document.createElement('p');
      q.className = 'flashcard-question';
      q.textContent = card.question;
      container.appendChild(q);

      var revealBtn = document.createElement('button');
      revealBtn.className = 'reveal-btn';
      revealBtn.textContent = 'Tap to reveal answer';
      container.appendChild(revealBtn);

      var answerWrap = document.createElement('div');
      answerWrap.className = 'flashcard-answer hidden';
      var answerP = document.createElement('p');
      answerP.textContent = card.answer;
      answerWrap.appendChild(answerP);
      container.appendChild(answerWrap);

      revealBtn.addEventListener('click', function () {
        answerWrap.classList.remove('hidden');
        revealBtn.classList.add('hidden');
      });
    } else if (card.type === 'essay') {
      var prompt = document.createElement('p');
      prompt.className = 'essay-prompt';
      prompt.textContent = card.prompt;
      container.appendChild(prompt);

      var essayRevealBtn = document.createElement('button');
      essayRevealBtn.className = 'reveal-btn';
      essayRevealBtn.textContent = 'Tap to reveal key points';
      container.appendChild(essayRevealBtn);

      var pointsWrap = document.createElement('div');
      pointsWrap.className = 'essay-points hidden';
      var pointsLabel = document.createElement('p');
      pointsLabel.className = 'essay-points-label';
      pointsLabel.textContent = 'A strong answer would address:';
      pointsWrap.appendChild(pointsLabel);
      var ul = document.createElement('ul');
      (card.points || []).forEach(function (point) {
        var li = document.createElement('li');
        li.textContent = point;
        ul.appendChild(li);
      });
      pointsWrap.appendChild(ul);
      container.appendChild(pointsWrap);

      essayRevealBtn.addEventListener('click', function () {
        pointsWrap.classList.remove('hidden');
        essayRevealBtn.classList.add('hidden');
      });
    } else if (card.blocks) {
      var blockWrap = document.createElement('div');
      blockWrap.className = 'card-body';
      renderBlocks(blockWrap, card.blocks);
      container.appendChild(blockWrap);
    } else {
      var body = document.createElement('div');
      body.className = 'card-body';
      (card.body || []).forEach(function (para) {
        var p = document.createElement('p');
        p.textContent = para;
        body.appendChild(p);
      });
      container.appendChild(body);
    }

    if (card.laterScholarship) {
      var ls = document.createElement('div');
      ls.className = 'later-scholarship';
      var label = document.createElement('span');
      label.className = 'ls-label';
      label.textContent = 'Later scholarship note';
      ls.appendChild(label);
      var lsText = document.createElement('p');
      lsText.style.margin = '0';
      lsText.textContent = card.laterScholarship;
      ls.appendChild(lsText);
      container.appendChild(ls);
    }
  }

  // ---------- Today view ----------

  var todayCardEl = document.getElementById('today-card');
  var todayTitleEl = document.getElementById('today-title');
  var todayPhaseLabelEl = document.getElementById('today-phase-label');
  var completeWrap = document.getElementById('today-complete-wrap');
  var markCompleteBtn = document.getElementById('mark-complete-btn');
  var doneStateEl = document.getElementById('today-done-state');

  function renderToday() {
    var next = Progress.getNextCard(state, CARDS);

    if (!next) {
      todayTitleEl.textContent = 'Course complete';
      todayPhaseLabelEl.textContent = 'All phases';
      todayCardEl.classList.add('hidden');
      completeWrap.classList.add('hidden');
      doneStateEl.classList.remove('hidden');
      doneStateEl.querySelector('h2').textContent = "You've completed the course.";
      doneStateEl.querySelector('.muted').textContent =
        'Every phase is done. Use Browse to revisit any card, or check your Dashboard for the full picture.';
      return;
    }

    doneStateEl.classList.add('hidden');
    todayCardEl.classList.remove('hidden');
    completeWrap.classList.remove('hidden');

    todayPhaseLabelEl.textContent = phaseTitle(next.phase);
    todayTitleEl.textContent = "Today's card";
    renderCardInto(todayCardEl, next);
    markCompleteBtn.disabled = false;
    markCompleteBtn.textContent = 'Mark as done';
    markCompleteBtn.onclick = function () { completeCurrentCard(next.id); };
  }

  function completeCurrentCard(cardId) {
    state = Progress.completeCard(state, cardId, new Date());
    saveState(state);

    todayCardEl.classList.add('hidden');
    completeWrap.classList.add('hidden');
    doneStateEl.classList.remove('hidden');

    var summary = Progress.getProgressSummary(state, CARDS);
    var heading = doneStateEl.querySelector('h2');
    var sub = doneStateEl.querySelector('.muted');

    if (summary.remaining === 0) {
      heading.textContent = "You've completed the course.";
      sub.textContent = 'Every phase is done. Use Browse to revisit any card, or check your Dashboard for the full picture.';
      removeContinueButton();
    } else {
      heading.textContent = 'Nice work — card complete.';
      sub.textContent = summary.streak + ' day streak · ' + summary.remaining + ' card' +
        (summary.remaining === 1 ? '' : 's') + ' left.';
      ensureContinueButton();
    }

    refreshDashboard();
    refreshTabBadges();
  }

  function ensureContinueButton() {
    var btn = document.getElementById('today-continue-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'today-continue-btn';
      btn.className = 'btn-primary';
      btn.style.marginTop = '18px';
      doneStateEl.appendChild(btn);
    }
    btn.textContent = 'Continue to next card';
    btn.onclick = renderToday;
  }

  function removeContinueButton() {
    var btn = document.getElementById('today-continue-btn');
    if (btn) btn.remove();
  }

  // ---------- Browse view ----------

  var browseListEl = document.getElementById('browse-list');

  function renderBrowse() {
    browseListEl.innerHTML = '';
    PHASES.forEach(function (phase) {
      var phaseCards = CARDS.filter(function (c) { return c.phase === phase.id; });
      if (!phaseCards.length) return;

      var group = document.createElement('div');
      group.className = 'phase-group';

      var title = document.createElement('h3');
      title.className = 'phase-group-title';
      title.textContent = phase.title;
      group.appendChild(title);

      phaseCards.forEach(function (card) {
        var item = document.createElement('button');
        item.className = 'browse-item';

        var check = document.createElement('span');
        check.className = 'bi-check';
        check.textContent = state.completedIds.includes(card.id) ? '✓' : '';
        item.appendChild(check);

        var t = document.createElement('span');
        t.className = 'bi-title';
        t.textContent = card.title;
        item.appendChild(t);

        var BROWSE_TYPE_ICONS = { flashcard: '◆', essay: '✎' };
        var type = document.createElement('span');
        type.className = 'bi-type';
        type.textContent = BROWSE_TYPE_ICONS[card.type] || '';
        item.appendChild(type);

        item.addEventListener('click', function () { openReader(card); });
        group.appendChild(item);
      });

      browseListEl.appendChild(group);
    });
  }

  // ---------- Reader view (opened from Browse) ----------

  var readerCardEl = document.getElementById('reader-card');
  var readerBackBtn = document.getElementById('reader-back-btn');

  function openReader(card) {
    renderCardInto(readerCardEl, card);

    if (!state.completedIds.includes(card.id)) {
      var btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.style.marginTop = '4px';
      btn.textContent = 'Mark as done';
      btn.onclick = function () {
        state = Progress.completeCard(state, card.id, new Date());
        saveState(state);
        renderBrowse();
        refreshDashboard();
        refreshTabBadges();
        openReader(card);
      };
      readerCardEl.appendChild(btn);
    }

    showView('reader');
  }

  readerBackBtn.addEventListener('click', function () { showView('browse'); });

  // ---------- Glossary view ----------

  var GLOSSARY = (window.GLOSSARY_DATA || []).slice().sort(function (a, b) {
    return a.term.localeCompare(b.term);
  });
  var glossaryListEl = document.getElementById('glossary-list');
  var glossarySearchEl = document.getElementById('glossary-search');

  function renderGlossary() {
    var query = glossarySearchEl.value.trim().toLowerCase();
    var matches = !query ? GLOSSARY : GLOSSARY.filter(function (entry) {
      return entry.term.toLowerCase().indexOf(query) !== -1 ||
        entry.definition.toLowerCase().indexOf(query) !== -1;
    });

    glossaryListEl.innerHTML = '';
    if (!matches.length) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No terms match "' + glossarySearchEl.value.trim() + '".';
      glossaryListEl.appendChild(empty);
      return;
    }

    matches.forEach(function (entry) {
      var item = document.createElement('div');
      item.className = 'glossary-item';
      item.setAttribute('data-phase', entry.phase);
      var term = document.createElement('p');
      term.className = 'glossary-term';
      term.textContent = entry.term;
      var def = document.createElement('p');
      def.className = 'glossary-def';
      def.textContent = entry.definition;
      item.appendChild(term);
      item.appendChild(def);
      glossaryListEl.appendChild(item);
    });
  }

  glossarySearchEl.addEventListener('input', renderGlossary);

  // ---------- Review mode (flashcards & essay cards you've already completed) ----------

  var reviewCardEl = document.getElementById('review-card');
  var reviewCounterEl = document.getElementById('review-counter');
  var reviewEmptyEl = document.getElementById('review-empty');
  var reviewPrevBtn = document.getElementById('review-prev-btn');
  var reviewNextBtn = document.getElementById('review-next-btn');
  var reviewBackBtn = document.getElementById('review-back-btn');
  var reviewEntryBtn = document.getElementById('review-entry-btn');
  var reviewDeck = [];
  var reviewIndex = 0;

  function buildReviewDeck() {
    return CARDS.filter(function (c) {
      return c.type !== 'reading' && state.completedIds.includes(c.id);
    });
  }

  function renderReviewCard() {
    if (!reviewDeck.length) {
      reviewCardEl.classList.add('hidden');
      reviewCounterEl.textContent = '';
      reviewPrevBtn.classList.add('hidden');
      reviewNextBtn.classList.add('hidden');
      reviewEmptyEl.classList.remove('hidden');
      return;
    }
    reviewEmptyEl.classList.add('hidden');
    reviewCardEl.classList.remove('hidden');
    reviewPrevBtn.classList.remove('hidden');
    reviewNextBtn.classList.remove('hidden');
    renderCardInto(reviewCardEl, reviewDeck[reviewIndex]);
    reviewCounterEl.textContent = (reviewIndex + 1) + ' of ' + reviewDeck.length;
  }

  reviewPrevBtn.addEventListener('click', function () {
    if (!reviewDeck.length) return;
    reviewIndex = (reviewIndex - 1 + reviewDeck.length) % reviewDeck.length;
    renderReviewCard();
  });

  reviewNextBtn.addEventListener('click', function () {
    if (!reviewDeck.length) return;
    reviewIndex = (reviewIndex + 1) % reviewDeck.length;
    renderReviewCard();
  });

  reviewBackBtn.addEventListener('click', function () { showView('dashboard'); });

  reviewEntryBtn.addEventListener('click', function () {
    reviewDeck = buildReviewDeck();
    reviewIndex = 0;
    showView('review');
  });

  // ---------- Dashboard view ----------

  var statStreakEl = document.getElementById('stat-streak');
  var statCompletedEl = document.getElementById('stat-completed');
  var statRemainingEl = document.getElementById('stat-remaining');
  var progressBarFillEl = document.getElementById('progress-bar-fill');
  var progressBarCaptionEl = document.getElementById('progress-bar-caption');
  var currentPhaseNameEl = document.getElementById('current-phase-name');
  var phaseProgressListEl = document.getElementById('phase-progress-list');

  function refreshDashboard() {
    var summary = Progress.getProgressSummary(state, CARDS);

    statStreakEl.textContent = summary.streak;
    statCompletedEl.textContent = summary.completed;
    statRemainingEl.textContent = summary.remaining;

    var pct = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
    progressBarFillEl.style.width = pct + '%';
    progressBarCaptionEl.textContent = summary.completed + ' of ' + summary.total + ' cards (' + pct + '%)';

    currentPhaseNameEl.textContent = summary.currentPhase ? phaseTitle(summary.currentPhase) : '—';

    phaseProgressListEl.innerHTML = '';
    PHASES.forEach(function (phase) {
      var phaseCards = CARDS.filter(function (c) { return c.phase === phase.id; });
      if (!phaseCards.length) return;
      var done = phaseCards.filter(function (c) { return state.completedIds.includes(c.id); }).length;

      var row = document.createElement('div');
      row.className = 'phase-row';
      var name = document.createElement('span');
      name.className = 'phase-row-name';
      name.textContent = phase.title;
      var count = document.createElement('span');
      count.className = 'phase-row-count';
      count.textContent = done + ' / ' + phaseCards.length;
      row.appendChild(name);
      row.appendChild(count);
      phaseProgressListEl.appendChild(row);
    });

    renderCardTypeBreakdown();
    renderReviewPipelineStatus();
    renderSystemStatus();
  }

  // ---------- Card-type breakdown ----------

  var cardTypeListEl = document.getElementById('card-type-list');
  var CARD_TYPE_LABELS = { reading: 'Reading cards', flashcard: 'Flashcards', essay: 'Essay practice' };

  function renderCardTypeBreakdown() {
    cardTypeListEl.innerHTML = '';
    ['reading', 'flashcard', 'essay'].forEach(function (type) {
      var ofType = CARDS.filter(function (c) { return c.type === type; });
      if (!ofType.length) return;
      var done = ofType.filter(function (c) { return state.completedIds.includes(c.id); }).length;

      var row = document.createElement('div');
      row.className = 'phase-row';
      var name = document.createElement('span');
      name.className = 'phase-row-name';
      name.textContent = CARD_TYPE_LABELS[type];
      var count = document.createElement('span');
      count.className = 'phase-row-count';
      count.textContent = done + ' / ' + ofType.length;
      row.appendChild(name);
      row.appendChild(count);
      cardTypeListEl.appendChild(row);
    });
  }

  // ---------- Review pipeline status ----------
  // Makes the "does completing a card actually feed the review deck" flow
  // visible and checkable, rather than something you have to trust blindly.

  var reviewPipelineStatusEl = document.getElementById('review-pipeline-status');

  function statusRow(icon, label, detail) {
    var row = document.createElement('div');
    row.className = 'status-row';
    row.appendChild(el('span', 'status-icon', icon));
    var textWrap = el('div', 'status-text');
    textWrap.appendChild(el('p', 'status-label', label));
    if (detail) textWrap.appendChild(el('p', 'status-detail', detail));
    row.appendChild(textWrap);
    return row;
  }

  function renderReviewPipelineStatus() {
    var pool = CARDS.filter(function (c) { return c.type !== 'reading'; });
    var deck = buildReviewDeck();

    reviewPipelineStatusEl.innerHTML = '';
    if (deck.length > 0) {
      reviewPipelineStatusEl.appendChild(statusRow('✅', 'Pipeline working',
        deck.length + ' of ' + pool.length + ' flashcards & essay-practice cards completed — ready to review.'));
    } else if (pool.length > 0) {
      reviewPipelineStatusEl.appendChild(statusRow('⚪', 'Nothing to review yet',
        '0 of ' + pool.length + ' flashcards & essay-practice cards completed. Mark one done (from Today or Browse), then check back here — this count should go up immediately.'));
    } else {
      reviewPipelineStatusEl.appendChild(statusRow('❌', 'No flashcards or essay cards found',
        'This would indicate a data-loading problem, since the course should always include some.'));
    }

    var reviewCount = deck.length;
    reviewEntryBtn.textContent = '🔁 Open review mode (' + reviewCount + ')';
    reviewEntryBtn.disabled = reviewCount === 0;
  }

  // ---------- System status / diagnostics ----------

  var systemStatusListEl = document.getElementById('system-status-list');
  var runDiagnosticsBtn = document.getElementById('run-diagnostics-btn');

  function renderSystemStatus() {
    systemStatusListEl.innerHTML = '';

    // Course data integrity: non-empty, unique ids, sequential order —
    // cheap checks that would catch a broken or half-loaded data file.
    var ids = CARDS.map(function (c) { return c.id; });
    var idsUnique = new Set(ids).size === ids.length;
    var ordersSequential = CARDS.every(function (c, i) { return c.order === i + 1; });
    var dataOk = CARDS.length > 0 && idsUnique && ordersSequential;
    systemStatusListEl.appendChild(statusRow(
      dataOk ? '✅' : '❌',
      'Course data',
      dataOk
        ? CARDS.length + ' cards loaded across ' + PHASES.length + ' phases, all valid.'
        : 'Something is wrong with the loaded card data (count, IDs, or ordering).'
    ));

    // Glossary data.
    var glossaryOk = GLOSSARY.length > 0;
    systemStatusListEl.appendChild(statusRow(
      glossaryOk ? '✅' : '❌',
      'Glossary data',
      glossaryOk ? GLOSSARY.length + ' terms loaded.' : 'No glossary terms loaded.'
    ));

    // localStorage read/write round trip.
    var storageOk = false;
    try {
      var testKey = '__vnHistoryStorageTest__';
      localStorage.setItem(testKey, 'ok');
      storageOk = localStorage.getItem(testKey) === 'ok';
      localStorage.removeItem(testKey);
    } catch (e) {
      storageOk = false;
    }
    systemStatusListEl.appendChild(statusRow(
      storageOk ? '✅' : '❌',
      'Local storage',
      storageOk ? 'Progress saves and loads correctly on this device.' : 'Storage is blocked (private browsing mode can cause this) — progress will not be saved.'
    ));

    // Service worker / offline readiness — async, so it fills in a moment
    // after the rest of the panel renders.
    var swRow = statusRow('⏳', 'Offline mode', 'Checking…');
    systemStatusListEl.appendChild(swRow);

    if (!('serviceWorker' in navigator)) {
      swRow.replaceWith(statusRow('❌', 'Offline mode', 'Not supported in this browser.'));
      return;
    }

    navigator.serviceWorker.getRegistration().then(function (reg) {
      var replacement;
      if (navigator.serviceWorker.controller) {
        replacement = statusRow('✅', 'Offline mode', 'Active — this page is being served from the offline cache. Airplane Mode will work.');
      } else if (reg) {
        replacement = statusRow('⚪', 'Offline mode', 'Registered but not controlling this page yet — reload once more to finish activating.');
      } else {
        replacement = statusRow('❌', 'Offline mode', 'Not registered yet. Needs a real HTTPS (or localhost) address, and one full page load.');
      }
      swRow.replaceWith(replacement);
    }).catch(function () {
      swRow.replaceWith(statusRow('❌', 'Offline mode', 'Could not check service worker status.'));
    });
  }

  runDiagnosticsBtn.addEventListener('click', renderSystemStatus);

  function refreshTabBadges() {
    // placeholder for future badge counts; kept as a single refresh point
    // so completion actions anywhere in the app update every view.
  }

  // ---------- Tab / view navigation ----------

  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var views = {
    today: document.getElementById('view-today'),
    browse: document.getElementById('view-browse'),
    reader: document.getElementById('view-reader'),
    glossary: document.getElementById('view-glossary'),
    review: document.getElementById('view-review'),
    dashboard: document.getElementById('view-dashboard'),
  };
  var TAB_ALIAS = { reader: 'browse', review: 'dashboard' };

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle('hidden', key !== name);
    });
    var activeTab = TAB_ALIAS[name] || name;
    tabButtons.forEach(function (btn) {
      if (btn.dataset.tab === activeTab) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
    if (name === 'today') renderToday();
    if (name === 'browse') renderBrowse();
    if (name === 'glossary') renderGlossary();
    if (name === 'review') renderReviewCard();
    if (name === 'dashboard') refreshDashboard();
    document.getElementById('views').scrollTop = 0;
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { showView(btn.dataset.tab); });
  });

  // ---------- Init ----------

  renderToday();
  refreshDashboard();
  showView('today');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () {
        // offline-first PWA still works without it on this load; registration
        // will retry on the next successful load.
      });
    });
  }
})();
