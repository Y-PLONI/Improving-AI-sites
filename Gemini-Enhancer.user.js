// ==UserScript==
// @name         Gemini – משופר
// @namespace    https://example.com/
// @version      1.0.0
// @description  סרגל ניווט לשיחה, RTL משופר, בועות שיחה, ייצוא שיחה והתראות על תשובות חדשות ב-Gemini.
// @author       Y-PLONI
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/Y-PLONI/Improving-AI-sites/raw/main/Gemini-Enhancer.user.js
// @updateURL    https://github.com/Y-PLONI/Improving-AI-sites/raw/main/Gemini-Enhancer.user.js
// ==/UserScript==

(() => {
  'use strict';

  const DEFAULTS = {
    sidebar: true,
    rtl: true,
    bubbles: true,
    aiMessageNotifications: true,
    copyConversationButton: true
  };

  const SETTINGS_KEY = 'geminiEnhancerSettings';
  const settings = Object.assign({}, DEFAULTS, GM_getValue(SETTINGS_KEY, {}));

  const SIDEBAR_ID = 'gemini-progress-sidebar';
  const ACTIONS_CONTAINER_ID = 'gemini-enhancer-actions';
  const COPY_BUTTON_ID = 'gemini-copy-conversation';
  const MENU_TOGGLE_BUTTON_ID = 'gemini-conversation-menu-toggle';
  const ACTIONS_MENU_ID = 'gemini-conversation-actions-menu';
  const SAVE_BUTTON_ID = 'gemini-save-conversation';
  const SETTINGS_DIALOG_ID = 'gemini-enhancer-settings';

  let messages = [];
  let currentMessageIndex = -1;
  let lastAssistantSignature = '';
  let notificationInitialized = false;

  function saveSettings() {
    GM_setValue(SETTINGS_KEY, settings);
  }

  function debounce(fn, wait) {
    let timeout = null;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
      return;
    }
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function cleanText(text) {
    return (text || '')
      .replace(/\u200f|\u200e/g, '')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function cloneTextFromElement(element, selectorsToRemove = []) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    selectorsToRemove.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    });
    return cleanText(clone.textContent || '');
  }

  function getConversationTitle() {
    const titleElement = document.querySelector('[data-test-id="conversation-title"]');
    const rawTitle = (titleElement?.textContent || document.title || 'שיחת Gemini')
      .replace(/\s*[-|]\s*Gemini\s*$/i, '')
      .replace(/^Gemini\s*[-|]\s*/i, '')
      .trim();
    return rawTitle || 'שיחת Gemini';
  }

  function getExportDateParts() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    return {
      dateDots: `${day}.${month}.${year}`,
      timeStr: `${hours}:${minutes}`,
      fileStamp: `${year}-${month}-${day}_${hours}-${minutes}`
    };
  }

  function sanitizeFilename(name) {
    const fallback = 'שיחת Gemini';
    return (name || fallback)
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || fallback;
  }

  function downloadTextFile(text, fileName) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  function getInputRect() {
    const input = document.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
    return input ? input.getBoundingClientRect() : { top: window.innerHeight - 120, height: 60 };
  }

  function getUserMessageText(element) {
    return cloneTextFromElement(element, [
      'button',
      '.cdk-visually-hidden',
      '.mat-mdc-tooltip-trigger',
      '.file-preview-container'
    ]);
  }

  function getAssistantMessageText(element) {
    const content = element.querySelector('message-content .markdown, .model-response-text .markdown');
    return cloneTextFromElement(content || element, [
      'button',
      'copy-button',
      'message-actions',
      '.response-container-header',
      '.response-container-footer',
      '.cdk-visually-hidden',
      'mat-icon',
      'sources-list'
    ]);
  }

  function collectConversationTurns() {
    const turns = [];
    const elements = Array.from(document.querySelectorAll('user-query, model-response'));
    elements.forEach((element) => {
      const isUser = element.matches('user-query');
      const text = isUser ? getUserMessageText(element) : getAssistantMessageText(element);
      if (!text) return;
      turns.push({
        role: isUser ? 'user' : 'assistant',
        text,
        element
      });
    });
    return turns;
  }

  function buildConversationTranscript(turns) {
    return turns
      .map((turn) => `${turn.role === 'user' ? 'שאלתי:' : 'וענו לי:'}\n${turn.text}`)
      .join('\n\n')
      .trim();
  }

  function buildConversationExport() {
    const turns = collectConversationTurns();
    const transcript = buildConversationTranscript(turns);
    if (!transcript) return null;
    const title = getConversationTitle();
    const { dateDots, timeStr, fileStamp } = getExportDateParts();
    return {
      transcript,
      fileName: `${fileStamp} - ${sanitizeFilename(title)}.txt`,
      fileText: [
        `נושא: ${title}`,
        `תאריך ייצוא: ${dateDots} | שעה: ${timeStr}`,
        `קישור: ${window.location.href}`,
        `${'='.repeat(60)}`,
        '',
        transcript
      ].join('\n').trim()
    };
  }

  function playNotificationSound(notificationBody = 'הודעה חדשה מ-Gemini') {
    if (playNotificationSound.lastPlayed && Date.now() - playNotificationSound.lastPlayed < 2000) return;
    playNotificationSound.lastPlayed = Date.now();

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.45);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.45);
    } catch (error) {
      console.log('[Gemini] Failed to play notification sound:', error);
    }

    if ('Notification' in window && document.visibilityState === 'hidden' && Notification.permission === 'granted') {
      new Notification('Gemini', {
        body: notificationBody,
        icon: 'https://gemini.google.com/favicon.ico',
        tag: 'gemini-enhancer-notification'
      });
    }
  }

  function openSettings() {
    if (document.getElementById(SETTINGS_DIALOG_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = SETTINGS_DIALOG_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;';

    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(420px,100%);background:#fff;color:#111827;border-radius:16px;padding:20px 22px;direction:rtl;text-align:right;box-shadow:0 24px 80px rgba(15,23,42,.28);font:14px/1.5 sans-serif;';

    const title = document.createElement('h3');
    title.textContent = 'הגדרות Gemini – משופר';
    title.style.cssText = 'margin:0 0 12px;font-size:20px;';

    const text = document.createElement('p');
    text.textContent = 'החלק של שמירה אוטומטית לא כלול כאן בכוונה.';
    text.style.cssText = 'margin:0 0 14px;color:#4b5563;';

    panel.append(title, text);

    const addCheckbox = (key, label) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!settings[key];
      checkbox.addEventListener('change', () => {
        settings[key] = checkbox.checked;
      });
      const span = document.createElement('span');
      span.textContent = label;
      row.append(checkbox, span);
      panel.appendChild(row);
    };

    addCheckbox('sidebar', 'הצג סרגל ניווט לשיחה');
    addCheckbox('rtl', 'הפעל תיקוני RTL');
    addCheckbox('bubbles', 'הפעל בועות שיחה צבעוניות');
    addCheckbox('aiMessageNotifications', 'הפעל התראות על תשובה חדשה');
    addCheckbox('copyConversationButton', 'הצג כפתורי העתקה וייצוא');

    const notifButton = document.createElement('button');
    notifButton.type = 'button';
    notifButton.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:10px;border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;';
    const updateNotifButton = () => {
      if (!('Notification' in window)) {
        notifButton.textContent = 'התראות אינן נתמכות בדפדפן זה';
        notifButton.disabled = true;
      } else if (Notification.permission === 'granted') {
        notifButton.textContent = 'התראות שולחן עבודה מאושרות';
        notifButton.disabled = true;
      } else if (Notification.permission === 'denied') {
        notifButton.textContent = 'התראות שולחן עבודה חסומות';
        notifButton.disabled = true;
      } else {
        notifButton.textContent = 'אשר התראות שולחן עבודה';
        notifButton.disabled = false;
      }
    };
    updateNotifButton();
    notifButton.addEventListener('click', () => Notification.requestPermission().then(updateNotifButton));
    panel.appendChild(notifButton);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-start;gap:8px;margin-top:16px;';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'שמור והטען מחדש';
    saveButton.style.cssText = 'padding:9px 14px;border-radius:10px;border:1px solid #1d4ed8;background:#2563eb;color:#fff;cursor:pointer;';
    saveButton.addEventListener('click', () => {
      saveSettings();
      location.reload();
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'ביטול';
    cancelButton.style.cssText = 'padding:9px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;';
    cancelButton.addEventListener('click', () => overlay.remove());

    actions.append(saveButton, cancelButton);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  GM_registerMenuCommand('⚙️ הגדרות Gemini – משופר', openSettings);

  function injectBaseStyles() {
    addStyle(`
      #${SIDEBAR_ID}{
        position:fixed;
        left:10px;
        top:88px;
        width:32px;
        z-index:9998;
        display:flex;
        gap:8px;
        pointer-events:none;
        transition:opacity .2s ease;
      }
      #${SIDEBAR_ID}.is-hidden{opacity:0;visibility:hidden}
      #${SIDEBAR_ID} .gemini-sidebar-column{
        position:relative;
        width:8px;
        min-height:120px;
        border-radius:999px;
        background:transparent;
        pointer-events:none;
      }
      #${SIDEBAR_ID} .gemini-sidebar-column::before{
        content:'';
        position:absolute;
        inset-block:0;
        left:50%;
        width:2px;
        transform:translateX(-50%);
        border-radius:999px;
        background:linear-gradient(180deg, rgba(148,163,184,.18), rgba(148,163,184,.45), rgba(148,163,184,.18));
      }
      #${SIDEBAR_ID} .gemini-sidebar-dot{
        position:absolute;
        left:50%;
        width:8px;
        height:8px;
        padding:0;
        border-radius:50%;
        transform:translate(-50%,-50%);
        cursor:pointer;
        pointer-events:auto;
        border:none;
        appearance:none;
        -webkit-appearance:none;
        box-shadow:0 0 0 2px rgba(255,255,255,.92), 0 1px 4px rgba(15,23,42,.18);
      }
      #${SIDEBAR_ID} .gemini-sidebar-dot.user{background:#16a34a}
      #${SIDEBAR_ID} .gemini-sidebar-dot.assistant{background:#2563eb}
      #${SIDEBAR_ID} .gemini-sidebar-dot.active{
        transform:translate(-50%,-50%) scale(1.15);
        box-shadow:0 0 0 3px rgba(191,219,254,.95), 0 0 0 6px rgba(37,99,235,.16), 0 1px 6px rgba(15,23,42,.22);
      }
      #${ACTIONS_CONTAINER_ID}{
        display:inline-flex;
        align-items:center;
        gap:0;
        margin-inline-start:12px;
        vertical-align:middle;
        position:relative;
        border-radius:999px;
        overflow:visible;
        background:#eef2ff;
        box-shadow:inset 0 0 0 1px rgba(59,130,246,.08);
      }
      #${ACTIONS_CONTAINER_ID} button{
        border:none;
        border-radius:0;
        padding:7px 11px;
        background:transparent;
        color:#1e3a8a;
        cursor:pointer;
        font:600 13px/1.2 sans-serif;
      }
      #${ACTIONS_CONTAINER_ID} button:hover{background:#dbeafe}
      #${COPY_BUTTON_ID}{min-width:38px}
      #${MENU_TOGGLE_BUTTON_ID}{
        min-width:30px;
        padding-inline:8px;
        border-inline-start:1px solid rgba(59,130,246,.16);
        font-size:12px;
        line-height:1;
      }
      #${ACTIONS_MENU_ID}{
        position:fixed;
        top:0;
        left:0;
        min-width:144px;
        padding:8px;
        border-radius:12px;
        background:#fff;
        box-shadow:0 16px 48px rgba(15,23,42,.18);
        border:1px solid rgba(148,163,184,.28);
        display:none;
        z-index:9999;
      }
      #${ACTIONS_MENU_ID}[data-open="true"]{display:block}
      #${ACTIONS_MENU_ID} button{
        width:100%;
        justify-content:flex-start;
        border-radius:10px;
        background:#f8fafc;
        color:#0f172a;
      }
      @media (prefers-color-scheme: dark){
        #${SIDEBAR_ID} .gemini-sidebar-column::before{
          background:linear-gradient(180deg, rgba(100,116,139,.14), rgba(148,163,184,.4), rgba(100,116,139,.14));
        }
        #${SIDEBAR_ID} .gemini-sidebar-dot{
          box-shadow:0 0 0 2px rgba(15,23,42,.95), 0 1px 4px rgba(2,6,23,.35);
        }
        #${SIDEBAR_ID} .gemini-sidebar-dot.active{
          box-shadow:0 0 0 3px rgba(30,41,59,.96), 0 0 0 6px rgba(96,165,250,.2), 0 1px 6px rgba(2,6,23,.42);
        }
        #${ACTIONS_CONTAINER_ID}{
          background:#1e293b;
          box-shadow:inset 0 0 0 1px rgba(148,163,184,.12);
        }
        #${ACTIONS_CONTAINER_ID} button{background:transparent;color:#e2e8f0}
        #${ACTIONS_CONTAINER_ID} button:hover{background:#334155}
        #${MENU_TOGGLE_BUTTON_ID}{border-inline-start-color:rgba(148,163,184,.18)}
        #${ACTIONS_MENU_ID}{background:#0f172a;border-color:rgba(100,116,139,.35)}
        #${ACTIONS_MENU_ID} button{background:#111827;color:#e5e7eb}
      }
    `);
  }

  function injectRtlStyles() {
    if (!settings.rtl) return;
    addStyle(`
      message-content .markdown,
      message-content .markdown *,
      user-query .query-text,
      user-query .query-text *{
        direction:rtl !important;
        text-align:right !important;
      }
      message-content .markdown pre,
      message-content .markdown pre *,
      message-content .markdown code,
      message-content .markdown code *,
      message-content .markdown table:has(code),
      message-content .markdown .code-block,
      message-content .markdown .code-block *{
        direction:ltr !important;
        text-align:left !important;
        unicode-bidi:plaintext !important;
      }
      message-content .markdown ul,
      message-content .markdown ol{
        padding-inline-start:1.5em !important;
        padding-inline-end:1.2em !important;
      }
      user-query .query-text-line,
      message-content .markdown p,
      message-content .markdown li{
        unicode-bidi:plaintext;
      }
    `);
  }

  function injectBubbleStyles() {
    if (!settings.bubbles) return;
    addStyle(`
      user-query .query-content{
        background:transparent !important;
        padding:0 !important;
        box-shadow:none !important;
      }
      user-query .user-query-bubble-with-background{
        background:#effaf2 !important;
        border-radius:18px !important;
        padding:14px 18px !important;
        box-shadow:inset -4px 0 0 #22c55e !important;
      }
      model-response .response-container.no-background{
        background:#eff6ff !important;
        border:1px solid #bfdbfe !important;
        border-radius:20px !important;
        padding:16px 18px !important;
        box-shadow:inset 4px 0 0 #3b82f6 !important;
      }
      model-response .response-container-header,
      model-response .response-container-footer{
        padding-inline:0 !important;
      }
      @media (prefers-color-scheme: dark){
        user-query .query-content{
          background:transparent !important;
          box-shadow:none !important;
        }
        user-query .user-query-bubble-with-background{
          background:#1c2b21 !important;
          box-shadow:inset -4px 0 0 #22c55e !important;
        }
        model-response .response-container.no-background{
          background:#152235 !important;
          border-color:#26466f !important;
          box-shadow:inset 4px 0 0 #60a5fa !important;
        }
      }
    `);
  }

  function isConversationMenuOpen() {
    const menu = document.getElementById(ACTIONS_MENU_ID);
    return menu?.getAttribute('data-open') === 'true';
  }

  function toggleConversationMenu(forceOpen) {
    const menu = document.getElementById(ACTIONS_MENU_ID);
    const toggleButton = document.getElementById(MENU_TOGGLE_BUTTON_ID);
    if (!menu || !toggleButton) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isConversationMenuOpen();
    menu.setAttribute('data-open', shouldOpen ? 'true' : 'false');
    toggleButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
      const rect = toggleButton.getBoundingClientRect();
      menu.style.left = `${Math.round(rect.left)}px`;
      menu.style.top = `${Math.round(rect.bottom + 8)}px`;
    }
  }

  function flashActionButton(buttonId, text) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.textContent = text;
    setTimeout(() => {
      const current = document.getElementById(buttonId);
      if (current) current.textContent = current.dataset.defaultText || '';
    }, 1500);
  }

  async function copyConversation() {
    const payload = buildConversationExport();
    if (!payload) {
      flashActionButton(COPY_BUTTON_ID, '🤔');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.transcript);
      } else if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(payload.transcript, { type: 'text', mimetype: 'text/plain' });
      } else {
        throw new Error('Clipboard API is not available');
      }
      flashActionButton(COPY_BUTTON_ID, '✔️');
    } catch (error) {
      console.log('[Gemini] Copy failed:', error);
      flashActionButton(COPY_BUTTON_ID, '❌');
    }
  }

  function saveConversationToFile() {
    const payload = buildConversationExport();
    if (!payload) {
      flashActionButton(SAVE_BUTTON_ID, '🤔');
      return;
    }
    try {
      downloadTextFile(payload.fileText, payload.fileName);
      flashActionButton(SAVE_BUTTON_ID, '✔️');
    } catch (error) {
      console.log('[Gemini] Save failed:', error);
      flashActionButton(SAVE_BUTTON_ID, '❌');
    }
  }

  function ensureActionButtons() {
    if (!settings.copyConversationButton) return;

    const titleContainer = document.querySelector('.conversation-title-container, top-bar-actions .center-section');
    if (!titleContainer) return;

    let container = document.getElementById(ACTIONS_CONTAINER_ID);
    if (!container) {
      container = document.createElement('span');
      container.id = ACTIONS_CONTAINER_ID;
    }

    if (!titleContainer.contains(container)) {
      titleContainer.appendChild(container);
    }

    const ensureButton = (id, text, title, handler) => {
      let button = document.getElementById(id);
      if (!button) {
        button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.dataset.defaultText = text;
        button.title = title;
        button.textContent = text;
        button.addEventListener('click', handler);
      }
      if (!container.contains(button)) container.appendChild(button);
      return button;
    };

    ensureButton(COPY_BUTTON_ID, '📋', 'העתק את כל השיחה', (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyConversation();
    });

    const toggleButton = ensureButton(MENU_TOGGLE_BUTTON_ID, '▼', 'אפשרויות נוספות', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleConversationMenu();
    });
    toggleButton.setAttribute('aria-expanded', isConversationMenuOpen() ? 'true' : 'false');

    let menu = document.getElementById(ACTIONS_MENU_ID);
    if (!menu) {
      menu = document.createElement('div');
      menu.id = ACTIONS_MENU_ID;
      menu.setAttribute('data-open', 'false');
      document.body.appendChild(menu);
    } else if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }

    let saveButton = document.getElementById(SAVE_BUTTON_ID);
    if (!saveButton) {
      saveButton = document.createElement('button');
      saveButton.id = SAVE_BUTTON_ID;
      saveButton.type = 'button';
      saveButton.dataset.defaultText = '💾 שמור לקובץ';
      saveButton.textContent = saveButton.dataset.defaultText;
      saveButton.title = 'שמור את כל השיחה לקובץ';
      saveButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleConversationMenu(false);
        saveConversationToFile();
      });
      menu.appendChild(saveButton);
    } else if (!menu.contains(saveButton)) {
      menu.appendChild(saveButton);
    }
  }

  function buildSidebarColumns(total) {
    const perColumn = 28;
    const columns = [];
    for (let start = 0; start < total; start += perColumn) {
      columns.push({
        start,
        end: Math.min(start + perColumn, total)
      });
    }
    return columns;
  }

  function updateActiveMessage(index) {
    currentMessageIndex = index;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    sidebar.querySelectorAll('.gemini-sidebar-dot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.messageIndex) === index);
    });
  }

  function scrollToMessage(index) {
    const target = messages[index]?.element;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateActiveMessage(index);
  }

  function renderSidebar() {
    if (!settings.sidebar) return;

    messages = collectConversationTurns().map(({ role, element }) => ({ role, element }));
    let sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = SIDEBAR_ID;
      document.body.appendChild(sidebar);
    }

    const inputRect = getInputRect();
    const height = Math.max(140, inputRect.top - 106);
    sidebar.style.height = `${height}px`;
    sidebar.classList.toggle('is-hidden', messages.length < 2);

    const columns = buildSidebarColumns(messages.length);
    sidebar.replaceChildren();

    columns.forEach((columnMeta) => {
      const column = document.createElement('div');
      column.className = 'gemini-sidebar-column';
      column.style.height = `${height}px`;

      const slice = messages.slice(columnMeta.start, columnMeta.end);
      slice.forEach((message, localIndex) => {
        const index = columnMeta.start + localIndex;
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `gemini-sidebar-dot ${message.role}`;
        dot.dataset.messageIndex = String(index);
        const ratio = slice.length === 1 ? 0.5 : localIndex / (slice.length - 1);
        dot.style.top = `${Math.max(10, Math.min(height - 10, ratio * height))}px`;
        dot.title = message.role === 'user' ? `הודעת משתמש ${index + 1}` : `תגובת Gemini ${index + 1}`;
        dot.addEventListener('click', () => scrollToMessage(index));
        column.appendChild(dot);
      });

      sidebar.appendChild(column);
    });

    updateSidebarActiveState();
  }

  function updateSidebarActiveState() {
    if (!messages.length) {
      updateActiveMessage(-1);
      return;
    }

    const viewportMiddle = window.innerHeight * 0.38;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    messages.forEach((message, index) => {
      const rect = message.element.getBoundingClientRect();
      const distance = Math.abs(rect.top - viewportMiddle);
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      const adjustedDistance = isVisible ? distance : distance + 5000;
      if (adjustedDistance < bestDistance) {
        bestDistance = adjustedDistance;
        bestIndex = index;
      }
    });

    updateActiveMessage(bestIndex);
  }

  function handleNotifications() {
    if (!settings.aiMessageNotifications) return;

    const assistantTurns = collectConversationTurns().filter((turn) => turn.role === 'assistant');
    const lastAssistant = assistantTurns.at(-1);
    if (!lastAssistant) return;

    const signature = `${assistantTurns.length}:${lastAssistant.text}`;
    if (!notificationInitialized) {
      lastAssistantSignature = signature;
      notificationInitialized = true;
      return;
    }

    if (signature === lastAssistantSignature) return;
    lastAssistantSignature = signature;

    const previewWords = lastAssistant.text.split(/\s+/).slice(0, 12).join(' ');
    playNotificationSound(previewWords || 'Gemini סיים להשיב');
  }

  const debouncedRefresh = debounce(() => {
    ensureActionButtons();
    renderSidebar();
    handleNotifications();
  }, 250);

  function initializeObservers() {
    const observer = new MutationObserver(debouncedRefresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    window.addEventListener('scroll', debounce(updateSidebarActiveState, 50), true);
    window.addEventListener('resize', debouncedRefresh);

    document.addEventListener('click', (event) => {
      const container = document.getElementById(ACTIONS_CONTAINER_ID);
      if (!container || container.contains(event.target)) return;
      toggleConversationMenu(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') toggleConversationMenu(false);
    });
  }

  injectBaseStyles();
  injectRtlStyles();
  injectBubbleStyles();
  ensureActionButtons();
  renderSidebar();
  handleNotifications();
  initializeObservers();
})();
