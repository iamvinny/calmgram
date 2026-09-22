// ==UserScript==
// @name         Instagram Calm Messages
// @namespace    local.instagram.calm
// @version      1.3.5
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
    sidebar: false,
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
  const SIDEBAR = 'data-ig-calm-sidebar-hidden';
  const SIDEBAR_SELECTOR = '[role="navigation"][aria-label="Thread list"]';
  let sidebarButton;
  let sidebarRail;
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

  // Exact default-avatar JPEG supplied by the user; embedded to avoid CDN expiry.
  const avatarBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/7QCEUGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAGgcAigAYkZCTUQwYTAwMGE4MjAxMDAwMDhiMDIwMDAwNDcwMzAwMDA2MDAzMDAwMDgyMDMwMDAwMDEwNDAwMDAwOTA1MDAwMDZjMDUwMDAwOGIwNTAwMDBiMzA1MDAwMDM4MDcwMDAwAP/bAIQABQYGCwgLCwsLCw0LCwsNDg4NDQ4ODw0ODg4NDxAQEBEREBAQEA8TEhMPEBETFBQTERMWFhYTFhUVFhkWGRYWEgEFBQUKBwoICQkICwgKCAsKCgkJCgoMCQoJCgkMDQsKCwsKCw0MCwsICwsMDAwNDQwMDQoLCg0MDQ0MExQTExOc/8IAEQgAlgCWAwEiAAIRAQMRAf/EAE0AAQACAwEBAAAAAAAAAAAAAAACBwEDBgUEEAABAQUFBgUEAQUAAAAAAAABEQACITAxAyBBUXEEEGGBkaESQLHR8DJgwfETBRQVM+H/2gAMAwEAAgADAAAAAbdGcAAAAAAAAKit2oi3QAAAGNJvYyAAAKit2oi3QAAR5L5+flHZrJY39Tx7GbXct1MMgyAqK3aiLdAA+P7PDY4QbIgAbLQquyI5+8RkAqK3aiLdAA8v1MFUvv8Ag2QAAzZ/Fd5GQRyAqK3aiLdAAB8XBWVHOKqd78sscZ6nW+tho3kZAAKit2oi3QAGOZOl8rhtEo9hr5Nl2fp1yLXVv18c+yMZAVFbtRFuga9nBZxDyCcQAAAOp66qOwjLpxHKordqIt0Hg8N6XmziGcAAAAJwFmfXyHXwkqK3aixm3dNUDc0tkNzSNzSNzSNzSNzSNzSPWseokZW7URHP/9oACAEBAAEFAvsLxu+QJRrbbWeeL2520LrWO2rO2y38Ru7FbzLZ/wADl517wkFZe2/67+z/AEStqd8Vnfs3fC7Lt7L+N67sll43pltYi0FrYvWdyx2d60ZxwOCaQrPbG4W/sHWc2Rx2eSjPbXZhj/UA3+QYbe6zm0uPTbbbkZ+0L96zt3nGsdrdtJLzwdG0bSbSVs21yNqt/wCQy9j2hb22WvhdmAo1lafyO3Npf8b83YH473yjs7Zyj+7/2gAIAQMAAT8B8us0ShIRkkKysrLLHlRu/9oACAECAAE/AfLgbklvSnr4LKyyPCyMjJdAvEXBfMp7d//aAAgBAQAGPwL7CqOvkUc6tErugUZH+s7wig7m94DymPG+Dky5y+YkO6S3uvSQBkJidLy4OzUPItHrcyGbIJ+WjfUWouvkKro30lvp7tEFvq6wmo5Hi0St6B5MlDJU0bJ2V4X+RkIPpHeZ4DyvJi96Tgbp6dJxd53CchPd13//2gAIAQEAAT8h+wSQKlNYN+qNWeACSUAqSxTgDPU6DBiCkLiV3G1PoPwNCIA5ac8p0Wo8fhQXlIuv8e0zOECGpgL5AFSXoyUBQAess5CJdPL0gnw0kcAwdpZCsQ2CpZi9HGceJwH5m4jOYCxFBhhgNw71S/GbDA0AnABCFBwMWp4Ot+CrfJDRKJxL2pPACkgDMwb8aF70bAm1IDfH9GOo+h9moYA5RO8wlImADAgFZqchixJTaval7LzNENGGmaHQySAiBUsRQcAZ8TKSQkMXDgfeRFDI4s/aZWMRXmMva9DvsYutJpCBBQiILCzGvAit1U4CDT/qcjmwjUV7XOPQe09f6OsN/wD/2gAMAwEAAgADAAAAEPPPPPPPPPKPPPPNPPPPKPPPD77l/PKPPL//AP8A/wDPKPPLtf8A8zzyjzzw32Pzzyjzzb/y1PzyjzX3/wD/AP8Ajyjxb/8A/wD/AO9WiLPPPPPPNCD/2gAIAQMAAT8Q8udxWBvHyoQu4L4m4BdEpeK4b4mP/9oACAECAAE/EPL5u4qYhLwqJQXCvoMljlvgKwYndKbqkqBL4JuEp//aAAgBAQABPxD7BGqAMyAdSwMUj5f9WBAKCozER1njTDKQgAGJLHzo51CAcTHRlYpib1MgyDLYXETmKujDMMqAgGeH1CGk4hclGBX0BxjeLXCApshXlEeYTEwqR8BUrfMGgA8ysGjAaAsswLir1Mgyv9EJZQBEiDmU+q+ATAVNNW4tNqAXvLABBCgggjMGrFPXqmnMUN44RRBkfELgJtDQRB+0DiMW0SRHTOfAxuBBAKsFDlxdsy3c4MnEk4k4mcUDVgAB5GDFlLHQ7Bgrgae1i4VFj7V2MAkBACgoBOKAlUgDqYNBVmMDdxO5hPkJkrJbdiU/nYgAw+BB3mDEkACkkoABiSykB8LU1FAyk5xQGlDkLxML878jTkjIEXxPjZGOskAYVSYD5QYsSLBPF9bwFBrKKSrRUcTllgxkHqz/ACD4eiOMwghcKJgY+I7IYXkg6LgpUPwc5q7ZgDAijDPAgg6IOtOBuxVU/ZO6jOXAw7SdSOlxOqhtQSd55QmUtI3rv//Z';
  const avatarURL = `url("data:image/jpeg;base64,${avatarBase64}")`;
  const style = document.createElement('style');
  style.textContent = `
    html[${SIDEBAR}] ${SIDEBAR_SELECTOR} { display: none !important; }
    [data-ig-calm-sidebar-rail] {
      display: flex !important;
      flex: 0 0 56px !important;
      width: 56px !important;
      min-width: 56px !important;
      box-sizing: border-box !important;
      align-self: stretch !important;
      flex-direction: row !important;
      align-items: center !important;
      padding: 12px 7px !important;
      border-inline-end: 1px solid #89939b40 !important;
    }
    [data-ig-calm-sidebar-rail][hidden] { display: none !important; }
    button[data-ig-calm-sidebar-toggle] {
      position: static !important;
      flex: 0 0 40px !important;
      width: 40px !important;
      height: 40px !important;
      padding: 0 !important;
      border: 1px solid #b7bfc6 !important;
      border-radius: 12px !important;
      background: #f4f6f7 !important;
      color: #27333c !important;
      font: 500 28px/1 system-ui, sans-serif !important;
      cursor: pointer !important;
    }
    button[data-ig-calm-sidebar-toggle][hidden] { display: none !important; }
    button[data-ig-calm-sidebar-toggle]:focus-visible {
      outline: 3px solid #527ca3 !important;
      outline-offset: 3px !important;
    }
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

  function toggleSetting(key) {
    settings[key] = !settings[key];
    GM_setValue('calm-settings', settings);
    menus();
    schedule();
  }

  function updateSidebar(isDirect) {
    const sidebar = document.querySelector(SIDEBAR_SELECTOR);
    const available = settings.enabled && isDirect && !!sidebar?.parentElement;
    document.documentElement.toggleAttribute(SIDEBAR, available && settings.sidebar);
    if (!sidebarButton && available && document.body) {
      sidebarRail = document.createElement('div');
      sidebarRail.setAttribute('data-ig-calm-sidebar-rail', '');
      sidebarButton = document.createElement('button');
      sidebarButton.type = 'button';
      sidebarButton.setAttribute('data-ig-calm-sidebar-toggle', '');
      sidebarButton.addEventListener('click', () => toggleSetting('sidebar'));
      sidebarRail.append(sidebarButton);
    }
    if (!sidebarButton) return;
    // A real flex sibling reserves space; never overlay the conversation.
    // Reinsert only if React replaces/reorders the sidebar.
    if (available && (sidebarRail.parentElement !== sidebar.parentElement || sidebarRail.nextSibling !== sidebar)) {
      sidebar.parentElement.insertBefore(sidebarRail, sidebar);
    }
    sidebarRail.hidden = !available;
    sidebarButton.hidden = !available;
    const label = settings.sidebar ? 'Show contacts' : 'Hide contacts';
    // Only change text when needed: text mutations trigger our DOM observer.
    const icon = settings.sidebar ? '›' : '‹';
    if (sidebarButton.textContent !== icon) sidebarButton.textContent = icon;
    sidebarButton.title = label;
    sidebarButton.setAttribute('aria-expanded', String(!settings.sidebar));
    if (sidebarButton.getAttribute('aria-label') !== label + ' sidebar') {
      sidebarButton.setAttribute('aria-label', label + ' sidebar');
    }
  }

  function scan() {
    frame = 0;
    const root = document.documentElement;
    if (!root) return;
    if (!style.isConnected) root.append(style);
    const isDirect = /^\/direct(?:\/|$)/.test(location.pathname);
    updateSidebar(isDirect);
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
      sidebar: 'Hide contacts sidebar',
    };
    menuIds = Object.entries(labels).map(([key, label]) =>
      GM_registerMenuCommand(`${settings[key] ? '✓' : '○'} ${label}`, () => toggleSetting(key))
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
