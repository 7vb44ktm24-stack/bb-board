// Inside Telegram's Board button (a Telegram web app): the page at full height, no swipe-down closing it while scrolling,
// Telegram's back button closing an open sheet, Telegram's header and background in the page's own colour, a light tick on
// a tab change. It talks to Telegram the way Telegram's own script does (postEvent out, receiveEvent in) without loading it;
// in a browser none of it runs.

const proxy = window.TelegramWebviewProxy;                      // the phone and desktop apps put this in the page
const framed = window.parent !== window && /tgWebApp/.test(location.hash);   // Telegram Web: the page in its frame
export const inTelegram = !!proxy || framed;

function post(type, data = {}) {
  if (!inTelegram) return;
  try {
    if (proxy) proxy.postEvent(type, JSON.stringify(data));
    else window.parent.postMessage(JSON.stringify({ eventType: type, eventData: data }), 'https://web.telegram.org');
  } catch { /* an older Telegram: the page works as it does in a browser */ }
}

const handlers = {};
function receive(type, data) { (handlers[type] || []).forEach((fn) => fn(data)); }
export function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }

if (inTelegram) {
  window.Telegram = window.Telegram || {};
  window.Telegram.WebView = { ...(window.Telegram.WebView || {}), receiveEvent: receive };
  if (framed) {
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent) return;
      try { const d = JSON.parse(e.data); if (d && d.eventType) receive(d.eventType, d.eventData); } catch { /* not Telegram's */ }
    });
  }
  document.documentElement.classList.add('in-telegram');
}

export function ready() {
  post('web_app_ready');
  post('web_app_expand');
  post('web_app_setup_swipe_behavior', { allow_vertical_swipe: false });   // scrolling up at the top no longer closes the board
}
export function backButton(visible) { post('web_app_setup_back_button', { is_visible: !!visible }); }
export function tick() { post('web_app_trigger_haptic_feedback', { type: 'selection_change' }); }
// a web address opened outside the board (Claude, say): Telegram's own browser inside Telegram, a new tab elsewhere
export function openLink(url) {
  if (inTelegram) post('web_app_open_link', { url });
  else window.open(url, '_blank', 'noopener');
}
// a t.me link (the BB Picks bot with a start word) opened inside Telegram, or the Telegram app from a browser
export function openTg(url) {
  if (inTelegram) post('web_app_open_tg_link', { path_full: url.replace(/^https:\/\/t\.me/, '') });
  else window.location.href = url;
}

let painted = null;
export function colours() {
  if (!inTelegram) return;
  const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3 || (m.length > 3 && +m[m.length - 1] === 0)) return;   // a see-through colour: leave Telegram's own
  const hex = `#${m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('')}`;
  if (hex === painted) return;
  painted = hex;
  post('web_app_set_header_color', { color: hex });
  post('web_app_set_background_color', { color: hex });
  post('web_app_set_bottom_bar_color', { color: hex });
}
