// ==UserScript==
// @name         AI Studio – משופר
// @namespace    https://example.com/
// @version      1.6.0
// @description  פותח היסטוריה אוטומטית, סרגל-צד משופר, תיקוני RTL, בועות צבע, הפעלה אוטומטית של כלים ב”שיחה חדשה”, ושמירה אוטומטית של השיחה והתראות קוליות וחזותיות על הודעות AI חדשות.
// @author       Y-PLONI
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/Y-PLONI/Improving-AI-sites/raw/main/aistudio-Enhancer.user.js
// ==/UserScript==

(() => {
  'use strict';

  /*──────────────────────────────────
    0. ניהול הגדרות ותפריט
  ──────────────────────────────────*/
  const DEFAULTS = { openHistoryOnLoad: true, sidebar: true, rtl: true, bubbles: true, codeExecution: true, grounding: true, autoSave: true, aiMessageNotifications: true };
  const SETTINGS_KEY = 'aisEnhancerSettings';
  const settings = Object.assign({}, DEFAULTS, GM_getValue(SETTINGS_KEY, {}));

  function saveAndReload() { GM_setValue(SETTINGS_KEY, settings); location.reload(); }
  GM_registerMenuCommand('⚙️ הגדרות כלי עזר וסרגל צד', openSettings);

  function playNotificationSound(notificationBody = 'הודעה חדשה מה-AI') {
    // מנגנון צינון: אם הושמע צליל ב-2 השניות האחרונות, אל תפעיל שוב
    if (playNotificationSound.lastPlayed && Date.now() - playNotificationSound.lastPlayed < 2000) {
        console.log('[AI Studio] התראה נמנעה (ריצה מהירה מדי).');
        return;
    }
    playNotificationSound.lastPlayed = Date.now(); // עדכן את זמן ההפעלה האחרון

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) { console.log('[AI Studio] Failed to play notification sound:', error); }

    if ('Notification' in window && document.visibilityState === 'hidden') {
      if (Notification.permission === 'granted') {
        new Notification('AI Studio', { body: notificationBody, icon: 'https://aistudio.google.com/favicon.ico', tag: 'ai-studio-notification' });
      }
    }
  }

  function openSettings() {
    if (document.getElementById('ais-enhancer-settings')) return;
    const overlay = document.createElement('div'); overlay.id = 'ais-enhancer-settings'; overlay.style.cssText = `position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;`; document.body.appendChild(overlay);
    const panel = document.createElement('div'); panel.style.cssText = `background:#fff;color:#000;padding:18px 24px;border-radius:8px;min-width:300px;font:14px/1.4 sans-serif;direction:rtl;text-align:right;box-shadow:0 4px 14px rgba(0,0,0,.3);`; overlay.appendChild(panel);
    const title = document.createElement('h3'); title.textContent = 'הגדרות כלי עזר'; title.style.marginTop = '0'; panel.appendChild(title);
    const addCheckbox = (key, label) => {
        const row = document.createElement('label'); Object.assign(row.style, { display:'flex',alignItems:'center',gap:'6px',margin:'6px 0' });
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = settings[key]; cb.addEventListener('change', () => { settings[key] = cb.checked; });
        const span = document.createElement('span'); span.textContent = label;
        row.append(cb, span); panel.appendChild(row);
    };
    addCheckbox('openHistoryOnLoad', 'פתח היסטוריה בהפעלה ראשונה'); addCheckbox('sidebar', 'הצג סרגל צד משופר'); addCheckbox('rtl', 'תקן RTL'); addCheckbox('bubbles', 'בועות צבע'); addCheckbox('autoSave', 'שמירה אוטומטית כל 5 שניות'); addCheckbox('aiMessageNotifications', 'התראות קוליות וחזותיות על הודעות AI חדשות');

    const notifTitle = document.createElement('h4'); notifTitle.textContent = 'התראות'; notifTitle.style.margin = '12px 0 4px'; panel.appendChild(notifTitle);
    const notifBtn = document.createElement('button');
    function updateNotifBtn() {
      if (!('Notification' in window)) { notifBtn.textContent = 'התראות אינן נתמכות בדפדפן זה'; notifBtn.disabled = true; return; }
      if (Notification.permission === 'granted') { notifBtn.textContent = '✅ התראות שולחן עבודה מאושרות'; notifBtn.disabled = true; }
      else if (Notification.permission === 'denied') { notifBtn.textContent = '❌ התראות שולחן עבודה נחסמו'; notifBtn.disabled = true; }
      else { notifBtn.textContent = 'לחץ לאישור התראות שולחן עבודה'; notifBtn.disabled = false; }
    }
    updateNotifBtn(); notifBtn.addEventListener('click', () => { Notification.requestPermission().then(updateNotifBtn); }); panel.appendChild(notifBtn);

    const groupTitle = document.createElement('h4'); groupTitle.textContent = 'בשיחה חדשה'; groupTitle.style.margin = '12px 0 4px'; panel.appendChild(groupTitle);
    addCheckbox('codeExecution', 'הפעל את Code execution'); addCheckbox('grounding', 'הפעל את Grounding with Google Search');
    const saveBtn = document.createElement('button'); saveBtn.textContent = 'שמור והטען מחדש'; saveBtn.style.cssText = 'margin-top:12px;padding:6px 14px;border-radius:4px;cursor:pointer;border:1px solid #888;background:#f0f0f0;'; saveBtn.addEventListener('click', saveAndReload); panel.appendChild(saveBtn);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) overlay.remove(); });
  }

  /*──────────────────────────────────
    1. סרגל-צד משופר והתראות
  ──────────────────────────────────*/
  if (settings.sidebar) {
    (() => {
        'use strict';
        const DEBUG = false; const debugLog = DEBUG ? (...args) => console.log('[AI Studio Sidebar]', ...args) : () => {};
        const TOP_OFFSET_PX = 60;
        const SIDEBAR_ID = 'ais-progress-sidebar', DOT_CLASS = 'ais-progress-dot', OBS_DEBOUNCE = 300, INIT_DELAY = 2000, COLOR_USER = '#4CAF50', COLOR_ASSIST = '#2196F3', MAX_DOTS_PER_SIDEBAR = 30, SIDEBAR_SPACING_PX = 6, SIDEBAR_VISUAL_WIDTH_PX = 30, INPUT_TOP_MARGIN_PX = 35;
        let messages = [], currentMessageIndex = -1, chatContainer = null, sidebarContainer = null, intersectionObserver = null, mutationObserver = null, resizeObserver = null, inputResizeObserver = null, isInitialized = false, notifiedModelTurnCount = 0, lastNotifiedErrorElement = null;

        function playNotificationSound(notificationBody = 'הודעה חדשה מה-AI') {
            if (playNotificationSound.lastPlayed && Date.now() - playNotificationSound.lastPlayed < 2000) { console.log('[AI Studio] התראה נמנעה (ריצה מהירה מדי).'); return; }
            playNotificationSound.lastPlayed = Date.now();
            try { const audioContext = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = audioContext.createOscillator(); const gainNode = audioContext.createGain(); oscillator.connect(gainNode); gainNode.connect(audio-context.destination); oscillator.frequency.setValueAtTime(800, audioContext.currentTime); oscillator.type = 'sine'; gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.5); } catch (error) { console.log('[AI Studio] Failed to play notification sound:', error); }
            if ('Notification' in window && document.visibilityState === 'hidden' && Notification.permission === 'granted') { new Notification('AI Studio', { body: notificationBody, icon: 'https://aistudio.google.com/favicon.ico', tag: 'ai-studio-notification' }); }
        }

        function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
        function createElement(tag, className = '', attributes = {}) { const element = document.createElement(tag); if (className) element.className = className; Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value)); return element; }
        function isThinkingMessage(turn) { return turn.querySelector('ms-thought-chunk') !== null || turn.querySelector('.thought-panel') !== null; }
        function isFileUploadMessage(turn) { return turn.querySelector('ms-user-file-upload') !== null; }
        function getInputAreaInfo() { const inputArea = document.querySelector('ms-user-input, textarea, input[type="text"]'); if (inputArea) { const rect = inputArea.getBoundingClientRect(); return { top: rect.top, height: rect.height }; } return { top: window.innerHeight - 90, height: 50 }; }
        function injectStyles() { if (document.getElementById('ai-studio-sidebar-styles')) return; const style = createElement('style', '', { id: 'ai-studio-sidebar-styles' }); style.textContent = ` #${SIDEBAR_ID}{position:absolute !important; top:${TOP_OFFSET_PX}px !important; z-index:10000 !important; display:flex !important; flex-direction:row !important; align-items:stretch !important; pointer-events:none !important; transition:left .3s ease-out,width .3s ease-out,bottom .3s ease-out,opacity .3s ease-out,transform .3s ease-out !important; opacity:0 !important;} #${SIDEBAR_ID}.visible{opacity:1 !important;} #${SIDEBAR_ID} .ais-sidebar-instance{display:flex !important; flex-direction:column !important; width:${SIDEBAR_VISUAL_WIDTH_PX}px !important; margin-right:${SIDEBAR_SPACING_PX}px !important; position:relative !important; height:100% !important;} #${SIDEBAR_ID} .ais-sidebar-instance::before{content:''; position:absolute; left:50%; top:0; width:4px; height:100%; background:#b0b0b0; border-radius:2px; transform:translateX(-50%); z-index:-1;} #${SIDEBAR_ID} .${DOT_CLASS}{width:10px !important; height:10px !important; border-radius:50% !important; cursor:pointer !important; pointer-events:all !important; transition:transform .2s,box-shadow .2s !important; position:absolute !important; z-index:1 !important; left:50% !important; transform:translateX(-50%) !important;} #${SIDEBAR_ID} .${DOT_CLASS}.user{background-color:${COLOR_USER} !important;} #${SIDEBAR_ID} .${DOT_CLASS}.model{background-color:${COLOR_ASSIST} !important;} #${SIDEBAR_ID} .${DOT_CLASS}.active{transform:translateX(-50%) scale(1.4) !important; box-shadow:0 0 10px rgba(0,0,0,.4) !important;} #${SIDEBAR_ID} .${DOT_CLASS}:hover{transform:translateX(-50%) scale(1.3) !important;} #${SIDEBAR_ID}.shrunk .ais-sidebar-instance{transform:scale(.8) !important; opacity:.7 !important;} #${SIDEBAR_ID}.extra-shrunk .ais-sidebar-instance{transform:scale(.6) !important; opacity:.5 !important;} #${SIDEBAR_ID} .${DOT_CLASS} span { position:absolute !important; left:14px !important; top:50% !important; transform:translateY(-50%) !important; font-size:11px !important; color:rgba(0,0,0,0.4) !important; background-color:transparent !important; padding:1px 3px !important; border-radius:2px !important; pointer-events:none !important; } #${SIDEBAR_ID}.multi-column .ais-sidebar-instance:first-child { margin-right: 0px !important; } #${SIDEBAR_ID}.multi-column .ais-sidebar-instance:nth-child(2) { margin-left: -12px !important; } #${SIDEBAR_ID}.multi-column .ais-sidebar-instance:first-child .${DOT_CLASS} span { left: auto !important; right: 14px !important; text-align: right; } `; document.head.appendChild(style); }
        function createSidebar() { if (document.getElementById(SIDEBAR_ID)) return document.getElementById(SIDEBAR_ID); sidebarContainer = createElement('div', '', { id: SIDEBAR_ID }); const mainElement = document.querySelector('main') || document.body; mainElement.appendChild(sidebarContainer); return sidebarContainer; }
        function findChatElements() { chatContainer = document.querySelector('ms-autoscroll-container') || document.querySelector('ms-chat-session'); const messageElements = Array.from(document.querySelectorAll('ms-chat-turn')); if (messageElements.length === 0) { if (messages.length > 0) { messages = []; return true; } return false; } const filteredElements = messageElements.filter(el => !isThinkingMessage(el) && !isFileUploadMessage(el)); const newMessages = filteredElements.map((element, index) => { let role = 'unknown'; const turnContainerDiv = element.querySelector('div.chat-turn-container'); if (turnContainerDiv) { if (turnContainerDiv.classList.contains('user')) role = 'user'; else role = 'model'; } if (role === 'unknown') role = index % 2 === 0 ? 'user' : 'model'; return { element, role, index, id: `sidebar-msg-${Date.now()}-${index}` }; }); if (newMessages.length !== messages.length || newMessages.some((msg, i) => !messages[i] || messages[i].element !== msg.element)) { messages = newMessages; return true; } return false; }
        function renderDots() { if (!sidebarContainer) return; while (sidebarContainer.firstChild) sidebarContainer.removeChild(sidebarContainer.firstChild); if (messages.length === 0) { sidebarContainer.classList.remove('visible'); return; } const numSidebars = Math.ceil(messages.length / MAX_DOTS_PER_SIDEBAR); sidebarContainer.classList.toggle('multi-column', numSidebars > 1); const dotsPerSidebarActual = Math.ceil(messages.length / numSidebars); for (let s = 0; s < numSidebars; s++) { const sidebarInstance = createElement('div', 'ais-sidebar-instance', { id: `${SIDEBAR_ID}-${s}` }); const startIndex = s * dotsPerSidebarActual, endIndex = Math.min(startIndex + dotsPerSidebarActual, messages.length), numMessagesInSidebar = endIndex - startIndex; for (let i = startIndex; i < endIndex; i++) { const messageData = messages[i], localIndex = i - startIndex, dot = createElement('div', `${DOT_CLASS} ${messageData.role}`, { 'data-message-index': i.toString(), title: `הודעה ${i + 1} (${messageData.role === 'user' ? 'משתמש' : 'מודל'})` }); const numberSpan = document.createElement('span'); numberSpan.textContent = (i + 1).toString(); dot.appendChild(numberSpan); dot.addEventListener('click', (e) => { e.stopPropagation(); scrollToMessage(i); }); let topPercentage = (numMessagesInSidebar <= 1) ? 50 : 1 + (localIndex / (numMessagesInSidebar - 1)) * 98; dot.style.top = `${topPercentage}%`; sidebarInstance.appendChild(dot); } sidebarContainer.appendChild(sidebarInstance); } updateSidebarPosition(); sidebarContainer.classList.add('visible'); if (intersectionObserver) intersectionObserver.disconnect(); setupIntersectionObserver(); }
        
        // --- שינוי 1: מיקום הסרגל ---
        function updateSidebarPosition() {
            if (!sidebarContainer) return;
            const referenceElement = document.querySelector('ms-chat-turn') || (messages.length > 0 ? messages[0].element : null);
            const numSidebars = sidebarContainer.children.length;
            const inputAreaInfo = getInputAreaInfo(), inputTop = inputAreaInfo.top, inputHeight = inputAreaInfo.height;
            if (referenceElement) {
                const rect = referenceElement.getBoundingClientRect();
                // ערך מתון יותר שמזיז ימינה, אבל לא יותר מדי
                const baseLeft = Math.max(rect.left + 15 - (numSidebars * (SIDEBAR_VISUAL_WIDTH_PX + SIDEBAR_SPACING_PX)), 8);
                sidebarContainer.style.left = `${baseLeft}px`;
                sidebarContainer.style.width = `${numSidebars * (SIDEBAR_VISUAL_WIDTH_PX + SIDEBAR_SPACING_PX)}px`;
            } else { sidebarContainer.style.left = '12px'; sidebarContainer.style.width = `${numSidebars * (SIDEBAR_VISUAL_WIDTH_PX + SIDEBAR_SPACING_PX)}px`; }
            sidebarContainer.style.bottom = `${window.innerHeight - inputTop + INPUT_TOP_MARGIN_PX}px`;
            sidebarContainer.classList.toggle('shrunk', inputHeight > 100 && inputHeight <= 200);
            sidebarContainer.classList.toggle('extra-shrunk', inputHeight > 200);
        }

        function scrollToMessage(index) { if (index < 0 || index >= messages.length) return; messages[index]?.element?.scrollIntoView({ behavior: 'smooth', block: 'start' }); updateActiveMessage(index); }
        function updateActiveMessage(index) { if (!sidebarContainer || currentMessageIndex === index) return; currentMessageIndex = index; sidebarContainer.querySelectorAll(`.${DOT_CLASS}`).forEach(dot => dot.classList.remove('active')); if (index >= 0) { const activeDot = sidebarContainer.querySelector(`.${DOT_CLASS}[data-message-index="${index}"]`); if (activeDot) activeDot.classList.add('active'); } }
        function setupIntersectionObserver() { if (intersectionObserver) intersectionObserver.disconnect(); if (!chatContainer || messages.length === 0) { updateActiveMessage(-1); return; } intersectionObserver = new IntersectionObserver((entries) => { let mostCenteredEntry = null, highestVisibility = 0; entries.forEach(entry => { if (entry.isIntersecting && entry.intersectionRatio > highestVisibility) { highestVisibility = entry.intersectionRatio; mostCenteredEntry = entry; } }); if (mostCenteredEntry) { const messageIndex = messages.findIndex(msg => msg.element === mostCenteredEntry.target); if (messageIndex !== -1) updateActiveMessage(messageIndex); } }, { root: chatContainer, rootMargin: '-40% 0px -40% 0px', threshold: 0.01 }); messages.forEach(msg => { if (msg.element) intersectionObserver.observe(msg.element); }); }
        function setupResizeObserver() { if (resizeObserver) return; const debouncedResize = debounce(() => { updateSidebarPosition(); if (chatContainer) setupIntersectionObserver(); }, 200); resizeObserver = new ResizeObserver(debouncedResize); resizeObserver.observe(document.body); window.addEventListener('resize', debouncedResize); }
        function setupInputResizeObserver() { if (inputResizeObserver) return; const inputArea = document.querySelector('ms-user-input, textarea, input[type="text"]'); if (!inputArea) { setTimeout(setupInputResizeObserver, 1000); return; } inputResizeObserver = new ResizeObserver(debounce(updateSidebarPosition, 100)); inputResizeObserver.observe(inputArea); }

        // --- שינוי 2: תיקון הצפצוף הכפול וניקוי הטקסט ---
        function handleNotifications() {
            if (!settings.aiMessageNotifications) return;
            const modelTurnsWithContent = Array.from(document.querySelectorAll('ms-chat-turn .chat-turn-container:not(.user)'))
                .filter(turn => turn.textContent.trim().length > 0);
            debugLog('AI Model Turns Found:', modelTurnsWithContent.length, 'Previously Notified:', notifiedModelTurnCount);
            if (modelTurnsWithContent.length === 0) return;
            const lastTurn = modelTurnsWithContent[modelTurnsWithContent.length - 1];
            
            // יצירת גרסה נקייה של הטקסט ללא מילות המפתח
            const cleanedText = lastTurn.textContent.trim().replace(/editmore_vert|more_vert/gi, '').trim();

            if (cleanedText.length === 0) {
                 debugLog('Message is empty after cleaning, ignoring.');
                 return; // אם אחרי הניקוי לא נשאר טקסט, זו הודעת "פייק"
            }

            if (cleanedText.includes("An internal error has occurred")) { if (lastTurn !== lastNotifiedErrorElement) { debugLog('Error detected'); playNotificationSound("אופס, אירעה שגיאה פנימית... 😥"); lastNotifiedErrorElement = lastTurn; } return; }
            if (modelTurnsWithContent.length > notifiedModelTurnCount) {
                debugLog('New AI message detected');
                const words = cleanedText.split(/\s+/);
                const preview = words.slice(0, 10).join(' ') + (words.length > 10 ? '...' : '');
                playNotificationSound(preview);
                notifiedModelTurnCount = modelTurnsWithContent.length;
                lastNotifiedErrorElement = null;
            }
        }
        
        const debouncedRebuildAndNotify = debounce(() => { if (findChatElements()) renderDots(); handleNotifications(); }, 400);
        function initialize() { if (isInitialized) return; isInitialized = true; injectStyles(); sidebarContainer = createSidebar(); if (findChatElements()) renderDots(); notifiedModelTurnCount = Array.from(document.querySelectorAll('ms-chat-turn .chat-turn-container:not(.user)')).filter(turn => turn.textContent.trim().length > 0).length; updateSidebarPosition(); setupResizeObserver(); setupInputResizeObserver(); mutationObserver = new MutationObserver(debouncedRebuildAndNotify); mutationObserver.observe(document.querySelector('ms-chat-session') || document.body, { childList: true, subtree: true, characterData: true }); debugLog('Sidebar & New Notification Logic Initialized.'); }
        setTimeout(initialize, INIT_DELAY);
    })();
  }

  /*──────────────────────────────────
    2. RTL Fixes
  ──────────────────────────────────*/
  if (settings.rtl) {
    (() => {
      'use strict';
      const fixStyle = `.chat-turn-container.render, .chat-turn-container.render *{direction:rtl !important;text-align:right !important;}.chat-turn-container.render p, .chat-turn-container.render span, .chat-turn-container.render div{unicode-bidi:isolate !important;}.prose .text-token-streaming{direction:rtl !important;text-align:right !important;}button[class*="grounding"]{direction:rtl !important;text-align:right !important;unicode-bidi:plaintext !important;}button[class*="grounding"] svg{float:left !important;margin-left:0 !important;margin-right:8px !important;}.chat-turn-container.render pre, .chat-turn-container.render pre *, .chat-turn-container.render code, .chat-turn-container.render div[class*="code"], .chat-turn-container.render div[class*="code"] *{direction:ltr !important;text-align:left !important;unicode-bidi:plaintext !important;};`;
      (typeof GM_addStyle==='function')?GM_addStyle(fixStyle):(()=>{const s=document.createElement('style');s.textContent=fixStyle;document.head.appendChild(s);})();
    })();
  }

  /*──────────────────────────────────
    3. בועות צבע
  ──────────────────────────────────*/
  if (settings.bubbles) {
    (() => {
      'use strict';
      const css = `
        :root{--cgpt-user-bubble-bg:#F4FFF7;--cgpt-user-bubble-bg-rgb:244,255,247;--cgpt-user-bubble-text:inherit;--cgpt-user-stripe:#A5D6A7;--cgpt-ai-bubble-bg:#E3F2FD;--cgpt-ai-bubble-bg-rgb:227,242,253;--cgpt-ai-bubble-text:inherit;--cgpt-ai-border:#BBDEFB;--cgpt-ai-stripe:#64B5F6}
        @media (prefers-color-scheme:dark){:root{--cgpt-user-bubble-bg:#3A3F47;--cgpt-user-bubble-bg-rgb-dark:58,63,71;--cgpt-user-bubble-text:#E0E0E0;--cgpt-user-stripe:#508D50;--cgpt-ai-bubble-bg:#2C3035;--cgpt-ai-bubble-bg-rgb-dark:44,48,53;--cgpt-ai-bubble-text:#E0E0E0;--cgpt-ai-border:#454A50;--cgpt-ai-stripe:#4A7ABE}}
        .chat-turn-container.render{box-sizing:border-box !important;max-width:100% !important;overflow-wrap:anywhere;margin:8px 0;border-radius:10px;padding:14px 18px !important;position:relative !important;}
        .chat-turn-container.render.user{background:var(--cgpt-user-bubble-bg) !important;color:var(--cgpt-user-bubble-text) !important;box-shadow:inset -4px 0 0 0 var(--cgpt-user-stripe)}
        .chat-turn-container.render.user *{background-color:transparent !important;}
        .chat-turn-container.render:not(.user){background:var(--cgpt-ai-bubble-bg) !important;color:var(--cgpt-ai-bubble-text) !important;border:1px solid var(--cgpt-ai-border) !important;box-shadow:inset 4px 0 0 0 var(--cgpt-ai-stripe)}
        html,body{overflow-x:hidden !important;}
        .chat-turn-container.render .actions.hover-or-edit{position:absolute !important;right:8px !important;top:-28px !important;padding:2px 6px !important;border-radius:6px !important;z-index:20 !important;box-shadow:0 1px 4px rgba(0,0,0,.25) !important;backdrop-filter:saturate(180%) blur(4px) !important;}
        .chat-turn-container.render.user .actions.hover-or-edit{background:rgba(var(--cgpt-user-bubble-bg-rgb),0.85) !important;}
        .chat-turn-container.render:not(.user) .actions.hover-or-edit{background:rgba(var(--cgpt-ai-bubble-bg-rgb),0.85) !important;}
        @media (prefers-color-scheme:dark){.chat-turn-container.render .actions.hover-or-edit{box-shadow:0 1px 4px rgba(0,0,0,.6) !important;}.chat-turn-container.render.user .actions.hover-or-edit{background:rgba(var(--cgpt-user-bubble-bg-rgb-dark),0.8) !important;}.chat-turn-container.render:not(.user) .actions.hover-or-edit{background:rgba(var(--cgpt-ai-bubble-bg-rgb-dark),0.8) !important;}}
      `;
      (typeof GM_addStyle==='function')?GM_addStyle(css):(()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);})();
    })();
  }

  /*──────────────────────────────────
    4. הפעלת כלים אוטומטית ב־“שיחה חדשה”
  ──────────────────────────────────*/
  (() => {
    const TOOLS_MAP = { codeExecution: 'Code execution', grounding: 'Grounding with Google Search' };
    const activeTools = []; if (settings.codeExecution) activeTools.push(TOOLS_MAP.codeExecution); if (settings.grounding) activeTools.push(TOOLS_MAP.grounding); if (activeTools.length === 0) return;
    function ensureSwitchesAreOn() {
      if (!window.location.pathname.includes('/new_chat')) return;
      activeTools.forEach(label => {
        const btn = document.querySelector(`button[role="switch"][aria-label="${label}"]`);
        if (btn && btn.getAttribute('aria-checked') !== 'true') { console.log('[AI Studio] מפעיל מתג חסר:', label); btn.click(); }
      });
    }
    const observer = new MutationObserver(ensureSwitchesAreOn); observer.observe(document.body, { childList:true, subtree:true }); ensureSwitchesAreOn();
  })();

  /*──────────────────────────────────
    5. פתיחת היסטוריה בטעינה ראשונה
  ──────────────────────────────────*/
  if (settings.openHistoryOnLoad) {
    (() => {
        'use strict';
        let hasRun = false;
        const observer = new MutationObserver(() => {
            if (hasRun) { observer.disconnect(); return; }
            const collapsedButton = document.querySelector('ms-prompt-history button.expand-button:not(.expanded)');
            if (collapsedButton) {
                console.log('[AI Studio] רשימת ההיסטוריה סגורה. מבצע לחיצה לפתיחה...');
                setTimeout(() => { collapsedButton.click(); console.log('[AI Studio] הלחיצה בוצעה.'); }, 100);
                hasRun = true; observer.disconnect();
            }
        });
        console.log('[AI Studio] מאזין... מחפש את כפתור ההיסטוריה במצב סגור.');
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            if (!hasRun) { console.log('[AI Studio] לא נמצא כפתור היסטוריה סגור לאחר 5 שניות. כנראה שהיא כבר פתוחה.'); observer.disconnect(); }
            hasRun = true;
        }, 5000);
    })();
  }

  /*──────────────────────────────────
    6. שמירה אוטומטית (Auto-Save)
  ──────────────────────────────────*/
  if (settings.autoSave) {
    (() => {
      const SAVE_INTERVAL_MS = 5000;
      function triggerDirectSave() {
        if (document.querySelector('.mat-mdc-dialog-container')) return;
        const saveButton = document.querySelector('button[aria-label="Save prompt"]:not([disabled])');
        if (saveButton) saveButton.click();
      }
      setInterval(triggerDirectSave, SAVE_INTERVAL_MS);
    })();
  }

})();
