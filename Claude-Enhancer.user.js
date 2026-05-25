// ==UserScript==
// @name         כלי עזר משולבים וסרגל צד ל-Claude.ai
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  משלב עיצוב בועות, RTL, העתקה, שמירה לקובץ, וסרגל צד Timeline דינמי מרובה עמודות, עם התאמה אישית, אופטימיזציות, ותמיכה במצב כהה - ל-Claude.ai
// @author       Y-PLONI
// @match        *://claude.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_log
// @grant        GM_notification
// @run-at       document-idle
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @downloadURL  https://github.com/Y-PLONI/Improving-AI-sites/raw/main/Claude-Enhancer.user.js
// @updateURL    https://github.com/Y-PLONI/Improving-AI-sites/raw/main/Claude-Enhancer.user.js
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = false;
    const debugLog = DEBUG ? (...args) => console.log('[Claude Script]', ...args) : () => {};
    const debugWarn = DEBUG ? (...args) => console.warn('[Claude Script]', ...args) : () => {};
    const debugError = DEBUG ? (...args) => console.error('[Claude Script]', ...args) : () => {};

    debugLog('Claude Combined Utilities & Timeline Script - Started');

    // --- START: Settings and General Utilities ---
    const SETTINGS_KEYS = {
        enableStyling: 'claude_utils_enableStyling_v1',
        enableCopyButton: 'claude_utils_enableCopyButton_v1',
        enableTimelineSidebar: 'claude_utils_enableTimelineSidebar_v1',
        enableAiMessageNotifications: 'claude_utils_enableAiMessageNotifications_v1'
    };
    let currentSettings = {};
    let pageVisible = !document.hidden;

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout); timeout = setTimeout(later, wait);
        };
    }

    const STYLE_ID_BASE = 'claude-userscript-style-';
    function injectStyles(id, cssText){
        let el = document.getElementById(id);
        if (cssText){
            if (!el){ el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
            el.textContent = cssText;
        } else if (el){
            el.remove();
        }
    }

    function loadSettings() {
        currentSettings.enableStyling = GM_getValue(SETTINGS_KEYS.enableStyling, true);
        currentSettings.enableCopyButton = GM_getValue(SETTINGS_KEYS.enableCopyButton, true);
        currentSettings.enableTimelineSidebar = GM_getValue(SETTINGS_KEYS.enableTimelineSidebar, true);
        currentSettings.enableAiMessageNotifications = GM_getValue(SETTINGS_KEYS.enableAiMessageNotifications, true);
        debugLog('Claude - Loaded settings:', currentSettings);
    }

    // === Claude-specific selectors ===
    const userMessageContainerSelector = '[data-testid="user-message"]';
    const userMessageBubbleSelector = '[data-user-message-bubble="true"]';
    const userTextContentSelector = '[data-testid="user-message"]';
    const aiMessageContainerSelector = '[data-is-streaming]';
    const aiMessageContentSelector = '.font-claude-response';
    const aiPadding = '10px 15px';
    const aiBorderRadius = '1.5rem';
    const aiMarginBottom = '15px';
    const aiMarginTop = '15px';

    const ACTIONS_CONTAINER_SELECTOR = '[data-testid="wiggle-controls-actions"]';
    const SHARE_BUTTON_SELECTOR = '[data-testid="wiggle-controls-actions-share"]';
    const SPLIT_BUTTON_WRAPPER_ID = 'claude-conversation-actions';
    const COPY_BUTTON_ID = 'copy-claude-conversation';
    const MENU_TOGGLE_BUTTON_ID = 'toggle-claude-conversation-menu';
    const ACTIONS_MENU_ID = 'claude-conversation-actions-menu';
    const SAVE_BUTTON_ID = 'save-claude-conversation';
    const RETRY_MS = 500;
    const MAX_FIND_ACTIONS_CONTAINER_RETRIES = 10;

    const SCRIPT_HIDDEN_CLASS = 'claude-script-hidden';

    let copyButtonObserver = null;
    let findActionsContainerRetries = 0;

    function isDarkModeActive() {
        // Claude uses data-mode attribute on <html>
        const mode = document.documentElement.getAttribute('data-mode');
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        // Fallback: prefer color scheme
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function applyStylesOnLoad() {
        const STYLE_ID_STYLING = STYLE_ID_BASE + 'styling';
        const STYLE_ID_COPY    = STYLE_ID_BASE + 'copy';
        const STYLE_ID_SETTINGS_DARK_MODE = STYLE_ID_BASE + 'settings-dark';
        const STYLE_ID_UTILITY = STYLE_ID_BASE + 'utility';

        let cssStyling = "", cssCopy = "", cssSettingsDark = "", cssUtility = "";
        const isDarkMode = isDarkModeActive();

        cssUtility = `
            .${SCRIPT_HIDDEN_CLASS} { display: none !important; }
        `;

        if (currentSettings.enableStyling) {
            cssStyling += `
                :root{
                    --claude-user-bubble-bg: ${isDarkMode ? '#3A3F47' : '#F4FFF7'};
                    --claude-user-bubble-text: ${isDarkMode ? '#E0E0E0' : 'inherit'};
                    --claude-user-stripe: ${isDarkMode ? '#508D50' : '#A5D6A7'};
                    --claude-ai-bubble-bg: ${isDarkMode ? '#2C3035' : '#E3F2FD'};
                    --claude-ai-bubble-text: ${isDarkMode ? '#E0E0E0' : 'inherit'};
                    --claude-ai-border: ${isDarkMode ? '#454A50' : '#BBDEFB'};
                    --claude-ai-stripe: ${isDarkMode ? '#4A7ABE' : '#64B5F6'};
                }
                ${userMessageContainerSelector} { direction: rtl !important; text-align: right !important; }
                ${userMessageBubbleSelector} {
                    background-color: var(--claude-user-bubble-bg) !important;
                    color: var(--claude-user-bubble-text) !important;
                    padding: 10px 15px !important;
                    border-right: 4px solid var(--claude-user-stripe) !important;
                }
                ${aiMessageContainerSelector} {
                    background-color: var(--claude-ai-bubble-bg) !important;
                    color: var(--claude-ai-bubble-text) !important;
                    padding: ${aiPadding} !important;
                    border-radius: ${aiBorderRadius} !important;
                    margin-bottom: ${aiMarginBottom} !important;
                    margin-top: ${aiMarginTop} !important;
                    border: 1px solid var(--claude-ai-border) !important;
                    border-left: 4px solid var(--claude-ai-stripe) !important;
                    overflow: hidden !important;
                    overflow-x: auto !important;
                }
                ${aiMessageContainerSelector} ${aiMessageContentSelector},
                ${aiMessageContainerSelector} .standard-markdown,
                ${aiMessageContainerSelector} .font-claude-response-body {
                    color: var(--claude-ai-bubble-text) !important;
                }
                ${aiMessageContainerSelector} ${aiMessageContentSelector} table,
                ${aiMessageContainerSelector} .standard-markdown table {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    overflow-x: auto !important;
                    margin-top: 0.5em !important;
                    margin-bottom: 0.5em !important;
                    border-collapse: collapse !important;
                }
                ${aiMessageContainerSelector} ${aiMessageContentSelector} table th,
                ${aiMessageContainerSelector} ${aiMessageContentSelector} table td,
                ${aiMessageContainerSelector} .standard-markdown table th,
                ${aiMessageContainerSelector} .standard-markdown table td {
                    padding: 6px 10px !important;
                    border: 1px solid ${isDarkMode ? '#5A6067' : '#A1C4E5'} !important;
                    text-align: right !important;
                    color: var(--claude-ai-bubble-text) !important;
                }
                ${aiMessageContainerSelector} ${aiMessageContentSelector} table th,
                ${aiMessageContainerSelector} .standard-markdown table th {
                    background-color: ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'} !important;
                }
                ${aiMessageContainerSelector} ${aiMessageContentSelector} ul,
                ${aiMessageContainerSelector} ${aiMessageContentSelector} ol,
                ${aiMessageContainerSelector} .standard-markdown ul,
                ${aiMessageContainerSelector} .standard-markdown ol {
                    padding-right: 25px !important;
                    padding-left: 5px !important;
                    margin-right: 0px !important;
                }
                ${aiMessageContainerSelector} ${aiMessageContentSelector} li,
                ${aiMessageContainerSelector} .standard-markdown li {
                    text-align: right !important;
                    margin-bottom: 0.25em !important;
                }
            `;
        }

        if (currentSettings.enableCopyButton) {
            cssCopy += `
                #${SPLIT_BUTTON_WRAPPER_ID} {
                    position: relative;
                    display: inline-flex;
                    align-items: stretch;
                    height: 36px;
                    margin-inline-end: 8px;
                    order: -1;
                }
                #${COPY_BUTTON_ID}, #${MENU_TOGGLE_BUTTON_ID} {
                    display: flex; align-items: center; justify-content: center; height: 36px; min-width: 36px;
                    padding: 0 8px;
                    background-color: ${isDarkMode ? '#4A4D4F' : '#FFFFFF'} !important;
                    color: ${isDarkMode ? '#E0E0E0' : '#343A40'} !important;
                    font-size: 18px; line-height: 1;
                    border: 1px solid ${isDarkMode ? '#6A6D6F' : '#DEE2E6'} !important;
                    cursor: pointer;
                    user-select: none;
                    font-family: inherit;
                }
                #${COPY_BUTTON_ID} {
                    min-width: 42px;
                    border-radius: 6px 0 0 6px;
                    border-inline-end-width: 0 !important;
                }
                #${MENU_TOGGLE_BUTTON_ID} {
                    min-width: 24px;
                    padding: 0 6px;
                    font-size: 14px;
                    border-radius: 0 6px 6px 0;
                }
                #${COPY_BUTTON_ID}:hover, #${MENU_TOGGLE_BUTTON_ID}:hover, #${MENU_TOGGLE_BUTTON_ID}[aria-expanded="true"] {
                    background-color: ${isDarkMode ? '#5A5D5F' : '#F8F9FA'} !important;
                    border-color: ${isDarkMode ? '#7A7D7F' : '#CED4DA'} !important;
                }
                #${ACTIONS_MENU_ID} {
                    position: fixed;
                    min-width: 140px;
                    padding: 6px;
                    display: none;
                    flex-direction: column;
                    gap: 4px;
                    background-color: ${isDarkMode ? '#2F3337' : '#FFFFFF'} !important;
                    border: 1px solid ${isDarkMode ? '#6A6D6F' : '#DEE2E6'} !important;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, ${isDarkMode ? '0.35' : '0.12'});
                    z-index: 30;
                }
                #${ACTIONS_MENU_ID}[data-open="true"] {
                    display: flex;
                }
                #${ACTIONS_MENU_ID} button {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 8px;
                    width: 100%;
                    min-height: 34px;
                    padding: 0 10px;
                    background: transparent !important;
                    color: inherit !important;
                    border: 0 !important;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: inherit;
                    text-align: right;
                }
                #${ACTIONS_MENU_ID} button:hover {
                    background-color: ${isDarkMode ? '#464B50' : '#F3F4F6'} !important;
                }
            `;
        }

        cssSettingsDark = `
            #claude-userscript-settings-dialog.claude-settings-dark {
                background-color: #282A2E !important; color: #EAEAEA !important; border-color: #404246 !important;
            }
            #claude-userscript-settings-dialog.claude-settings-dark h3 { color: #F0F0F0 !important; border-bottom-color: #404246 !important; }
            #claude-userscript-settings-dialog.claude-settings-dark label { color: #D8D8D8 !important; }
            #claude-userscript-settings-dialog.claude-settings-dark p { color: #B0B0B0 !important; }
            #claude-userscript-settings-dialog.claude-settings-dark button#settings-save-button { background-color: #1E8E3E !important; color: #FFFFFF !important; border: 1px solid #1A7D36 !important; }
            #claude-userscript-settings-dialog.claude-settings-dark button#settings-cancel-button { background-color: #4A4D4F !important; color: #E0E0E0 !important; border: 1px solid #3A3D3F !important; }
            #claude-userscript-settings-dialog.claude-settings-dark input[type="checkbox"] { filter: invert(1) hue-rotate(180deg) brightness(0.8) contrast(1.2); border: 1px solid #5A5D5F; }
        `;
        injectStyles(STYLE_ID_UTILITY, cssUtility);
        injectStyles(STYLE_ID_SETTINGS_DARK_MODE, cssSettingsDark);
        injectStyles(STYLE_ID_STYLING, cssStyling);
        injectStyles(STYLE_ID_COPY, cssCopy);
    }

    function initializeCopyButtonFeature() {
        if (copyButtonObserver) copyButtonObserver.disconnect(); copyButtonObserver = null;
        const existingWrapper = document.getElementById(SPLIT_BUTTON_WRAPPER_ID);
        const existingCopyButton = document.getElementById(COPY_BUTTON_ID);
        const existingSaveButton = document.getElementById(SAVE_BUTTON_ID);
        const existingToggleButton = document.getElementById(MENU_TOGGLE_BUTTON_ID);
        const existingMenu = document.getElementById(ACTIONS_MENU_ID);
        if (existingWrapper) existingWrapper.remove();
        if (existingCopyButton) existingCopyButton.remove();
        if (existingSaveButton) existingSaveButton.remove();
        if (existingToggleButton) existingToggleButton.remove();
        if (existingMenu) existingMenu.remove();

        if (currentSettings.enableCopyButton) {
            debugLog('CopyButton - Initializing.');
            applyStylesOnLoad();
            findActionsContainerRetries = 0;
            attemptToSetupCopyButtonObserver();
            if (!window.__claudeCopyBtnBodyObserver) {
                window.__claudeCopyBtnBodyObserver = new MutationObserver(() => {
                    if (!currentSettings.enableCopyButton || !pageVisible) return;
                    if ((!document.getElementById(SPLIT_BUTTON_WRAPPER_ID) || !document.getElementById(COPY_BUTTON_ID) || !document.getElementById(MENU_TOGGLE_BUTTON_ID)) &&
                        document.querySelector(ACTIONS_CONTAINER_SELECTOR)) {
                        debugLog('CopyButton - Body observer detected missing button. Re-initializing.');
                        attemptToSetupCopyButtonObserver();
                    }
                });
                if (pageVisible) {
                     try { window.__claudeCopyBtnBodyObserver.observe(document.body, { childList: true, subtree: true }); } catch(e) { debugWarn("CopyButton: BodyObserver error.", e); }
                }
            }
        } else {
            if (window.__claudeCopyBtnBodyObserver) {
                window.__claudeCopyBtnBodyObserver.disconnect();
                window.__claudeCopyBtnBodyObserver = null;
            }
            injectStyles(STYLE_ID_BASE + 'copy', "");
            debugLog('CopyButton - Disabled by settings.');
        }
    }
    function attemptToSetupCopyButtonObserver() {
        if (!currentSettings.enableCopyButton) return;
        const actionsContainer = document.querySelector(ACTIONS_CONTAINER_SELECTOR);
        if (actionsContainer) {
            debugLog('CopyButton - Actions container found. Setting up MutationObserver.');
            if (copyButtonObserver) copyButtonObserver.disconnect();
            copyButtonObserver = new MutationObserver((mutationsList, observer) => {
                if(!pageVisible || !currentSettings.enableCopyButton) return;
                const currentActionsContainer = document.querySelector(ACTIONS_CONTAINER_SELECTOR);
                if (!currentActionsContainer || !document.body.contains(currentActionsContainer)) {
                    debugWarn('CopyButton - Actions container no longer in DOM. Re-initializing.');
                    observer.disconnect(); copyButtonObserver = null; findActionsContainerRetries = 0;
                    const retryDelay = RETRY_MS * 2;
                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(() => attemptToSetupCopyButtonObserver(), { timeout: retryDelay });
                    } else {
                        setTimeout(attemptToSetupCopyButtonObserver, retryDelay);
                    }
                    return;
                }
                ensureCopyButtonPresent(currentActionsContainer);
            });
            copyButtonObserver.observe(actionsContainer, { childList: true, subtree: true });
            ensureCopyButtonPresent(actionsContainer);
        } else {
            findActionsContainerRetries++;
            if (findActionsContainerRetries < MAX_FIND_ACTIONS_CONTAINER_RETRIES) {
                debugLog(`CopyButton - Actions container not found (attempt ${findActionsContainerRetries}). Retrying...`);
                const delay = RETRY_MS * (findActionsContainerRetries < 5 ? 2 : 4);
                 if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => attemptToSetupCopyButtonObserver(), { timeout: delay });
                } else {
                    setTimeout(attemptToSetupCopyButtonObserver, delay);
                }
            } else { debugError('CopyButton - Actions container not found. Observer not set up.'); }
        }
    }
    function ensureCopyButtonPresent(container) {
        if (!currentSettings.enableCopyButton || !container || !document.body.contains(container)) {
            const wrapper = document.getElementById(SPLIT_BUTTON_WRAPPER_ID); if (wrapper) wrapper.remove();
            const copyBtn = document.getElementById(COPY_BUTTON_ID); if (copyBtn) copyBtn.remove();
            const toggleBtn = document.getElementById(MENU_TOGGLE_BUTTON_ID); if (toggleBtn) toggleBtn.remove();
            const menu = document.getElementById(ACTIONS_MENU_ID); if (menu) menu.remove();
            const saveBtn = document.getElementById(SAVE_BUTTON_ID); if (saveBtn) saveBtn.remove();
            return;
        }
        const shareButtonOriginal = container.querySelector(SHARE_BUTTON_SELECTOR);
        const insertBeforeRef = shareButtonOriginal || container.firstElementChild;

        let wrapper = document.getElementById(SPLIT_BUTTON_WRAPPER_ID);
        let copyBtn = document.getElementById(COPY_BUTTON_ID);
        let toggleBtn = document.getElementById(MENU_TOGGLE_BUTTON_ID);
        let menu = document.getElementById(ACTIONS_MENU_ID);
        let saveBtn = document.getElementById(SAVE_BUTTON_ID);
        if (wrapper && container.contains(wrapper) && copyBtn && toggleBtn && menu && saveBtn) return;
        if (wrapper) { wrapper.remove(); }
        if (copyBtn) { copyBtn.remove(); }
        if (toggleBtn) { toggleBtn.remove(); }
        if (menu) { menu.remove(); }
        if (saveBtn) { saveBtn.remove(); }
        wrapper = document.createElement('div');
        wrapper.id = SPLIT_BUTTON_WRAPPER_ID;
        copyBtn = document.createElement('button');
        copyBtn.id = COPY_BUTTON_ID;
        copyBtn.textContent = '📋';
        copyBtn.title = 'העתק את השיחה';
        copyBtn.addEventListener('click', copyConversation);
        toggleBtn = document.createElement('button');
        toggleBtn.id = MENU_TOGGLE_BUTTON_ID;
        toggleBtn.type = 'button';
        toggleBtn.textContent = '▾';
        toggleBtn.title = 'אפשרויות נוספות';
        toggleBtn.setAttribute('aria-label', 'Conversation export options');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleConversationMenu(!isConversationMenuOpen());
        });
        menu = document.createElement('div');
        menu.id = ACTIONS_MENU_ID;
        menu.setAttribute('data-open', 'false');
        saveBtn = document.createElement('button');
        saveBtn.id = SAVE_BUTTON_ID;
        saveBtn.type = 'button';
        saveBtn.textContent = '💾 שמור לקובץ';
        saveBtn.title = 'שמור את השיחה לקובץ';
        saveBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleConversationMenu(false);
            saveConversationToFile();
        });
        menu.appendChild(saveBtn);
        wrapper.appendChild(copyBtn);
        wrapper.appendChild(toggleBtn);
        document.body.appendChild(menu);
        if (insertBeforeRef) {
            container.insertBefore(wrapper, insertBeforeRef);
        } else {
            container.appendChild(wrapper);
        }
        debugLog('CopyButton - Injected/Re-injected.');
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
        if (shouldOpen) positionConversationMenu(toggleBtn, menu);
        menu.setAttribute('data-open', shouldOpen ? 'true' : 'false');
        toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
    function positionConversationMenu(toggleBtn, menu) {
        if (!toggleBtn || !menu) return;
        const rect = toggleBtn.getBoundingClientRect();
        const menuWidth = Math.max(menu.offsetWidth || 0, 140);
        const viewportPadding = 8;
        const left = Math.min(
            Math.max(rect.right - menuWidth, viewportPadding),
            window.innerWidth - menuWidth - viewportPadding
        );
        const top = Math.min(rect.bottom + 6, window.innerHeight - viewportPadding);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function getConversationTitle() {
        const titleCandidates = [
            document.querySelector('[data-testid="chat-title-button"]'),
            document.querySelector('main h1'),
            document.querySelector('header h1')
        ].map((el) => el?.textContent?.trim()).filter(Boolean);
        const rawTitle = titleCandidates[0] || document.title || 'שיחת Claude';
        const normalizedTitle = rawTitle
            .replace(/\s*[-|]\s*Claude\s*$/i, '')
            .replace(/^Claude\s*[-|]\s*/i, '')
            .replace(/\bClaude\b/gi, '')
            .trim();
        return normalizedTitle || 'שיחת Claude';
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
        const fallback = 'שיחת Claude';
        return (name || fallback)
            .replace(/[\\/:*?"<>|]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120) || fallback;
    }

    // Find turn containers (each wraps either a user or assistant message)
    function findTurnContainers() {
        // Selector: divs with content-visibility class - these wrap each turn
        const turns = document.querySelectorAll('div[class*="content-visibility"]');
        return Array.from(turns).filter(t => {
            // Filter to only those that contain a user or assistant message
            return t.querySelector('[data-testid="user-message"]') ||
                   t.querySelector('[data-is-streaming]') ||
                   t.querySelector('.font-claude-response');
        });
    }

    function detectTurnRole(turnEl) {
        if (turnEl.querySelector('[data-testid="user-message"]')) return 'user';
        if (turnEl.querySelector('[data-is-streaming]') || turnEl.querySelector('.font-claude-response')) return 'assistant';
        // Fallback via sr-only h2
        const h2 = turnEl.querySelector('h2.sr-only, h2[class*="sr-only"]');
        if (h2) {
            const txt = (h2.textContent || '').trim().toLowerCase();
            if (txt.startsWith('you said')) return 'user';
            if (txt.startsWith('claude') || txt.includes('responded')) return 'assistant';
        }
        return 'assistant';
    }

    function extractTurnText(turnEl, role) {
        if (role === 'user') {
            const userEl = turnEl.querySelector('[data-testid="user-message"]');
            return (userEl ? userEl.textContent : turnEl.textContent).trim();
        }
        const responseEl = turnEl.querySelector('.font-claude-response') || turnEl.querySelector('.standard-markdown');
        if (responseEl) return (responseEl.textContent || '').trim();
        const streamingContainer = turnEl.querySelector('[data-is-streaming]');
        if (streamingContainer) return (streamingContainer.textContent || '').trim();
        return turnEl.textContent.trim();
    }

    function collectConversationTurns() {
        const turnEls = findTurnContainers();
        const turns = [];
        turnEls.forEach((turnEl) => {
            const role = detectTurnRole(turnEl);
            const text = extractTurnText(turnEl, role);
            if (text) turns.push({ role, text });
        });
        return turns;
    }
    function buildConversationText() {
        return collectConversationTurns()
            .map(({ role, text }) => `${role === 'user' ? 'שאלתי:' : 'וענו לי:'}\n${text}`)
            .join('\n\n')
            .trim();
    }
    function buildConversationFileText(conversationText) {
        if (!conversationText) return '';
        const title = getConversationTitle();
        const { dateDots, timeStr } = getExportDateParts();
        return [
            `נושא: ${title}`,
            `תאריך ייצוא: ${dateDots} | שעה: ${timeStr}`,
            `קישור: ${window.location.href}`,
            `${'='.repeat(60)}`,
            '',
            conversationText
        ].join('\n').trim();
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
    async function copyConversation() {
        const textToCopy = buildConversationText(); if (!textToCopy) { flashButtonIcon(COPY_BUTTON_ID, '🤔'); return; }
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') await navigator.clipboard.writeText(textToCopy);
            else if (typeof GM_setClipboard === 'function') GM_setClipboard(textToCopy, { type: 'text', mimetype: 'text/plain' });
            else throw new Error('Clipboard API not available');
            flashButtonIcon(COPY_BUTTON_ID, '✔️');
        } catch (err) {
            debugError('CopyButton - Copy failed:', err); flashButtonIcon(COPY_BUTTON_ID, '❌');
            if (typeof GM_notification === 'function') GM_notification({ title: 'שגיאת העתקה', text: `ההעתקה נכשלה: ${err.message}`, silent: true, timeout: 8000 });
        }
    }
    function saveConversationToFile() {
        const conversationText = buildConversationText();
        if (!conversationText) { flashButtonIcon(SAVE_BUTTON_ID, '🤔'); return; }
        try {
            const fileText = buildConversationFileText(conversationText);
            const { fileStamp } = getExportDateParts();
            const fileName = `${fileStamp} - ${sanitizeFilename(getConversationTitle())}.txt`;
            downloadTextFile(fileText, fileName);
            flashButtonIcon(SAVE_BUTTON_ID, '✔️');
        } catch (err) {
            debugError('SaveButton - Save failed:', err); flashButtonIcon(SAVE_BUTTON_ID, '❌');
            if (typeof GM_notification === 'function') GM_notification({ title: 'שגיאת שמירה', text: `השמירה נכשלה: ${err.message}`, silent: true, timeout: 8000 });
        }
    }
    function flashButtonIcon(buttonId, str) {
        const btn = document.getElementById(buttonId); if (!btn) return;
        const originalContent = buttonId === SAVE_BUTTON_ID ? '💾 שמור לקובץ' : '📋'; btn.textContent = str;
        setTimeout(() => {
            const currentButton = document.getElementById(buttonId);
            if (currentButton) currentButton.textContent = originalContent;
        }, 1500);
    }
    document.addEventListener('click', (event) => {
        const wrapper = document.getElementById(SPLIT_BUTTON_WRAPPER_ID);
        if (!wrapper || wrapper.contains(event.target)) return;
        toggleConversationMenu(false);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') toggleConversationMenu(false);
    });
    window.addEventListener('resize', () => {
        if (!isConversationMenuOpen()) return;
        const toggleBtn = document.getElementById(MENU_TOGGLE_BUTTON_ID);
        const menu = document.getElementById(ACTIONS_MENU_ID);
        positionConversationMenu(toggleBtn, menu);
    });
    window.addEventListener('scroll', () => {
        if (!isConversationMenuOpen()) return;
        const toggleBtn = document.getElementById(MENU_TOGGLE_BUTTON_ID);
        const menu = document.getElementById(ACTIONS_MENU_ID);
        positionConversationMenu(toggleBtn, menu);
    }, true);

    // --- START: AI Notifications Feature ---
    let lastNotifiedTurnKey = null;
    let notificationCheckTimeout = null;
    let notificationDomObserver = null;
    let notificationUrlObserver = null;
    let notificationPollingInterval = null;
    let notificationConversationKey = '';
    let notificationAwaitingResponse = false;
    let notificationPendingWasInBackground = false;
    let notificationPendingUserTurnCount = 0;
    let notificationAssistantBaselineCount = 0;
    const notifiedAssistantKeys = new Set();

    function getConversationKey() {
        const path = window.location.pathname || '/';
        const match = path.match(/^\/chat\/([^/?#]+)/);
        if (match && match[1]) return `chat:${match[1]}`;
        return `path:${path}`;
    }

    function getTurnsByRole(role) {
        return findTurnContainers().filter(t => detectTurnRole(t) === role);
    }

    function getLatestAssistantTurn() {
        const turns = getTurnsByRole('assistant');
        if (!turns.length) return null;
        const last = turns[turns.length - 1];
        const streamingEl = last.querySelector('[data-is-streaming]');
        const isStreaming = streamingEl && streamingEl.getAttribute('data-is-streaming') === 'true';
        // Use position + a hash-ish key from text length to detect new messages
        const text = extractTurnText(last, 'assistant');
        const key = `assist:${turns.length}:${text.length}`;
        return { element: last, key, isStreaming, text };
    }

    function scheduleNotificationRecheck(delay = 900) {
        if (notificationCheckTimeout) clearTimeout(notificationCheckTimeout);
        notificationCheckTimeout = setTimeout(() => {
            notificationCheckTimeout = null;
            checkForNewAiResponse();
        }, delay);
    }

    function updateNotificationPolling() {
        if (notificationPollingInterval) {
            clearInterval(notificationPollingInterval);
            notificationPollingInterval = null;
        }
        if (!currentSettings.enableAiMessageNotifications) return;
        if (!notificationAwaitingResponse && pageVisible) return;
        const intervalMs = pageVisible ? 1500 : 900;
        notificationPollingInterval = setInterval(() => {
            checkForNewAiResponse();
        }, intervalMs);
    }

    function resetNotificationStateForCurrentConversation() {
        notificationAwaitingResponse = false;
        notificationPendingWasInBackground = false;
        notificationPendingUserTurnCount = getTurnsByRole('user').length;
        notificationAssistantBaselineCount = getTurnsByRole('assistant').length;

        const latestAssistant = getLatestAssistantTurn();
        if (latestAssistant) {
            lastNotifiedTurnKey = latestAssistant.key;
            notifiedAssistantKeys.add(latestAssistant.key);
        }

        if (notificationCheckTimeout) {
            clearTimeout(notificationCheckTimeout);
            notificationCheckTimeout = null;
        }
        updateNotificationPolling();
    }

    function checkForNewAiResponse() {
        if (!currentSettings.enableAiMessageNotifications) return;

        const currentConversationKey = getConversationKey();
        if (currentConversationKey !== notificationConversationKey) {
            notificationConversationKey = currentConversationKey;
            resetNotificationStateForCurrentConversation();
            return;
        }

        const currentUserCount = getTurnsByRole('user').length;
        if (currentUserCount > notificationPendingUserTurnCount) {
            notificationPendingUserTurnCount = currentUserCount;
            notificationAssistantBaselineCount = getTurnsByRole('assistant').length;
            notificationAwaitingResponse = true;
            notificationPendingWasInBackground = !pageVisible;
            updateNotificationPolling();
            debugLog(`Notifications - New user message detected, waiting for AI completion.`);
        }

        if (!notificationAwaitingResponse) return;

        const latestAssistant = getLatestAssistantTurn();
        if (!latestAssistant) {
            scheduleNotificationRecheck();
            return;
        }
        const currentAssistantCount = getTurnsByRole('assistant').length;
        if (currentAssistantCount <= notificationAssistantBaselineCount) {
            scheduleNotificationRecheck();
            return;
        }
        if (latestAssistant.isStreaming) {
            scheduleNotificationRecheck();
            return;
        }
        if (notifiedAssistantKeys.has(latestAssistant.key)) {
            notificationAwaitingResponse = false;
            notificationPendingWasInBackground = false;
            updateNotificationPolling();
            return;
        }

        const cleanText = (latestAssistant.text || '').replace(/\s+/g, ' ').trim();
        if (!cleanText) {
            scheduleNotificationRecheck();
            return;
        }

        const words = cleanText.split(/\s+/);
        const preview = words.slice(0, 10).join(' ') + (words.length > 10 ? '...' : '');
        if (!pageVisible || notificationPendingWasInBackground) {
            playNotificationSound(preview || 'התקבלה תשובה חדשה');
        } else {
            debugLog(`Notifications - Suppressed while page visible.`);
        }

        lastNotifiedTurnKey = latestAssistant.key;
        notificationAwaitingResponse = false;
        notificationPendingWasInBackground = false;
        notifiedAssistantKeys.add(latestAssistant.key);
        updateNotificationPolling();
        debugLog(`Notifications - AI completion notified.`);
    }

    function initializeAiNotificationsFeature() {
        if (notificationDomObserver) {
            notificationDomObserver.disconnect();
            notificationDomObserver = null;
        }
        if (notificationUrlObserver) {
            notificationUrlObserver.disconnect();
            notificationUrlObserver = null;
        }
        if (notificationPollingInterval) {
            clearInterval(notificationPollingInterval);
            notificationPollingInterval = null;
        }
        if (notificationCheckTimeout) {
            clearTimeout(notificationCheckTimeout);
            notificationCheckTimeout = null;
        }

        if (!currentSettings.enableAiMessageNotifications) {
            notificationAwaitingResponse = false;
            notificationPendingWasInBackground = false;
            updateNotificationPolling();
            return;
        }

        notificationConversationKey = getConversationKey();
        resetNotificationStateForCurrentConversation();

        notificationDomObserver = new MutationObserver(debounce(() => {
            checkForNewAiResponse();
        }, 250));
        notificationDomObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

        notificationUrlObserver = new MutationObserver(() => {
            const key = getConversationKey();
            if (key !== notificationConversationKey) {
                notificationConversationKey = key;
                resetNotificationStateForCurrentConversation();
            }
        });
        notificationUrlObserver.observe(document.body, { childList: true, subtree: true });
        updateNotificationPolling();
    }

    function playNotificationSound(notificationBody = 'התקבלה תשובה חדשה') {
        if (playNotificationSound.lastPlayed && Date.now() - playNotificationSound.lastPlayed < 2000) {
            console.log('[Claude Script] התראה נמנעה (ריצה מהירה מדי).');
            return;
        }
        playNotificationSound.lastPlayed = Date.now();

        console.log('[Claude Script] מפעיל התראה:', notificationBody);

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
        } catch (error) {
            console.log('[Claude Script] Failed to play notification sound:', error);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('Claude', {
                    body: notificationBody,
                    icon: 'https://claude.ai/favicon.ico',
                    tag: 'claude-notification'
                });
            } catch (e) {
                console.log('[Claude Script] שגיאה בהתראת דסקטופ:', e);
            }
        } else if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Claude', {
                        body: notificationBody,
                        icon: 'https://claude.ai/favicon.ico',
                        tag: 'claude-notification'
                    });
                }
            });
        }

        if (typeof GM_notification === 'function') {
            GM_notification({
                title: 'Claude',
                text: notificationBody,
                silent: false,
                timeout: 5000
            });
        }
    }

    // --- Timeline Feature ---
    const TIMELINE_CSS_ID = "claude-timeline-styles";
    const TIMELINE_HTML_ID_PREFIX = "claude-timeline-root-";
    let timeline_messages = [];
    let timeline_messages_ids_hash = "";
    let timeline_currentMessageIndex = -1;
    let timeline_chatScrollContainer;
    let timeline_chatScrollContainerTop = 0;
    let timeline_mainElementResizeObserver = null;
    let timeline_domObserver = null;
    let timeline_intersectionObserver = null;
    let timeline_initialized = false;

    const TIMELINE_MESSAGE_THRESHOLD_FOR_EXPANSION = 30;
    const TIMELINE_MAX_MESSAGES_PER_SIDEBAR = 60;
    const TIMELINE_SIDEBAR_SPACING_PX = 12;
    const TIMELINE_SIDEBAR_VISUAL_WIDTH_PX = 30;

    const TIMELINE_DEFAULT_TOP_VH = 15;
    const TIMELINE_DEFAULT_HEIGHT_VH = 60;
    const TIMELINE_EXPANDED_TOP_OFFSET_PX = 60;
    const TIMELINE_EXPANDED_BOTTOM_OFFSET_PX = 90;

    function _getTimelineLayoutConfig() {
        let numSidebars = 0;
        if (timeline_messages.length > 0) {
            numSidebars = Math.ceil(timeline_messages.length / TIMELINE_MAX_MESSAGES_PER_SIDEBAR);
        }
        const messagesPerEffectiveSidebar = (numSidebars > 0) ? Math.ceil(timeline_messages.length / numSidebars) : 0;
        return { numSidebars, messagesPerEffectiveSidebar };
    }

    const TIMELINE_HIDDEN_CLASS = 'claude-timeline-hidden';
    const getTimelineSidebarHtml = (index) => `<div id="${TIMELINE_HTML_ID_PREFIX}${index}" class="claude-timeline-sidebar-instance ${TIMELINE_HIDDEN_CLASS}"><ul class="claude-dots"></ul></div>`;

    function timeline_ensureSidebarDivs(targetCount) {
        const existingSidebars = document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"]`);

        for (let i = existingSidebars.length - 1; i >= targetCount; i--) {
            existingSidebars[i].remove();
        }

        const fragment = document.createDocumentFragment();
        for (let i = existingSidebars.length; i < targetCount; i++) {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = getTimelineSidebarHtml(i).trim();
            const sidebarElement = tempContainer.firstChild;
            if (sidebarElement) fragment.appendChild(sidebarElement);
        }
        if (fragment.childNodes.length > 0) {
            document.body.appendChild(fragment);
        }
    }

    function getTimelineCSS() {
        const isDark = isDarkModeActive();
        return `
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] {
                position: fixed !important;
                width: 4px !important;
                background-color: ${isDark ? '#555' : '#B0B0B0'} !important;
                z-index: 2147483640 !important;
                border-radius: 2px !important;
                transition: opacity 0.3s, right 0.3s ease-out, top 0.3s ease-out, height 0.3s ease-out;
            }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"].${TIMELINE_HIDDEN_CLASS} { opacity: 0 !important; pointer-events: none !important; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots { margin: 0 !important; padding: 0 !important; list-style: none !important; position: relative !important; height: 100% !important; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li { position: absolute !important; left: 50% !important; transform: translateX(-50%) !important; width: 10px !important; height: 10px !important; padding: 4px !important; box-sizing: content-box !important; border-radius: 50% !important; cursor: pointer !important; transition: width 0.2s ease-in-out, height 0.2s ease-in-out, background-color 0.2s ease-in-out, transform 0.2s ease-in-out; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li::before { content: ''; position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; background-color: ${isDark ? '#888' : 'grey'}; border-radius: 50%; transform: translate(-50%, -50%); transition: width 0.2s ease-in-out, height 0.2s ease-in-out, background-color 0.2s ease-in-out; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li.user::before { background-color: ${isDark ? '#67A36A' : '#4CAF50'} !important; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li.assistant::before { background-color: ${isDark ? '#3B82F6' : '#0d6efd'} !important; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li.active::before { width: 12px !important; height: 12px !important; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li span {
                position: absolute !important; white-space: nowrap !important; font-size: 11px !important;
                left: 16px !important;
                top: 50% !important; transform: translateY(-50%) !important;
                color: ${isDark ? '#D0D0D0' : 'grey'} !important;
                background-color: ${isDark ? 'rgba(40, 40, 40, 0.85)' : 'rgba(255, 255, 255, 0.75)'} !important;
                padding: 1px 3px !important; border-radius: 2px !important; pointer-events: none;
            }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li.endpoint-number span { color: ${isDark ? '#F0F0F0' : 'black'} !important; font-weight: bold; }
            div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li:not(.endpoint-number) span { opacity: 0.75 !important; }
        `;
    }

    function timeline_injectCSS_local() {
        injectStyles(TIMELINE_CSS_ID, getTimelineCSS());
    }

    function getChatScrollContainer() {
        // Try the known Claude attribute first
        const known = document.querySelector('[data-autoscroll-container="true"]');
        if (known && known.scrollHeight > known.clientHeight + 50) return known;
        // Fallback: find an .overflow-y-auto element with significant scroll, positioned to the right
        return Array.from(document.querySelectorAll('.overflow-y-auto')).find(el => {
            const rect = el.getBoundingClientRect();
            return el.scrollHeight > el.clientHeight + 100 && rect.x > 200 && rect.height > 200;
        });
    }

    function timeline_updateTimelinePositionAndVisibility() {
        const scrollContainer = getChatScrollContainer();
        const mainElement = scrollContainer || document.querySelector('main');
        if (!mainElement) {
            document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"]`).forEach(el => el.classList.add(TIMELINE_HIDDEN_CLASS));
            return;
        }

        const containerRect = mainElement.getBoundingClientRect();
        // Anchor to the right side of the chat scroll container
        const baseRightOffset = Math.max(window.innerWidth - containerRect.right + 15, 8);

        const { numSidebars, messagesPerEffectiveSidebar } = _getTimelineLayoutConfig();

        for (let s = 0; s < numSidebars; s++) {
            const navigatorRoot = document.getElementById(`${TIMELINE_HTML_ID_PREFIX}${s}`);
            if (!navigatorRoot) continue;

            const currentRight = baseRightOffset + s * (TIMELINE_SIDEBAR_VISUAL_WIDTH_PX + TIMELINE_SIDEBAR_SPACING_PX);
            navigatorRoot.style.right = currentRight + 'px';
            navigatorRoot.style.left = 'auto';

            const startIndex = s * messagesPerEffectiveSidebar;
            const endIndex = Math.min(startIndex + messagesPerEffectiveSidebar, timeline_messages.length);
            const numMessagesInThisSidebar = endIndex - startIndex;

            if (numMessagesInThisSidebar > TIMELINE_MESSAGE_THRESHOLD_FOR_EXPANSION) {
                const newTop = TIMELINE_EXPANDED_TOP_OFFSET_PX;
                const newHeight = window.innerHeight - TIMELINE_EXPANDED_TOP_OFFSET_PX - TIMELINE_EXPANDED_BOTTOM_OFFSET_PX;
                navigatorRoot.style.top = newTop + 'px';
                navigatorRoot.style.height = newHeight + 'px';
            } else {
                // Use actual container rect rather than vh fallback
                const top = Math.max(containerRect.top + (containerRect.height * 0.1), 60);
                const height = Math.max(containerRect.height * 0.7, 200);
                navigatorRoot.style.top = top + 'px';
                navigatorRoot.style.height = height + 'px';
            }

            if (timeline_messages.length > 0 && timeline_chatScrollContainer && timeline_chatScrollContainer.length && timeline_chatScrollContainer.get(0).isConnected) {
                navigatorRoot.classList.remove(TIMELINE_HIDDEN_CLASS);
            } else {
                navigatorRoot.classList.add(TIMELINE_HIDDEN_CLASS);
            }
        }

        document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"]`).forEach((el, index) => {
            if (index >= numSidebars) {
                el.classList.add(TIMELINE_HIDDEN_CLASS);
            }
        });
    }

    function generateMessagesIdsHash(messagesArray) {
        if (!messagesArray || messagesArray.length === 0) return "";
        return messagesArray.map(msg => msg.id).join(',');
    }

    function timeline_findScrollableAncestor(startEl) {
        // Use the same robust detection used for positioning
        const detected = getChatScrollContainer();
        if (detected) return detected;

        let current = startEl;
        while (current && current !== document.body && current !== document.documentElement) {
            if (current.nodeType !== 1) {
                current = current.parentElement;
                continue;
            }
            const style = window.getComputedStyle(current);
            const overflowY = style.overflowY || '';
            const isScrollableOverflow = overflowY.includes('auto') || overflowY.includes('scroll');
            if (isScrollableOverflow && current.scrollHeight > current.clientHeight + 16) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    function timeline_findChatElements() {
        const turnEls = findTurnContainers();

        if (!turnEls.length) {
            timeline_chatScrollContainer = $();
            if (timeline_messages.length > 0) {
                timeline_messages = [];
                timeline_messages_ids_hash = "";
                return true;
            }
            timeline_messages_ids_hash = "";
            return false;
        }

        const scrollContainerEl = timeline_findScrollableAncestor(turnEls[0]) || document.querySelector('main') || document.scrollingElement;
        timeline_chatScrollContainer = scrollContainerEl ? $(scrollContainerEl) : $();
        if (timeline_chatScrollContainer && timeline_chatScrollContainer.length && timeline_chatScrollContainer.get(0).isConnected) {
            timeline_chatScrollContainerTop = timeline_chatScrollContainer.get(0).getBoundingClientRect().top;
        } else {
            timeline_chatScrollContainerTop = 0;
        }

        const newMessages = turnEls.map((turnEl, index) => {
            const role = detectTurnRole(turnEl);
            // No data-message-id in Claude - use h2.sr-only text or index
            const h2 = turnEl.querySelector('h2.sr-only, h2[class*="sr-only"]');
            const h2Text = h2 ? (h2.textContent || '').trim().substring(0, 50) : '';
            const id = `${role}-${index}-${h2Text}`;
            return { element: $(turnEl), role, id };
        }).filter(msg => msg && msg.element && msg.element.length > 0 && msg.id);

        const newIdsHash = generateMessagesIdsHash(newMessages);

        if (newIdsHash === timeline_messages_ids_hash) {
            if (newMessages.length === timeline_messages.length) {
                let elementsChanged = false;
                for(let i=0; i < newMessages.length; i++) {
                    if (!timeline_messages[i] || !timeline_messages[i].element || !newMessages[i].element ||
                        timeline_messages[i].element.get(0) !== newMessages[i].element.get(0)) {
                        timeline_messages[i].element = newMessages[i].element;
                        elementsChanged = true;
                    }
                    if (timeline_messages[i] && timeline_messages[i].role !== newMessages[i].role) {
                        timeline_messages[i].role = newMessages[i].role;
                        elementsChanged = true;
                    }
                }
                if (elementsChanged) return true;
            } else {
                 timeline_messages = newMessages;
                 timeline_messages_ids_hash = newIdsHash;
                 return true;
            }
            return false;
        }

        timeline_messages = newMessages;
        timeline_messages_ids_hash = newIdsHash;
        debugLog('Timeline - Message structure updated.', timeline_messages.length, 'messages found.');
        return true;
    }

    function timeline_renderDots() {
        if (timeline_intersectionObserver) { timeline_intersectionObserver.disconnect(); }

        const { numSidebars, messagesPerEffectiveSidebar } = _getTimelineLayoutConfig();
        timeline_ensureSidebarDivs(numSidebars);

        if (numSidebars === 0) {
            document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots`).forEach(ul => ul.innerHTML = '');
            timeline_updateTimelinePositionAndVisibility();
            return;
        }

        for (let s = 0; s < numSidebars; s++) {
            const dotsUl = document.querySelector(`#${TIMELINE_HTML_ID_PREFIX}${s} .claude-dots`);
            if (!dotsUl) continue;
            dotsUl.innerHTML = '';

            const startIndex = s * messagesPerEffectiveSidebar;
            const endIndex = Math.min(startIndex + messagesPerEffectiveSidebar, timeline_messages.length);
            const numMessagesInThisSidebar = endIndex - startIndex;

            for (let i = startIndex; i < endIndex; i++) {
                const msgData = timeline_messages[i];
                const localIndex = i - startIndex;

                const li = document.createElement('li');
                li.classList.add(msgData.role === 'assistant' ? 'assistant' : 'user');
                li.setAttribute('data-idx', String(i));
                li.setAttribute('title', `הודעה ${i+1} (${msgData.role})`);

                if (i === 0 || i === timeline_messages.length - 1) {
                    li.classList.add('endpoint-number');
                }

                let topPercentage = 0;
                if (numMessagesInThisSidebar === 1) {
                    topPercentage = 50;
                } else if (numMessagesInThisSidebar > 1) {
                    topPercentage = (localIndex / (numMessagesInThisSidebar - 1)) * 100;
                }
                li.style.top = topPercentage + '%';
                const span = document.createElement('span');
                span.textContent = String(i+1);
                li.appendChild(span);
                dotsUl.appendChild(li);
            }
        }
        timeline_updateTimelinePositionAndVisibility();
        timeline_updateTimelineState(false);
        if (pageVisible && currentSettings.enableTimelineSidebar) { timeline_setupIntersectionObserver(); }
    }

    function timeline_updateTimelineState(isScrollingEvent = true) {
        const { numSidebars, messagesPerEffectiveSidebar } = _getTimelineLayoutConfig();
        const allDotsLi = document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li`);

        if (timeline_messages.length === 0 || !timeline_chatScrollContainer || !timeline_chatScrollContainer.length || !timeline_chatScrollContainer.get(0).isConnected || numSidebars === 0) {
            allDotsLi.forEach(li => li.classList.remove('active'));
            timeline_currentMessageIndex = -1; return;
        }
        timeline_chatScrollContainerTop = timeline_chatScrollContainer.get(0).getBoundingClientRect().top;

        const containerScrollTop = timeline_chatScrollContainer.scrollTop(), containerVisibleHeight = timeline_chatScrollContainer.innerHeight();
        let bestMatchIndex = -1, smallestPositiveOffset = Infinity;
        const visibilityThreshold = 0.3;

        for (let i = 0; i < timeline_messages.length; i++) {
            const msg = timeline_messages[i].element; if (!msg || !msg.length) continue;
            const msgDomElement = msg.get(0); if (!msgDomElement || !msgDomElement.isConnected) continue;

            const msgRect = msgDomElement.getBoundingClientRect(), msgHeight = msgRect.height; if (msgHeight === 0) continue;

            const msgTopRel = msgRect.top - timeline_chatScrollContainerTop;
            const msgBottomRel = msgTopRel + msgHeight;

            const visibleHeightInContainer = Math.min(containerVisibleHeight, msgBottomRel) - Math.max(0, msgTopRel);
            const visiblePortion = visibleHeightInContainer / msgHeight;

            if (visiblePortion >= visibilityThreshold) {
                if (msgTopRel >= -(msgHeight * (1 - visibilityThreshold)) && msgTopRel < smallestPositiveOffset) {
                     smallestPositiveOffset = msgTopRel; bestMatchIndex = i;
                } else if (bestMatchIndex === -1) {
                    bestMatchIndex = i;
                }
            }
        }
        if (bestMatchIndex === -1 && timeline_messages.length > 0) {
            if (timeline_currentMessageIndex !== -1 && timeline_currentMessageIndex < timeline_messages.length) {
                 const prevMsgEl = timeline_messages[timeline_currentMessageIndex].element.get(0);
                 if (prevMsgEl && prevMsgEl.isConnected) {
                    const prevRect = prevMsgEl.getBoundingClientRect();
                    if ((prevRect.top - timeline_chatScrollContainerTop + prevRect.height) > 0 && (prevRect.top - timeline_chatScrollContainerTop) < containerVisibleHeight) {
                        bestMatchIndex = timeline_currentMessageIndex;
                    }
                 }
            }
            if (bestMatchIndex === -1) {
                if (containerScrollTop <= 10) bestMatchIndex = 0;
                else if (containerScrollTop + containerVisibleHeight >= timeline_chatScrollContainer.get(0).scrollHeight - 20) bestMatchIndex = timeline_messages.length - 1;
                else bestMatchIndex = (timeline_currentMessageIndex >= 0 && timeline_currentMessageIndex < timeline_messages.length) ? timeline_currentMessageIndex : 0;
            }
        }

        bestMatchIndex = timeline_messages.length > 0 ? Math.max(0, Math.min(bestMatchIndex, timeline_messages.length - 1)) : -1;

        let activeDotExists = false;
        allDotsLi.forEach(li => { if (li.classList.contains('active')) activeDotExists = true; });

        if (bestMatchIndex !== -1 && (timeline_currentMessageIndex !== bestMatchIndex || !activeDotExists) ) {
            timeline_currentMessageIndex = bestMatchIndex;
            allDotsLi.forEach(li => li.classList.remove('active'));

            if (messagesPerEffectiveSidebar > 0) {
                const targetSidebarIndex = Math.floor(timeline_currentMessageIndex / messagesPerEffectiveSidebar);
                const localIndexInSidebar = timeline_currentMessageIndex % messagesPerEffectiveSidebar;
                 if(targetSidebarIndex < numSidebars){
                    const targetLi = document.querySelector(`#${TIMELINE_HTML_ID_PREFIX}${targetSidebarIndex} .claude-dots li:nth-child(${localIndexInSidebar + 1})`);
                    if (targetLi) targetLi.classList.add('active');
                }
            }
        } else if (bestMatchIndex === -1 && timeline_currentMessageIndex !== -1) {
            allDotsLi.forEach(li => li.classList.remove('active'));
            timeline_currentMessageIndex = -1;
        }
    }

    function timeline_setupIntersectionObserver(){
        if (!pageVisible || !currentSettings.enableTimelineSidebar) {
            if (timeline_intersectionObserver) timeline_intersectionObserver.disconnect();
            return;
        }
        if (!('IntersectionObserver' in window)) return;
        if (timeline_intersectionObserver) timeline_intersectionObserver.disconnect();

        const rootEl = timeline_chatScrollContainer && timeline_chatScrollContainer.length ? timeline_chatScrollContainer.get(0) : null;
        const useViewportRoot = !rootEl || rootEl === document.body || rootEl === document.documentElement || rootEl === document.scrollingElement;
        if (!rootEl || timeline_messages.length === 0) return;
        const io_options = { root: useViewportRoot ? null : rootEl, rootMargin: '0px', threshold: 0.35 };
        timeline_intersectionObserver = new IntersectionObserver((entries) => {
            if(!pageVisible || !currentSettings.enableTimelineSidebar) return;
            let bestEntry = null;
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
                        bestEntry = entry;
                    }
                }
            });
            if (bestEntry) {
                 const idx = parseInt(bestEntry.target.getAttribute('data-claude-idx'));
                 if (!isNaN(idx) && idx < timeline_messages.length) {
                    let activeDotNeedsUpdate = false;
                    const currentActiveDot = document.querySelector(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li.active`);
                    if (!currentActiveDot || (currentActiveDot && parseInt(currentActiveDot.getAttribute('data-idx')) !== idx)) {
                        activeDotNeedsUpdate = true;
                    }

                    if (idx !== timeline_currentMessageIndex || activeDotNeedsUpdate) {
                        timeline_currentMessageIndex = idx;
                        document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li`).forEach(li => li.classList.remove('active'));

                        const { messagesPerEffectiveSidebar, numSidebars } = _getTimelineLayoutConfig();
                        if (messagesPerEffectiveSidebar > 0) {
                            const targetSidebarIndex = Math.floor(idx / messagesPerEffectiveSidebar);
                            const localIndexInSidebar = idx % messagesPerEffectiveSidebar;
                            if(targetSidebarIndex < numSidebars){
                                const targetLi = document.querySelector(`#${TIMELINE_HTML_ID_PREFIX}${targetSidebarIndex} .claude-dots li:nth-child(${localIndexInSidebar + 1})`);
                                if (targetLi) targetLi.classList.add('active');
                            }
                        }
                    }
                 }
            }
        }, io_options);

        timeline_messages.forEach((msgData, i) => {
            if (msgData.element && msgData.element.length && msgData.element.get(0)) {
                const domEl = msgData.element.get(0);
                domEl.setAttribute('data-claude-idx', i.toString());
                timeline_intersectionObserver.observe(domEl);
            }
        });
    }

    function timeline_scrollToMessage(index, smooth = true) {
        if (index >= 0 && index < timeline_messages.length) {
            const messageEl = timeline_messages[index].element;
            if (messageEl && messageEl.length && messageEl.get(0) && messageEl.get(0).isConnected) {
                const messageDomElement = messageEl.get(0);

                if (timeline_currentMessageIndex !== index) {
                    timeline_currentMessageIndex = index;
                    document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li`).forEach(li => li.classList.remove('active'));
                    const { messagesPerEffectiveSidebar, numSidebars } = _getTimelineLayoutConfig();
                     if (messagesPerEffectiveSidebar > 0) {
                        const targetSidebarIndex = Math.floor(index / messagesPerEffectiveSidebar);
                        const localIndexInSidebar = index % messagesPerEffectiveSidebar;
                        if(targetSidebarIndex < numSidebars){
                            const targetLi = document.querySelector(`#${TIMELINE_HTML_ID_PREFIX}${targetSidebarIndex} .claude-dots li:nth-child(${localIndexInSidebar + 1})`);
                            if (targetLi) targetLi.classList.add('active');
                        }
                     }
                }

                messageDomElement.scrollIntoView({
                    behavior: smooth ? 'smooth' : 'auto',
                    block: 'center'
                });
            } else {
                if(timeline_findChatElements()) timeline_renderDots();
            }
        }
    }

    function timeline_setupDOMObserver() {
        if (timeline_domObserver) timeline_domObserver.disconnect();
        const observerTargetNode = document.body;
        timeline_domObserver = new MutationObserver(debounce((mutationsList) => {
            if (!currentSettings.enableTimelineSidebar || !pageVisible) return;
            let refreshNeeded = false;

            for (const mutation of mutationsList) {
                if (mutation.target.tagName === 'MAIN' ||
                    (mutation.target.parentElement && mutation.target.parentElement.tagName === 'MAIN') ||
                    Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && (
                        node.matches?.('[data-testid="user-message"], [data-is-streaming]') ||
                        node.querySelector?.('[data-testid="user-message"], [data-is-streaming]')
                    )) ||
                    Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && (
                        node.matches?.('[data-testid="user-message"], [data-is-streaming]') ||
                        node.querySelector?.('[data-testid="user-message"], [data-is-streaming]')
                    ))) {
                     refreshNeeded = true; break;
                }
                if ((!timeline_chatScrollContainer || !timeline_chatScrollContainer.length) &&
                    (mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length))) {
                     refreshNeeded = true; break;
                }
                if (mutation.type === 'childList' && Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.id && node.id.startsWith(TIMELINE_HTML_ID_PREFIX))) {
                    refreshNeeded = true; break;
                }
            }

            if (refreshNeeded) {
                const messagesHaveChangedStructurally = timeline_findChatElements();

                if (messagesHaveChangedStructurally || (document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"]`).length === 0 && timeline_messages.length > 0) ) {
                    timeline_currentMessageIndex = -1;
                    timeline_renderDots();
                } else if (timeline_messages.length > 0 && !document.querySelector(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li.active`)) {
                    timeline_updateTimelineState(false);
                } else if (timeline_messages.length === 0 && document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li`).length > 0) {
                    timeline_renderDots();
                } else {
                    timeline_updateTimelinePositionAndVisibility();
                }
            }
        }, 500));

        if (pageVisible && currentSettings.enableTimelineSidebar) {
            try { timeline_domObserver.observe(observerTargetNode, { childList: true, subtree: true }); } catch (e) {}
        }
    }

    function timeline_setupResizeObserver() {
        if (timeline_mainElementResizeObserver) timeline_mainElementResizeObserver.disconnect();
        const mainEl = document.querySelector('main');
        const windowEl = window;

        const debouncedUpdate = debounce(timeline_updateTimelinePositionAndVisibility, 200);

        if (mainEl) {
            timeline_mainElementResizeObserver = new ResizeObserver(debouncedUpdate);
            try {
                timeline_mainElementResizeObserver.observe(mainEl);
            } catch (e) {
                timeline_mainElementResizeObserver = null;
            }
        }
        $(windowEl).off('resize.claudetimeline').on('resize.claudetimeline', debouncedUpdate);
    }

    function timeline_cleanup() {
        timeline_ensureSidebarDivs(0);
        const cssEl = document.getElementById(TIMELINE_CSS_ID);
        if (cssEl) cssEl.remove();

        if (timeline_domObserver) { timeline_domObserver.disconnect(); timeline_domObserver = null; }
        if (timeline_mainElementResizeObserver) { timeline_mainElementResizeObserver.disconnect(); timeline_mainElementResizeObserver = null; }
        if (timeline_intersectionObserver) { timeline_intersectionObserver.disconnect(); timeline_intersectionObserver = null; }
        $(window).off('resize.claudetimeline');

        timeline_messages = [];
        timeline_messages_ids_hash = "";
        timeline_currentMessageIndex = -1;
        timeline_initialized = false;
    }

    function initializeActualTimelineLogic() {
        if (!pageVisible || !currentSettings.enableTimelineSidebar) return;

        timeline_injectCSS_local();

        $(document.body).off('click.claudeTimelineDots').on('click.claudeTimelineDots', `div[id^="${TIMELINE_HTML_ID_PREFIX}"] .claude-dots li`, function(e){
            e.stopPropagation();
            const idx = parseInt($(this).attr('data-idx'));
            if (!isNaN(idx)) {
                timeline_scrollToMessage(idx, true);
            }
        });

        if (timeline_findChatElements() || timeline_messages.length === 0) {
            timeline_renderDots();
        }
        timeline_setupDOMObserver();
        timeline_setupResizeObserver();
        timeline_initialized = true;
    }

    function initializeTimelineFeatureWrapper() {
        if (currentSettings.enableTimelineSidebar) {
            if (!timeline_initialized) {
                if ('requestIdleCallback' in window){
                    requestIdleCallback(initializeActualTimelineLogic, { timeout: 2000 });
                } else {
                    setTimeout(initializeActualTimelineLogic, 1500);
                }
            } else {
                 timeline_injectCSS_local();
                 if (timeline_findChatElements() || (document.querySelectorAll(`div[id^="${TIMELINE_HTML_ID_PREFIX}"]`).length === 0 && timeline_messages.length > 0) ) {
                    timeline_renderDots();
                 } else {
                    timeline_updateTimelinePositionAndVisibility();
                 }
                 if (pageVisible) {
                    if (!timeline_domObserver) timeline_setupDOMObserver();
                    else { try { timeline_domObserver.observe(document.body, { childList: true, subtree: true }); } catch(e) {} }

                    const mainEl = document.querySelector('main');
                    if (!timeline_mainElementResizeObserver && mainEl) timeline_setupResizeObserver();
                    else if (timeline_mainElementResizeObserver && mainEl) { try {timeline_mainElementResizeObserver.observe(mainEl);} catch(e){} }

                    timeline_setupIntersectionObserver();
                 }
            }
        } else {
            timeline_cleanup();
        }
    }

    // --- Settings Dialog ---
    function openSettingsDialog() {
        const DIALOG_ID = 'claude-userscript-settings-dialog';
        let dialog = document.getElementById(DIALOG_ID);
        if (dialog) {
            if (isDarkModeActive()) dialog.classList.add('claude-settings-dark');
            else dialog.classList.remove('claude-settings-dark');
            dialog.style.display = 'block';
        } else {
            dialog = document.createElement('div');
            dialog.id = DIALOG_ID;
            if (isDarkModeActive()) {
                dialog.classList.add('claude-settings-dark');
            }
            dialog.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                padding: 25px; z-index: 2147483647;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); border-radius: 8px; direction: rtl; text-align: right;
                width: 450px; font-family: sans-serif; max-height: 80vh; overflow-y: auto;
                background-color: white; border: 1px solid #ccc;
            `;
            dialog.innerHTML = `
                <h3 style="margin-top:0; margin-bottom:20px; border-bottom: 1px solid #eee; padding-bottom:10px; font-size: 1.2em;">הגדרות כלי עזר וסרגל צד - Claude</h3>
                <div style="margin-bottom: 12px;"><input type="checkbox" id="setting-enable-styling" style="margin-left: 8px; vertical-align: middle;"><label for="setting-enable-styling" style="vertical-align: middle; cursor:pointer;">הפעל עיצוב בועות ו-RTL</label></div>
                <div style="margin-bottom: 12px;"><input type="checkbox" id="setting-enable-copy-button" style="margin-left: 8px; vertical-align: middle;"><label for="setting-enable-copy-button" style="vertical-align: middle; cursor:pointer;">הפעל כפתורי "העתק שיחה" ו"שמור לקובץ"</label></div>
                <div style="margin-bottom: 12px;"><input type="checkbox" id="setting-enable-timeline-sidebar" style="margin-left: 8px; vertical-align: middle;"><label for="setting-enable-timeline-sidebar" style="vertical-align: middle; cursor:pointer;">הפעל סרגל צד לניווט (Timeline)</label></div>
                <div style="margin-bottom: 20px;"><input type="checkbox" id="setting-enable-ai-notifications" style="margin-left: 8px; vertical-align: middle;"><label for="setting-enable-ai-notifications" style="vertical-align: middle; cursor:pointer;">הפעל התראות קוליות וחזותיות על הודעות AI חדשות</label></div>
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">התראות שולחן עבודה</h4>
                    <button id="request-notification-permission" style="padding: 6px 12px; border-radius: 4px; cursor: pointer; border: 1px solid #888; background: #f0f0f0;">בקש אישור להתראות</button>
                </div>
                <div style="text-align:left;">
                  <button id="settings-save-button" style="color: white; border: none; padding: 10px 18px; border-radius: 5px; cursor: pointer; margin-left: 10px; font-size: 0.95em; background-color: #10a37f;">שמור וסגור</button>
                  <button id="settings-cancel-button" style="color: white; border: none; padding: 10px 18px; border-radius: 5px; cursor: pointer; font-size: 0.95em; background-color: #aaa;">ביטול</button>
                </div>
                <p style="font-size:0.85em; color:#555; margin-top:20px; margin-bottom:0;">שינויים יחולו במלואם לאחר רענון הדף או מיידית במידת האפשר.</p>
            `;
            document.body.appendChild(dialog);

            document.getElementById('request-notification-permission').addEventListener('click', () => {
                if (!('Notification' in window)) {
                    alert('התראות שולחן עבודה אינן נתמכות בדפדפן זה.');
                    return;
                }
                Notification.requestPermission().then(() => {
                    updateNotificationButton();
                });
            });

            function updateNotificationButton() {
                const btn = document.getElementById('request-notification-permission');
                if (!btn) return;
                if (!('Notification' in window)) {
                    btn.textContent = 'התראות אינן נתמכות';
                    btn.disabled = true;
                    return;
                }
                if (Notification.permission === 'granted') {
                    btn.textContent = '✅ התראות שולחן עבודה מאושרות';
                    btn.disabled = true;
                } else if (Notification.permission === 'denied') {
                    btn.textContent = '❌ התראות שולחן עבודה נחסמו';
                    btn.disabled = true;
                } else {
                    btn.textContent = 'לחץ לאישור התראות שולחן עבודה';
                    btn.disabled = false;
                }
            }
            updateNotificationButton();

            document.getElementById('settings-save-button').addEventListener('click', () => {
                currentSettings.enableStyling = document.getElementById('setting-enable-styling').checked;
                currentSettings.enableCopyButton = document.getElementById('setting-enable-copy-button').checked;
                currentSettings.enableTimelineSidebar = document.getElementById('setting-enable-timeline-sidebar').checked;
                currentSettings.enableAiMessageNotifications = document.getElementById('setting-enable-ai-notifications').checked;
                GM_setValue(SETTINGS_KEYS.enableStyling, currentSettings.enableStyling);
                GM_setValue(SETTINGS_KEYS.enableCopyButton, currentSettings.enableCopyButton);
                GM_setValue(SETTINGS_KEYS.enableTimelineSidebar, currentSettings.enableTimelineSidebar);
                GM_setValue(SETTINGS_KEYS.enableAiMessageNotifications, currentSettings.enableAiMessageNotifications);

                const currentDialog = document.getElementById(DIALOG_ID);
                if(currentDialog) currentDialog.style.display = 'none';

                GM_notification({ title: 'הגדרות נשמרו', text: 'חלק מהשינויים עשויים לדרוש רענון דף.', silent: true, timeout: 4000 });

                applyStylesOnLoad();
                initializeCopyButtonFeature();
                initializeTimelineFeatureWrapper();
                initializeAiNotificationsFeature();
            });
            document.getElementById('settings-cancel-button').addEventListener('click', () => {
                const currentDialog = document.getElementById(DIALOG_ID);
                if(currentDialog) currentDialog.style.display = 'none';
            });
        }
        document.getElementById('setting-enable-styling').checked = currentSettings.enableStyling;
        document.getElementById('setting-enable-copy-button').checked = currentSettings.enableCopyButton;
        document.getElementById('setting-enable-timeline-sidebar').checked = currentSettings.enableTimelineSidebar;
        document.getElementById('setting-enable-ai-notifications').checked = currentSettings.enableAiMessageNotifications;
    }

    // --- Theme Watcher ---
    let themeWatcherObserver = null;
    function initializeThemeWatcher() {
        if (themeWatcherObserver) themeWatcherObserver.disconnect();
        const htmlElement = document.documentElement;
        if (!htmlElement) return;
        themeWatcherObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && (mutation.attributeName === 'data-mode' || mutation.attributeName === 'class')) {
                    debugLog('HTML mode attribute changed. Re-applying styles.');
                    applyStylesOnLoad();
                    if (currentSettings.enableTimelineSidebar && timeline_initialized) {
                        timeline_injectCSS_local();
                        timeline_updateTimelinePositionAndVisibility();
                    }
                    const settingsDialog = document.getElementById('claude-userscript-settings-dialog');
                    if (settingsDialog && settingsDialog.style.display === 'block') {
                        if (isDarkModeActive()) settingsDialog.classList.add('claude-settings-dark');
                        else settingsDialog.classList.remove('claude-settings-dark');
                    }
                    return;
                }
            }
        });
        themeWatcherObserver.observe(htmlElement, { attributes: true, attributeFilter: ['data-mode', 'class'] });
    }

    // --- Main Initialization ---
    function main() {
        loadSettings();

        applyStylesOnLoad();
        initializeCopyButtonFeature();
        initializeTimelineFeatureWrapper();
        initializeAiNotificationsFeature();
        initializeThemeWatcher();
        GM_registerMenuCommand('הגדרות כלי עזר וסרגל צד', openSettingsDialog);
        GM_registerMenuCommand('🔔 בדוק התראות (לבדיקה)', () => {
            playNotificationSound('זוהי בדיקת התראה - אם אתה שומע/רואה את זה, ההתראות עובדות!');
        });

        document.addEventListener('visibilitychange', ()=>{
            const oldPageVisible = pageVisible;
            pageVisible = !document.hidden;

            if (!pageVisible && notificationAwaitingResponse) {
                notificationPendingWasInBackground = true;
                updateNotificationPolling();
            }

            if (pageVisible && !oldPageVisible) {
                if (currentSettings.enableAiMessageNotifications) {
                    checkForNewAiResponse();
                    updateNotificationPolling();
                }
                if (currentSettings.enableCopyButton) {
                     if (!copyButtonObserver && document.querySelector(ACTIONS_CONTAINER_SELECTOR)) attemptToSetupCopyButtonObserver();
                     else if (copyButtonObserver && document.querySelector(ACTIONS_CONTAINER_SELECTOR)) { try { copyButtonObserver.observe(document.querySelector(ACTIONS_CONTAINER_SELECTOR), { childList: true, subtree: true }); } catch(e) {} }
                     if (window.__claudeCopyBtnBodyObserver) { try { window.__claudeCopyBtnBodyObserver.observe(document.body, { childList: true, subtree: true }); } catch(e) {} }
                }
                if (currentSettings.enableTimelineSidebar) {
                    if (!timeline_initialized) {
                        initializeTimelineFeatureWrapper();
                    } else {
                        timeline_updateTimelinePositionAndVisibility();
                        if (timeline_domObserver) { try { timeline_domObserver.observe(document.body, { childList: true, subtree: true }); } catch(e) {} }
                        else timeline_setupDOMObserver();

                        const mainEl = document.querySelector('main');
                        if (timeline_mainElementResizeObserver && mainEl) { try { timeline_mainElementResizeObserver.observe(mainEl); } catch(e){} }
                        else if(mainEl) timeline_setupResizeObserver();

                        timeline_setupIntersectionObserver();
                    }
                }
            } else if (!pageVisible && oldPageVisible) {
                if (currentSettings.enableAiMessageNotifications) {
                    updateNotificationPolling();
                }
                if (copyButtonObserver) { try { copyButtonObserver.disconnect(); } catch(e){} }
                if (window.__claudeCopyBtnBodyObserver) { try { window.__claudeCopyBtnBodyObserver.disconnect(); } catch(e){} }
                if (timeline_domObserver) { try { timeline_domObserver.disconnect(); } catch(e){} }
                if (timeline_mainElementResizeObserver) { try { timeline_mainElementResizeObserver.disconnect(); } catch(e) {} }
                if (timeline_intersectionObserver) { try { timeline_intersectionObserver.disconnect(); } catch(e){} }
            }
        });
        debugLog('Claude Script - Fully initialized.');
    }

    if (typeof $ === 'undefined' || typeof $.fn.jquery === 'undefined') {
        debugError("jQuery not loaded! Script cannot run.");
        if (typeof GM_notification === 'function') GM_notification({ title: 'שגיאת טעינה', text: 'jQuery לא נטען, התוסף לא יפעל.', silent: false, timeout: 10000 });
        return;
    }

    $(document).ready(function() {
         setTimeout(main, 750);
    });

})();
