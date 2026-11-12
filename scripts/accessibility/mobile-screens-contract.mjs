import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Every screen in the app (members and the Staff section), not only the shared components,
// meets the parts of the WCAG 2.2 AA checklist a source scan can prove
// (docs/development/accessibility-checklist.md). What it cannot prove, such
// as reading order or contrast on images, stays with TalkBack and VoiceOver.
const root = fileURLToPath(new URL('../../', import.meta.url));
const FOLDERS = ['apps/member-mobile/app', 'apps/member-mobile/src', 'packages/mobile-ui/src'];

async function sourceFiles(folder) {
  const found = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.tsx')) found.push(join(entry.parentPath ?? entry.path, entry.name));
  }
  return found;
}

/** Each `<Tag ...>` opening tag with its attributes, read up to the `>` outside braces and strings. */
function openingTags(code, tag) {
  const tags = [];
  const start = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  for (let match = start.exec(code); match; match = start.exec(code)) {
    let depth = 0;
    let quote = null;
    let end = match.index + tag.length + 1;
    for (; end < code.length; end += 1) {
      const char = code[end];
      if (quote) {
        if (char === quote && code[end - 1] !== '\\') quote = null;
      } else if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    const line = code.slice(0, match.index).split('\n').length;
    tags.push({ attributes: code.slice(match.index, end + 1), line });
  }
  return tags;
}

async function everyTag(tag) {
  const files = (await Promise.all(FOLDERS.map(sourceFiles))).flat();
  const all = [];
  for (const file of files) {
    const code = await readFile(file, 'utf8');
    for (const found of openingTags(code, tag)) all.push({ ...found, where: `${relative(root, file)}:${found.line}` });
  }
  return all;
}

test('every switch has a spoken name (WCAG 4.1.2)', async () => {
  const unnamed = (await everyTag('Switch')).filter((tag) => !/accessibilityLabel=/.test(tag.attributes));
  assert.deepEqual(unnamed.map((tag) => tag.where), []);
});

test('every pressable area says what it is (WCAG 4.1.2)', async () => {
  const roleless = (await everyTag('Pressable')).filter((tag) => !/accessibilityRole=/.test(tag.attributes));
  assert.deepEqual(roleless.map((tag) => tag.where), []);
});

test('every image is named or marked decorative (WCAG 1.1.1)', async () => {
  const unnamed = (await everyTag('Image')).filter(
    (tag) => !/accessibilityLabel=/.test(tag.attributes) && !/accessible=\{false\}/.test(tag.attributes),
  );
  assert.deepEqual(unnamed.map((tag) => tag.where), []);
});

test('text is typed only through the shared TextField, which carries the label and errors (WCAG 3.3.2)', async () => {
  const raw = (await everyTag('TextInput')).filter((tag) => !tag.where.startsWith(join('packages', 'mobile-ui')));
  assert.deepEqual(raw.map((tag) => tag.where), []);
});
