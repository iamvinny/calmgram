// ==UserScript==
// @name         Instagram Calm Messages
// @namespace    local.instagram.calm
// @version      1.2.0
// @description  Neutral avatars and fewer social cues in Instagram Direct and floating chats.
// @match        https://www.instagram.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  // Avatar labels and message boundaries checked against the live Chrome DOM.
  // Receipt/activity matching remains best-effort across Instagram layouts.
  // No network interception: this does NOT prevent outgoing read receipts.
  const DEFAULTS = {
    enabled: true,
    avatars: true,
    receipts: true,
    activity: true,
    typing: true,
    motion: true,
  };
  const saved = GM_getValue('calm-settings', {});
  const settings = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof saved?.[key] === 'boolean') settings[key] = saved[key];
  }
  const ROOT = 'data-ig-calm';
  const HIDE = 'data-ig-calm-hide';
  const AVATAR = 'data-ig-calm-avatar';
  const MOTION = 'data-ig-calm-motion';
  const marked = new Set();
  const motionRoots = new Set();
  let frame = 0;
  let menuIds = [];

  const normalize = value => (value || '').replace(/\s+/g, ' ').trim();
  const avatarLabel = value => /\bprofile[ -](?:picture|photo)\b|\bfoto (?:do|de) perfil\b|\bimagem (?:do|de) perfil\b|\bfoto del perfil\b|\bphoto de profil\b/i.test(value);
  const duration = '(?:\\d+\\s*(?:s|m|h|d|w|min|mins|sec|secs|seconds?|minutes?|hours?|days?|weeks?|segundos?|minutos?|horas?|dias?|semanas?)(?:\\s+ago)?|yesterday|today|ontem|hoje|\\d{1,2}:\\d{2}(?:\\s*[ap]m)?)';
  const receipt = new RegExp('^(?:seen|viewed|visualizad[oa]|visto)(?:\\s+(?:(?:há|ha)\\s+)?' + duration + ')?[.]?$', 'i');
  const activity = new RegExp('^(?:active now|online|ativo agora|ativa agora|ativo hoje|ativa hoje|active today|active yesterday|(?:active|ativ[oa])\\s+(?:(?:há|ha)\\s+)?' + duration + ')$', 'i');
  const typing = /^(?:typing(?:\.{3}|…)?|digitando(?:\.{3}|…)?|escribiendo(?:\.{3}|…)?)$/i;
  // Live Instagram messages are DIVs with role=article, not <article> tags.
  // Exclude message contents explicitly, even when their text is just "Seen".
  const protectedArea = 'article,[role="article"],[contenteditable]:not([contenteditable="false"]),textarea,input,[role="textbox"],button,[role="button"],a,pre,code';

  function isAvatar(img) {
    const label = normalize(`${img.alt || ''} ${img.getAttribute('aria-label') || ''}`);
    if (avatarLabel(label) || /^User avatar$/i.test(normalize(img.alt))) return true;
    // The user's own Notes avatar has an empty alt in the inspected layout.
    return !label && !!img.closest('[role="navigation"][aria-label="Thread list"] ul [role="link"]');
  }

  function floatingChats() {
    const panels = new Set();
    // These three labels were observed in the launcher, chat list, and popup.
    // Only inspect ancestors of chat-specific images, not feed/profile photos.
    for (const img of document.querySelectorAll('img')) {
      if (!/^(?:user-profile-picture|User avatar|Instagram Avatar Profile Picture)$/i.test(img.alt)) continue;
      for (let parent = img.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (getComputedStyle(parent).position !== 'fixed') continue;
        const launcher = parent.querySelector('svg[aria-label="Messages"]');
        const panelControls = parent.querySelector('svg[aria-label="Expand"]') && parent.querySelector('svg[aria-label="Close"]');
        const conversation = parent.querySelector('[role="textbox"]') && parent.querySelector('[role="article"]');
        if (launcher || panelControls || conversation) panels.add(parent);
        break;
      }
    }
    return [...panels];
  }

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#e3e6e8"/><circle cx="32" cy="24" r="11" fill="#89939b"/><path d="M12 58c0-14 8-22 20-22s20 8 20 22" fill="#89939b"/></svg>';
  const avatarURL = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const style = document.createElement('style');
  style.textContent = `
    html[${ROOT}] [${HIDE}] { display: none !important; }
    html[${ROOT}] img[${AVATAR}] {
      object-position: -10000px -10000px !important;
      background-image: ${avatarURL} !important;
      background-size: 100% 100% !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-color: #e3e6e8 !important;
      border-radius: 50% !important;
    }
    [${MOTION}] *,
    [${MOTION}] *::before,
    [${MOTION}] *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  `;

  function mark(element, attribute) {
    element.setAttribute(attribute, '');
    marked.add(element);
  }

  function scan() {
    frame = 0;
    const root = document.documentElement;
    if (!root) return;
    if (!style.isConnected) root.append(style);
    const isDirect = /^\/direct(?:\/|$)/.test(location.pathname);
    const scopes = settings.enabled ? (isDirect ? [root] : floatingChats()) : [];
    root.toggleAttribute(ROOT, scopes.length > 0);
    for (const previous of motionRoots) previous.removeAttribute(MOTION);
    motionRoots.clear();
    if (settings.motion) {
      for (const scope of scopes) {
        scope.setAttribute(MOTION, '');
        motionRoots.add(scope);
      }
    }

    // Re-evaluate recycled React nodes and restore all changes on navigation
    // or when a setting is disabled. Never remove Instagram-owned elements.
    for (const element of marked) {
      element.removeAttribute(HIDE);
      element.removeAttribute(AVATAR);
    }
    marked.clear();
    if (!scopes.length) return;
    const scopedElements = selector => new Set(scopes.flatMap(scope => [...scope.querySelectorAll(selector)]));

    for (const img of scopedElements('img')) {
      if (!isAvatar(img)) continue;
      const width = img.getBoundingClientRect().width;
      // Tiny profile pictures below messages can themselves be seen markers.
      if (settings.receipts && (!isDirect || /^\/direct\/t\//.test(location.pathname)) && width > 0 && width <= 20) {
        mark(img, HIDE);
      } else if (settings.avatars) {
        mark(img, AVATAR);
      }
    }

    for (const element of scopedElements('span,small,div,svg[aria-label],[role="img"][aria-label]')) {
      if (element.closest(protectedArea)) continue;
      const isIcon = element.matches('svg,[role="img"]');
      if (!isIcon && element.children.length) continue;
      const label = normalize(isIcon ? element.getAttribute('aria-label') : element.textContent);
      if (!label || label.length > 70) continue;
      const isReceipt = settings.receipts && receipt.test(label);
      const isActivity = settings.activity && activity.test(label);
      const isTyping = settings.typing && typing.test(label);
      if (!isReceipt && !isActivity && !isTyping) continue;
      // Message contents are protected structurally above. Accept small status
      // captions up to 14px rather than missing those above the old 12.5px cap.
      const fontSize = parseFloat(getComputedStyle(element).fontSize);
      if (!isIcon && !(fontSize > 0 && fontSize <= 14)) continue;
      mark(element, HIDE);
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(scan);
  }

  function menus() {
    for (const id of menuIds) GM_unregisterMenuCommand(id);
    const labels = {
      enabled: 'Calm mode', avatars: 'Neutral profile photos',
      receipts: 'Hide seen indicators', activity: 'Hide activity status',
      typing: 'Hide typing indicators', motion: 'Reduce interface motion',
    };
    menuIds = Object.entries(labels).map(([key, label]) =>
      GM_registerMenuCommand(`${settings[key] ? '✓' : '○'} ${label}`, () => {
        settings[key] = !settings[key];
        GM_setValue('calm-settings', settings);
        menus();
        schedule();
      })
    );
  }

  // Observe only Instagram-owned attributes, avoiding observer loops caused
  // by this script's own markers. Coalesce DOM updates into one frame.
  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['alt', 'aria-label', 'src', 'class', 'style'],
  });
  window.addEventListener('popstate', schedule);
  window.addEventListener('resize', schedule);
  // Covers React pushState navigation without modifying Instagram's history API.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      schedule();
    }
  }, 750);
  menus();
  schedule();
})();

