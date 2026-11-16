// Browser-level accessibility smoke for public admin routes. CI runs this
// against a locally started Next server; no member or staff data is needed.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.A11Y_BASE_URL ?? 'http://127.0.0.1:3000';
const routes = ['/sign-in', '/sign-in?error=invalid_credentials'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function browserBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium is required for the rendered accessibility sweep; set CHROME_BIN.');
  return found;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForJson(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
    } catch { /* Server is still starting. */ }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForPage(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Next is still starting. */ }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for admin page ${url}`);
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) request.reject(new Error('Chrome closed during accessibility sweep'));
    pending.clear();
  });
  return {
    call(method, params = {}) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

function inspectPage(expectError) {
  const failures = [];
  const rgb = (value) => {
    const channels = value.match(/[\d.]+/g)?.slice(0, 4).map(Number);
    return channels?.length >= 3 ? channels : null;
  };
  const luminance = (channels) => {
    const linear = channels.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (first, second) => {
    const light = Math.max(luminance(first), luminance(second));
    const dark = Math.min(luminance(first), luminance(second));
    return (light + 0.05) / (dark + 0.05);
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    return element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const background = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const color = rgb(getComputedStyle(current).backgroundColor);
      if (color && (color[3] === undefined || color[3] === 1)) return color;
    }
    return [255, 255, 255];
  };
  const named = (element) => {
    const labelledBy = element.getAttribute('aria-labelledby');
    const referenced = labelledBy?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    return Boolean(element.getAttribute('aria-label')?.trim() || referenced?.trim() ||
      element.labels?.length || element.innerText?.trim() || element.getAttribute('title')?.trim());
  };

  if (document.documentElement.lang !== 'en') failures.push('Document language must be English.');
  if (!document.querySelector('main')) failures.push('Missing main landmark.');
  if (document.querySelectorAll('h1').length !== 1) failures.push('Expected one level-one heading.');
  if (expectError && !document.querySelector('#error-summary[role="alert"]')) {
    failures.push('Error state did not render an alert summary.');
  }

  for (const element of document.querySelectorAll('input, select, textarea, button, a[href]')) {
    if (!visible(element)) continue;
    const description = `${element.tagName.toLowerCase()} ${element.getAttribute('name') ?? element.getAttribute('href') ?? ''}`.trim();
    if (!named(element)) failures.push(`${description}: missing accessible name`);
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy?.split(/\s+/).some((id) => !document.getElementById(id))) {
      failures.push(`${description}: aria-describedby references a missing element`);
    }
    if (element.matches('button, input:not([type=radio]):not([type=checkbox]), select, textarea')) {
      const box = element.getBoundingClientRect();
      if (box.height < 44 || box.width < 44) failures.push(`${description}: target ${Math.round(box.width)}×${Math.round(box.height)} is under 44×44`);
    }
  }

  let checkedText = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!node.textContent?.trim() || !element || !visible(element) || element.closest('[aria-hidden="true"], script, style')) continue;
    const style = getComputedStyle(element);
    const foreground = rgb(style.color);
    if (!foreground || (foreground[3] !== undefined && foreground[3] < 1)) continue;
    const ratio = contrast(foreground, background(element));
    const fontSize = Number.parseFloat(style.fontSize);
    const large = fontSize >= 24 || (fontSize >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700);
    const minimum = large ? 3 : 4.5;
    checkedText += 1;
    if (ratio + 0.01 < minimum) {
      failures.push(`Contrast ${ratio.toFixed(2)}:1 below ${minimum}:1 for "${node.textContent.trim().slice(0, 45)}"`);
    }
  }
  return { failures: [...new Set(failures)], checkedText, title: document.title, url: location.pathname + location.search };
}

async function evaluate(cdp, expression) {
  const result = await cdp.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function main() {
  const profile = await mkdtemp(join(tmpdir(), 'mypeople-a11y-'));
  const port = await freePort();
  let chrome;
  let browser;
  try {
    await waitForPage(new URL('/sign-in', baseUrl));
    chrome = spawn(browserBinary(), [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--no-first-run', '--disable-extensions', '--disable-background-networking',
      `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore' });
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
    browser = await connectCdp(version.webSocketDebuggerUrl);
    for (const route of routes) {
      const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(new URL(route, baseUrl).href)}`, { method: 'PUT' }).then((response) => response.json());
      const tab = await connectCdp(target.webSocketDebuggerUrl);
      try {
        const expectError = route.includes('error=');
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          ready = await evaluate(tab, `document.readyState === "complete" && !!document.querySelector("main h1") ${expectError ? '&& !!document.querySelector("#error-summary[role=alert]")' : ''}`);
          if (ready) break;
          await sleep(200);
        }
        if (!ready) throw new Error(`${route}: expected page state did not finish rendering`);
        const result = await evaluate(tab, `(${inspectPage.toString()})(${expectError})`);
        console.log(`${result.url}: checked ${result.checkedText} rendered text nodes`);
        for (const failure of result.failures) console.error(`  ${failure}`);
        if (result.failures.length) process.exitCode = 1;
      } finally {
        tab.close();
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
      }
    }
    await browser.call('Browser.close').catch(() => {});
  } finally {
    browser?.close();
    chrome?.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(`Rendered admin accessibility sweep failed: ${error.message}`);
  process.exitCode = 1;
});
