// ==UserScript==
// @name         AI Studio – משופר
// @namespace    https://example.com/
// @version      1.9.8
// @description  פותח היסטוריה אוטומטית, סרגל-צד משופר, תיקוני RTL, בועות צבע, הפעלה אוטומטית של כלים ב”שיחה חדשה”, שמירה לקובץ, שמירה אוטומטית של השיחה והתראות קוליות וחזותיות על הודעות AI חדשות.
// @author       Y-PLONI
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/Y-PLONI/Improving-AI-sites/raw/main/aistudio-Enhancer.user.js
// @updateURL  https://github.com/Y-PLONI/Improving-AI-sites/raw/main/aistudio-Enhancer.user.js
// ==/UserScript==

(() => {
  'use strict';

  /*──────────────────────────────────
    0. ניהול הגדרות ותפריט
  ──────────────────────────────────*/
  const DEFAULTS = { openHistoryOnLoad: true, sidebar: true, rtl: true, bubbles: true, codeExecution: true, grounding: true, autoSave: true, aiMessageNotifications: true, copyConversationButton: true, githubSyncButton: true };
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
    addCheckbox('openHistoryOnLoad', 'פתח היסטוריה בהפעלה ראשונה'); addCheckbox('sidebar', 'הצג סרגל צד משופר'); addCheckbox('rtl', 'תקן RTL'); addCheckbox('bubbles', 'בועות צבע'); addCheckbox('autoSave', 'שמירה אוטומטית כל 5 שניות'); addCheckbox('aiMessageNotifications', 'התראות קוליות וחזותיות על הודעות AI חדשות'); addCheckbox('copyConversationButton', 'הצג כפתורי "העתק שיחה" ו"שמור לקובץ"'); addCheckbox('githubSyncButton', 'הצג כפתור סנכרון אוטומטי ל-GitHub');

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
      const fixStyle = `
        /* הגדרת RTL ותיקון נקודות וסימני פיסוק - רק לבלוקים הראשיים */
        .bubble p, 
        .bubble div:not([class*="code"]):not(ms-code-block), 
        .bubble li,
        .bubble h1, .bubble h2, .bubble h3, .bubble h4, .bubble h5, .bubble h6,
        .prose .text-token-streaming {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: plaintext !important;
        }

        /* התיקון הקריטי: שחרור האלמנטים הפנימיים כדי שלא ישברו את רצף המשפט (טקסט מודגש/נטוי) */
        .bubble span:not(.inline-code):not([class*="code"]),
        .bubble strong,
        .bubble em,
        .bubble b,
        .bubble i,
        ms-cmark-node {
            unicode-bidi: normal !important;
        }

        /* תיקון ספציפי לרשימות (נקודות ומספרים) */
        .bubble ul, 
        .bubble ol {
            direction: rtl !important;
            text-align: right !important;
            padding-right: 1.5em !important;
            padding-left: 0 !important;
        }

        /* כפתורי חיפוש/מקורות */
        button[class*="grounding"] {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: plaintext !important;
        }
        button[class*="grounding"] svg {
            float: left !important;
            margin-left: 0 !important;
            margin-right: 8px !important;
        }

        /* שמירה על LTR (משמאל לימין) עבור בלוקים של קוד וטקסט בתוך שורת קוד */
        .bubble pre, 
        .bubble pre *, 
        .bubble code, 
        .bubble code *,
        ms-code-block,
        ms-code-block *,
        .inline-code {
            direction: ltr !important;
            text-align: left !important;
            unicode-bidi: isolate !important;
        }
        /* ====== תיקון עבור תיבת ההקלדה (Input Textarea) ====== */
        .input-container textarea,
        textarea.cdk-textarea-autosize,
        ms-user-input textarea {
            direction: rtl !important;
            text-align: right !important;
            unicode-bidi: plaintext !important;
        }
        
        /* סידור ה-Placeholder (הטקסט הרך לפני שמתחילים להקליד) */
        .input-container textarea::placeholder {
            text-align: right !important;
            direction: rtl !important;
        }
      `;
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

  /*──────────────────────────────────
    7. כפתורי העתקה ושמירה
  ──────────────────────────────────*/
  if (settings.copyConversationButton) {
    (() => {
      'use strict';
      const ACTIONS_CONTAINER_ID = 'ais-conversation-actions';
      const COPY_BUTTON_ID = 'ais-copy-conversation-button';
      const MENU_TOGGLE_BUTTON_ID = 'ais-toggle-conversation-menu';
      const ACTIONS_MENU_ID = 'ais-conversation-actions-menu';
      const SAVE_BUTTON_ID = 'ais-save-conversation-button';
      const GITHUB_SYNC_BUTTON_ID = 'ais-github-sync-button';
      const ACTIONS_TOOLBAR_ATTR = 'data-ais-toolbar-mounted';

      function injectCopyButtonStyles() {
        const styleId = 'ais-copy-conversation-style';
        if (document.getElementById(styleId)) return;
        const css = `
          #${ACTIONS_CONTAINER_ID} {
            display: inline-flex;
            align-items: stretch;
            position: relative;
            direction: ltr;
            gap: 0;
          }
          #${ACTIONS_CONTAINER_ID}[data-placement="floating"] {
            position: fixed;
            top: 84px;
            right: 16px;
            z-index: 10001;
          }
          #${COPY_BUTTON_ID}, #${MENU_TOGGLE_BUTTON_ID}, #${GITHUB_SYNC_BUTTON_ID} {
            height: 36px;
            border: 1px solid rgba(0,0,0,0.15);
            background: #ffffff;
            color: #1f1f1f;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          #${ACTIONS_CONTAINER_ID}[data-placement="toolbar"] #${COPY_BUTTON_ID},
          #${ACTIONS_CONTAINER_ID}[data-placement="toolbar"] #${MENU_TOGGLE_BUTTON_ID},
          #${ACTIONS_CONTAINER_ID}[data-placement="toolbar"] #${GITHUB_SYNC_BUTTON_ID} {
            box-shadow: none;
          }
          #${COPY_BUTTON_ID} {
            min-width: 44px;
            padding: 0 10px;
            border-radius: 10px 0 0 10px;
            border-right-width: 0;
          }
          #${GITHUB_SYNC_BUTTON_ID} {
            min-width: 44px;
            padding: 0 10px;
            border-radius: 0;
            border-right-width: 0;
          }
          #${MENU_TOGGLE_BUTTON_ID} {
            min-width: 26px;
            padding: 0 6px;
            font-size: 14px;
            border-radius: 0 10px 10px 0;
          }
          #${COPY_BUTTON_ID}:hover, #${MENU_TOGGLE_BUTTON_ID}:hover, #${GITHUB_SYNC_BUTTON_ID}:hover, #${MENU_TOGGLE_BUTTON_ID}[aria-expanded="true"] { background: #f4f4f4; }
          #${ACTIONS_MENU_ID} {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            min-width: 150px;
            padding: 6px;
            display: none;
            flex-direction: column;
            gap: 4px;
            background: #ffffff;
            border: 1px solid rgba(0,0,0,0.15);
            border-radius: 12px;
            box-shadow: 0 12px 28px rgba(0,0,0,0.18);
          }
          #${ACTIONS_MENU_ID}[data-open="true"] { display: flex; }
          #${ACTIONS_MENU_ID} button {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            min-height: 36px;
            padding: 0 10px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: inherit;
            font: inherit;
            text-align: right;
            cursor: pointer;
          }
          #${ACTIONS_MENU_ID} button:hover { background: #f4f4f4; }
          @media (prefers-color-scheme: dark) {
            #${COPY_BUTTON_ID}, #${MENU_TOGGLE_BUTTON_ID}, #${GITHUB_SYNC_BUTTON_ID} {
              background: #2b2b2b;
              color: #f3f3f3;
              border-color: rgba(255,255,255,0.2);
            }
            #${COPY_BUTTON_ID}:hover, #${MENU_TOGGLE_BUTTON_ID}:hover, #${GITHUB_SYNC_BUTTON_ID}:hover, #${MENU_TOGGLE_BUTTON_ID}[aria-expanded="true"] { background: #3a3a3a; }
            #${ACTIONS_MENU_ID} {
              background: #2b2b2b;
              border-color: rgba(255,255,255,0.2);
            }
            #${ACTIONS_MENU_ID} button:hover { background: #3a3a3a; }
          }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
      }

      function findActionsAnchor() {
        const selectors = [
          'ms-chat-header [role="toolbar"]',
          'ms-chat-header .actions',
          'ms-chat-header .buttons',
          'ms-chat-app header [role="toolbar"]',
          'ms-chat-app header .actions',
          'header [aria-label*="action" i]',
          'header [class*="action"]',
          'header [class*="button"]'
        ];

        for (const selector of selectors) {
          const candidates = Array.from(document.querySelectorAll(selector));
          const match = candidates.find((element) => {
            if (!(element instanceof HTMLElement)) return false;
            
            // חסימה 1: האם האלמנט מוסתר לחלוטין (display: none)?
            if (element.offsetParent === null) return false;
            
            // חסימה 2: האם Angular העלים אותו ויזואלית?
            const style = window.getComputedStyle(element);
            if (style.opacity === '0' || style.visibility === 'hidden') return false;

            const rect = element.getBoundingClientRect();
            return rect.width > 80 && rect.height > 24;
          });
          if (match) return match;
        }

        const actionButton = Array.from(document.querySelectorAll('button, [role="button"]')).find((element) => {
          const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.textContent || ''}`.trim();
          return /more actions|view more actions|actions/i.test(label);
        });

        if (actionButton && actionButton.parentElement instanceof HTMLElement) {
          const style = window.getComputedStyle(actionButton.parentElement);
          if (style.opacity !== '0' && style.visibility !== 'hidden' && actionButton.parentElement.offsetParent !== null) {
              return actionButton.parentElement;
          }
        }

        return null;
      }

      function syncContainerPlacement(container) {
        const anchor = findActionsAnchor();
        if (anchor) {
          if (container.parentElement !== anchor) {
            anchor.prepend(container);
          }
          container.setAttribute('data-placement', 'toolbar');
          container.style.display = 'inline-flex'; // הבטחת תצוגה
          anchor.setAttribute(ACTIONS_TOOLBAR_ATTR, 'true');
          return;
        }

        // אם לא נמצא עוגן (למשל, אנחנו במסך הראשי בלי שיחה פתוחה)
        if (container.parentElement !== document.body) {
          document.body.appendChild(container);
        }
        container.setAttribute('data-placement', 'floating');
        
        // נציג את הסרגל הצף רק אם באמת יש שיחה פעילה ברקע
        const hasChat = document.querySelector('ms-chat-session, ms-chat-turn');
        container.style.display = hasChat ? 'inline-flex' : 'none';
      }

      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      let isConversationActionInProgress = false;

      function getAllElementsDeep(root = document) {
        const out = [];
        const stack = [root];
        while (stack.length) {
          const node = stack.pop();
          if (!node) continue;
          const children = node.children ? Array.from(node.children) : [];
          for (const child of children) {
            out.push(child);
            stack.push(child);
            if (child.shadowRoot) stack.push(child.shadowRoot);
          }
        }
        return out;
      }

      function queryAllDeep(selector, root = document) {
        return getAllElementsDeep(root).filter(el => el.matches && el.matches(selector));
      }

      function getActiveChatSession() {
        const sessions = queryAllDeep('ms-chat-session').filter(el => el.isConnected);
        if (sessions.length === 0) return null;
        const scored = sessions.map(session => {
          const turns = queryAllDeep('ms-chat-turn', session).length;
          const rect = session.getBoundingClientRect();
          const visibleScore = (rect.width > 0 && rect.height > 0) ? 1 : 0;
          return { session, score: turns * 10 + visibleScore };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored[0].session;
      }

      function findTurnContainer(turnElement) {
        if (!turnElement) return null;
        const direct = turnElement.querySelector('.chat-turn-container.render, .chat-turn-container');
        if (direct) return direct;
        const deep = queryAllDeep('.chat-turn-container.render, .chat-turn-container', turnElement);
        return deep[0] || null;
      }

      function findBestScrollElement(turns) {
        const firstTurn = turns && turns[0] ? turns[0] : null;
        if (!firstTurn) return document.scrollingElement || document.documentElement;

        let node = firstTurn;
        while (node) {
          if (node instanceof Element) {
            const style = getComputedStyle(node);
            const overflowY = style.overflowY;
            const canScroll = ['auto', 'scroll', 'overlay'].includes(overflowY) && node.scrollHeight > node.clientHeight + 20;
            if (canScroll) return node;
          }
          if (node.parentElement) {
            node = node.parentElement;
          } else {
            const root = node.getRootNode && node.getRootNode();
            node = root && root.host ? root.host : null;
          }
        }
        return document.scrollingElement || document.documentElement;
      }

      function normalizeTurnText(rawText) {
        const lines = (rawText || '')
          .replace(/editmore_vert|more_vert/gi, '')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .filter(line => !/^(Model|User)$/i.test(line))
          .filter(line => !/^User\s+play_circle/i.test(line))
          .filter(line => !/^\d{1,3}(?:,\d{3})*\s+tokens$/i.test(line))
          .filter(line => !/play_circle/i.test(line))
          .filter(line => !/^Sources?\s*help$/i.test(line))
          .filter(line => !/^Google Search Suggestions/i.test(line))
          .filter(line => !/^Display of Search Suggestions is required/i.test(line))
          .filter(line => !/^Learn more$/i.test(line));
        return lines.join('\n').trim();
      }

      function parseVisibleTurns(sessionRoot) {
        const turns = queryAllDeep('ms-chat-turn', sessionRoot || document);
        return turns.map((turn, idx) => {
          const container = findTurnContainer(turn);
          if (!container) return null;
          const role = container.classList.contains('user') ? 'user' : 'model';
          const clone = container.cloneNode(true);
          clone.querySelectorAll('.actions, ms-thought-chunk, ms-citations, ms-grounding-chip, ms-grounding-sources, button, svg, style, script, [class*=\"grounding\"]').forEach(el => el.remove());
          const text = normalizeTurnText(clone.innerText || clone.textContent || '');
          if (!text) return null;
          const stableId = turn.getAttribute('data-turn-id')
            || turn.getAttribute('data-message-id')
            || container.getAttribute('data-turn-id')
            || container.getAttribute('data-message-id')
            || '';
          return { role, text, stableId, idx };
        }).filter(Boolean);
      }

      async function collectAllConversationTurns() {
        const activeSession = getActiveChatSession();
        if (!activeSession) return [];
        const allTurnsInitial = queryAllDeep('ms-chat-turn', activeSession);
        const scrollEl = findBestScrollElement(allTurnsInitial);
        const originalScrollTop = scrollEl.scrollTop;
        const collected = [];
        const seenKeys = new Set();
        const step = Math.max(Math.floor(scrollEl.clientHeight * 0.7), 220);
        const maxIterations = 220;

        scrollEl.scrollTop = 0;
        await sleep(220);

        for (let i = 0; i < maxIterations; i++) {
          const visibleTurns = parseVisibleTurns(activeSession);
          visibleTurns.forEach(turn => {
            const contentKey = `${turn.role}|${turn.text}`;
            const key = turn.stableId || contentKey;
            if (seenKeys.has(key) || seenKeys.has(contentKey)) return;
            seenKeys.add(key);
            seenKeys.add(contentKey);
            const last = collected[collected.length - 1];
            if (last && last.role === turn.role && last.text === turn.text) return;
            collected.push({ role: turn.role, text: turn.text });
          });

          const prevTop = scrollEl.scrollTop;
          const maxTop = scrollEl.scrollHeight - scrollEl.clientHeight;
          if (prevTop >= maxTop - 2) break;

          scrollEl.scrollTop = Math.min(prevTop + step, maxTop);
          await sleep(220);
          if (scrollEl.scrollTop === prevTop) break;
        }

        scrollEl.scrollTop = originalScrollTop;
        await sleep(40);
        return collected;
      }

      function beautifyText(text) {
        return (text || '')
          .replace(/\s+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/([.!?])(?=[^\s\n])/g, '$1 ')
          .replace(/([,;])(?=[^\s\n])/g, '$1 ');
      }

      function buildConversationText(turns) {
        return (turns || [])
          .map(turn => `${turn.role === 'user' ? 'שאלתי:' : 'וענו לי:'}\n${beautifyText(turn.text)}`)
          .join('\n\n')
          .trim();
      }

      function getConversationTitle() {
        const rawTitle = (document.title || 'שיחת AI Studio')
          .replace(/\s*[-|]\s*Google AI Studio\s*$/i, '')
          .replace(/^Google AI Studio\s*[-|]\s*/i, '')
          .trim();
        return rawTitle || 'שיחת AI Studio';
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
        const fallback = 'שיחת AI Studio';
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

      function buildConversationExport(turns) {
        const transcript = buildConversationText(turns);
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

      async function runConversationAction(buttonId, handler) {
        if (isConversationActionInProgress) return;
        isConversationActionInProgress = true;
        try {
          const turns = await collectAllConversationTurns();
          const exportPayload = buildConversationExport(turns);
          if (!exportPayload) { flashActionButton(buttonId, '🤔'); return; }
          await handler(exportPayload);
          flashActionButton(buttonId, '✔️');
        } catch (err) {
          console.log('[AI Studio] Conversation action failed:', err);
          flashActionButton(buttonId, '❌');
        } finally {
          isConversationActionInProgress = false;
        }
      }

      async function triggerNativeGithubSync() {
        if (isConversationActionInProgress) return;
        isConversationActionInProgress = true;
        try {
          flashActionButton(GITHUB_SYNC_BUTTON_ID, '⏳'); // חיווי טעינה
          
          const settingsBtn = document.querySelector('button[aria-label="Settings"]');
          if (!settingsBtn) throw new Error("לא נמצא כפתור ההגדרות");
          settingsBtn.click();
          
          // ---- 1. המתנה לפתיחת החלונית ----
          let githubTab = null;
          for (let i = 0; i < 25; i++) { 
            await sleep(200);
            const tabs = Array.from(document.querySelectorAll('.cdk-overlay-container button.ms-button-filter-chip'));
            githubTab = tabs.find(btn => btn.textContent.trim() === 'GitHub' || btn.getAttribute('data-view') === '3');
            if (githubTab) break; 
          }
          
          if (!githubTab) throw new Error("חלונית ההגדרות או טאב ה-GitHub לא נטענו בזמן.");
          githubTab.click();

          // ---- 2. המתנה חכמה ליצירת הקומיט (כולל זיהוי מצב טעינה) ----
          let commitBtn = null;
          for (let i = 0; i < 60; i++) { // בודק עד 30 שניות (60 פעמים של חצי שניה)
            await sleep(500);
            
            const overlayContainer = document.querySelector('.cdk-overlay-container');
            if (!overlayContainer) continue;

            // הזיהוי החדש: האם גוגל עדיין מחשב את השינויים?
            if (overlayContainer.textContent.includes('Loading file differences')) {
              continue; // כן - מדלגים וממשיכים להמתין בסבלנות
            }

            // אם חלון הטעינה נעלם, מחפשים את הכפתור
            commitBtn = overlayContainer.querySelector('button[aria-label="Push latest changes to GitHub"]');
            
            // מוודאים שהוא קיים ולא חסום
            if (commitBtn && commitBtn.getAttribute('aria-disabled') === 'false') {
              break; 
            }
          }

          if (commitBtn && commitBtn.getAttribute('aria-disabled') === 'false') {
            commitBtn.click();
            flashActionButton(GITHUB_SYNC_BUTTON_ID, '✔️'); // חיווי הצלחה
            
            // מחכים שהבקשה תצא לגוגל לפני שסוגרים את הדיאלוג
            await sleep(1500);
            const backdrop = document.querySelector('.cdk-overlay-backdrop');
            if (backdrop) backdrop.click();
            
          } else {
            throw new Error("זמן ההמתנה ליצירת הקומיט פג, הכפתור לא הופיע, או שאין שינויים בקוד.");
          }
        } catch (err) {
          console.error('[AI Studio] סנכרון נכשל:', err.message);
          flashActionButton(GITHUB_SYNC_BUTTON_ID, '❌'); // חיווי שגיאה
        } finally {
          isConversationActionInProgress = false;
        }
      }

      async function copyConversation() {
        await runConversationAction(COPY_BUTTON_ID, async ({ transcript }) => {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(transcript);
          } else if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(transcript, { type: 'text', mimetype: 'text/plain' });
          } else {
            throw new Error('Clipboard API is not available');
          }
        });
      }

      async function saveConversationToFile() {
        await runConversationAction(SAVE_BUTTON_ID, async ({ fileText, fileName }) => {
          downloadTextFile(fileText, fileName);
        });
      }

      function isConversationMenuOpen() {
        const menu = document.getElementById(ACTIONS_MENU_ID);
        return menu ? menu.getAttribute('data-open') === 'true' : false;
      }

      function toggleConversationMenu(forceOpen) {
        const menu = document.getElementById(ACTIONS_MENU_ID);
        const toggleBtn = document.getElementById(MENU_TOGGLE_BUTTON_ID);
        if (!menu || !toggleBtn) return;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.getAttribute('data-open') !== 'true';
        menu.setAttribute('data-open', shouldOpen ? 'true' : 'false');
        toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      }

      function flashActionButton(buttonId, icon) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.textContent = icon;
        setTimeout(() => {
          const currentBtn = document.getElementById(buttonId);
          if (currentBtn) currentBtn.textContent = currentBtn.dataset.defaultIcon || '';
        }, 1500);
      }

      function ensureActionButton(container, buttonId, icon, title, ariaLabel, handler) {
        let btn = document.getElementById(buttonId);
        if (btn && btn.parentElement !== container) {
          btn.remove();
          btn = null;
        }
        if (btn) return;
        btn = document.createElement('button');
        btn.id = buttonId;
        btn.type = 'button';
        btn.textContent = icon;
        btn.dataset.defaultIcon = icon;
        btn.title = title;
        btn.setAttribute('aria-label', ariaLabel);
        btn.addEventListener('click', handler);
        container.appendChild(btn);
      }

      function ensureCopyButton() {
        let container = document.getElementById(ACTIONS_CONTAINER_ID);
        
        // התיקון: בודקים *רק* אם הקונטיינר הוסר פיזית מה-DOM, 
        // בלי לבדוק offsetWidth כדי למנוע לולאה אינסופית שקורסת את הדפדפן.
        if (container && !document.body.contains(container)) {
            container = null;
        }

        if (!container) {
          container = document.createElement('div');
          container.id = ACTIONS_CONTAINER_ID;
        }
        
        syncContainerPlacement(container);
        
        ensureActionButton(container, COPY_BUTTON_ID, '📋', 'העתק את כל השיחה', 'Copy full conversation', copyConversation);
        
        if (settings.githubSyncButton) {
            ensureActionButton(container, GITHUB_SYNC_BUTTON_ID, '🐙', 'סנכרון אוטומטי לגיטהב', 'Auto Sync to GitHub', triggerNativeGithubSync);
        } else {
            const ghBtn = document.getElementById(GITHUB_SYNC_BUTTON_ID);
            if (ghBtn) ghBtn.remove();
        }

        ensureActionButton(container, MENU_TOGGLE_BUTTON_ID, '▾', 'אפשרויות נוספות', 'Conversation export options', (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleConversationMenu(!isConversationMenuOpen());
        });

        let menu = document.getElementById(ACTIONS_MENU_ID);
        if (menu && menu.parentElement !== container) {
          menu.remove();
          menu = null;
        }
        if (!menu) {
          menu = document.createElement('div');
          menu.id = ACTIONS_MENU_ID;
          menu.setAttribute('data-open', 'false');
          container.appendChild(menu);
        }

        let saveBtn = document.getElementById(SAVE_BUTTON_ID);
        if (saveBtn && saveBtn.parentElement !== menu) {
          saveBtn.remove();
          saveBtn = null;
        }
        if (!saveBtn) {
          saveBtn = document.createElement('button');
          saveBtn.id = SAVE_BUTTON_ID;
          saveBtn.type = 'button';
          saveBtn.dataset.defaultIcon = '💾 שמור לקובץ';
          saveBtn.textContent = saveBtn.dataset.defaultIcon;
          saveBtn.title = 'שמור את כל השיחה לקובץ';
          saveBtn.setAttribute('aria-label', 'Save full conversation');
          saveBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleConversationMenu(false);
            saveConversationToFile();
          });
          menu.appendChild(saveBtn);
        }
      }

      injectCopyButtonStyles();
      ensureCopyButton();
      const observer = new MutationObserver(ensureCopyButton);
      observer.observe(document.body, { childList: true, subtree: true });
      document.addEventListener('click', (event) => {
        const container = document.getElementById(ACTIONS_CONTAINER_ID);
        if (!container || container.contains(event.target)) return;
        toggleConversationMenu(false);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') toggleConversationMenu(false);
      });
    })();
  }

  /*──────────────────────────────────
    8. כפתור ציטוט בבחירת טקסט
  ──────────────────────────────────*/
  (() => {
    'use strict';

    const QUOTE_POPUP_ID = 'ais-selection-quote-popup';
    const QUOTE_BUTTON_ID = 'ais-selection-quote-button';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    let quotePopup = null;

    function getAllElementsDeep(root = document) {
      const out = [];
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        const children = node.children ? Array.from(node.children) : [];
        for (const child of children) {
          out.push(child);
          stack.push(child);
          if (child.shadowRoot) stack.push(child.shadowRoot);
        }
      }
      return out;
    }

    function findDeep(selector, root = document) {
      return getAllElementsDeep(root).find(el => el.matches && el.matches(selector)) || null;
    }

    function getElementFromNode(node) {
      if (!node) return null;
      if (node.nodeType === Node.ELEMENT_NODE) return node;
      if (node.parentElement) return node.parentElement;
      if (node.parentNode && node.parentNode.nodeType === Node.ELEMENT_NODE) return node.parentNode;
      return null;
    }

    function closestAcrossShadow(node, selector) {
      let current = getElementFromNode(node) || node;
      while (current) {
        if (current.nodeType === Node.ELEMENT_NODE && typeof current.matches === 'function' && current.matches(selector)) {
          return current;
        }
        if (current.nodeType === Node.ELEMENT_NODE && typeof current.closest === 'function') {
          const match = current.closest(selector);
          if (match) return match;
        }
        const root = current.getRootNode?.();
        if (root?.host) {
          current = root.host;
        } else {
          current = current.parentNode;
        }
      }
      return null;
    }

    function cleanText(text) {
      return (text || '')
        .replace(/\u200f|\u200e/g, '')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    }

    function injectQuoteStyles() {
      const styleId = 'ais-selection-quote-style';
      if (document.getElementById(styleId)) return;
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #${QUOTE_POPUP_ID}{
          position:fixed;
          top:0;
          left:0;
          z-index:10002;
          opacity:0;
          pointer-events:none;
          transform:translate(-50%, -8px) scale(.96);
          transition:opacity .14s ease, transform .14s ease;
        }
        #${QUOTE_POPUP_ID}[data-visible="true"]{
          opacity:1;
          pointer-events:auto;
          transform:translate(-50%, -14px) scale(1);
        }
        #${QUOTE_BUTTON_ID}{
          display:inline-flex;
          align-items:center;
          gap:10px;
          border:none;
          border-radius:999px;
          padding:12px 18px 12px 16px;
          background:rgba(255,255,255,.96);
          color:#202123;
          cursor:pointer;
          box-shadow:0 10px 30px rgba(15,23,42,.18), 0 2px 10px rgba(15,23,42,.12), inset 0 0 0 1px rgba(148,163,184,.2);
          backdrop-filter:blur(10px);
          -webkit-backdrop-filter:blur(10px);
          font:600 15px/1.1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          white-space:nowrap;
        }
        #${QUOTE_BUTTON_ID}:hover{background:#fff}
        #${QUOTE_BUTTON_ID}:active{transform:scale(.98)}
        #${QUOTE_BUTTON_ID} svg{
          width:18px;
          height:18px;
          fill:currentColor;
          flex:0 0 auto;
        }
        @media (prefers-color-scheme: dark){
          #${QUOTE_BUTTON_ID}{
            background:rgba(45,45,52,.96);
            color:#f3f4f6;
            box-shadow:0 12px 28px rgba(2,6,23,.48), 0 2px 10px rgba(2,6,23,.3), inset 0 0 0 1px rgba(255,255,255,.08);
          }
          #${QUOTE_BUTTON_ID}:hover{background:rgba(58,58,66,.98)}
        }
      `;
      document.head.appendChild(style);
    }

    function createQuoteIcon() {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M10.53 6.47C7.27 7.66 5 10.44 5 13.28 5 15.68 6.56 17 8.35 17c1.81 0 3.07-1.28 3.07-2.95 0-1.66-1.12-2.8-2.63-2.8-.28 0-.57.04-.87.13.34-1.31 1.67-2.93 3.26-3.75l-.65-1.16zm8 0C15.27 7.66 13 10.44 13 13.28 13 15.68 14.56 17 16.35 17c1.81 0 3.07-1.28 3.07-2.95 0-1.66-1.12-2.8-2.63-2.8-.28 0-.57.04-.87.13.34-1.31 1.67-2.93 3.26-3.75l-.65-1.16z');
      svg.appendChild(path);
      return svg;
    }

    function createQuotePopup() {
      if (quotePopup?.isConnected) return quotePopup;
      quotePopup = document.createElement('div');
      quotePopup.id = QUOTE_POPUP_ID;
      quotePopup.setAttribute('data-visible', 'false');

      const button = document.createElement('button');
      button.id = QUOTE_BUTTON_ID;
      button.type = 'button';
      button.setAttribute('aria-label', 'Quote and insert into AI Studio');
      button.appendChild(createQuoteIcon());
      const label = document.createElement('span');
      label.textContent = 'Ask AI Studio';
      button.appendChild(label);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const selectedText = getCurrentModelSelectionText();
        hideQuotePopup();
        if (!selectedText) return;
        insertQuoteIntoEditor(selectedText);
      });

      quotePopup.appendChild(button);
      document.body.appendChild(quotePopup);
      return quotePopup;
    }

    function hideQuotePopup() {
      if (quotePopup) quotePopup.setAttribute('data-visible', 'false');
    }

    function getEditorElement() {
      return findDeep('textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label], ms-user-input textarea');
    }

    function insertTextIntoTextarea(textarea, text) {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.focus();
      textarea.setRangeText(text, start, end, 'end');
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }

    function insertTextIntoContenteditable(editor, text) {
      editor.focus();
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
      if (document.execCommand('insertText', false, text)) {
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      if (selection) selection.addRange(range);
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }

    function insertQuoteIntoEditor(text) {
      const editor = getEditorElement();
      if (!editor) return;
      const payload = `> ${cleanText(text).replace(/\n/g, '\n> ')}\n\n`;
      if (!payload.trim()) return;
      if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
        insertTextIntoTextarea(editor, payload);
        return;
      }
      insertTextIntoContenteditable(editor, payload);
    }

    function isSelectionInsideModelResponse(range) {
      if (!range) return false;
      const nodes = [range.startContainer, range.endContainer, range.commonAncestorContainer];

      if (nodes.some(node => closestAcrossShadow(node, 'textarea, input, ms-user-input, [contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label]'))) {
        return false;
      }
      if (nodes.some(node => closestAcrossShadow(node, 'pre, code, button, a, .actions, .actions *'))) {
        return false;
      }

      return nodes.some(node => closestAcrossShadow(node, '.chat-turn-container.render:not(.user), .chat-turn-container:not(.user), ms-chat-turn'));
    }

    function getCurrentModelSelectionText() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return '';
      const range = selection.getRangeAt(0);
      if (!isSelectionInsideModelResponse(range)) return '';
      return cleanText(selection.toString());
    }

    function updateQuotePopupPosition() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        hideQuotePopup();
        return;
      }

      const text = getCurrentModelSelectionText();
      if (!text || text.length < 2) {
        hideQuotePopup();
        return;
      }

      const range = selection.getRangeAt(0);
      const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
      if (rects.length === 0) {
        hideQuotePopup();
        return;
      }

      const popup = createQuotePopup();
      const anchorElement = getElementFromNode(range.commonAncestorContainer);
      const isRtl = getComputedStyle(anchorElement || document.body).direction === 'rtl';
      const topRow = Math.min(...rects.map(rect => rect.top));
      const topRects = rects.filter(rect => Math.abs(rect.top - topRow) < 6);
      const anchorRect = topRects.sort((a, b) => {
        if (isRtl) return b.right - a.right;
        return a.left - b.left;
      })[0];

      const popupWidth = popup.offsetWidth || 320;
      const popupHeight = popup.offsetHeight || 56;
      const horizontalPadding = Math.max(16, popupWidth / 2 + 8);
      const gap = 16;
      const anchorX = isRtl
        ? anchorRect.right - Math.min(anchorRect.width * 0.35, 32)
        : anchorRect.left + Math.min(anchorRect.width * 0.35, 32);
      const x = Math.max(horizontalPadding, Math.min(window.innerWidth - horizontalPadding, anchorX));
      const preferredY = anchorRect.top - popupHeight - gap;
      const fallbackBottom = Math.max(...rects.map(rect => rect.bottom));
      const y = preferredY > 12 ? preferredY : fallbackBottom + gap;

      popup.style.left = `${Math.round(x)}px`;
      popup.style.top = `${Math.round(y)}px`;
      popup.setAttribute('data-visible', 'true');
    }

    injectQuoteStyles();
    createQuotePopup();

    document.addEventListener('mouseup', () => {
      setTimeout(updateQuotePopupPosition, 10);
    });
    document.addEventListener('keyup', () => {
      setTimeout(updateQuotePopupPosition, 10);
    });
    document.addEventListener('selectionchange', () => {
      const active = document.activeElement;
      if (active && (active.matches?.('textarea, input, [contenteditable="true"]') || active.closest?.('ms-user-input'))) {
        hideQuotePopup();
        return;
      }
      setTimeout(updateQuotePopupPosition, 10);
    });
    document.addEventListener('mousedown', (event) => {
      if (quotePopup?.contains(event.target)) return;
      hideQuotePopup();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideQuotePopup();
    });
    window.addEventListener('scroll', hideQuotePopup, true);
  })();

})();
