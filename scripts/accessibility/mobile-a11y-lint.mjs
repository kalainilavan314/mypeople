import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import ts from 'typescript';

const ALLOWED_FONTS = new Set([
  'Noto Sans Tamil',
  'Inter',
  'JetBrains Mono',
  'NotoSansTamil_400Regular',
  'NotoSansTamil_600SemiBold',
  'NotoSansTamil_700Bold',
]);

async function getSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.expo', 'dist', 'dist-android', 'dist-web'].includes(entry.name)) {
        files.push(...(await getSourceFiles(fullPath)));
      }
    } else if (['.tsx', '.ts'].includes(extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function getProp(attributes, name) {
  for (const prop of attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.text === name) {
      return prop;
    }
  }
  return null;
}

function hasProp(attributes, name) {
  return Boolean(getProp(attributes, name));
}

function getTagName(element) {
  if (ts.isJsxElement(element)) {
    const tag = element.openingElement.tagName;
    return ts.isIdentifier(tag) ? tag.text : null;
  }
  if (ts.isJsxSelfClosingElement(element)) {
    const tag = element.tagName;
    return ts.isIdentifier(tag) ? tag.text : null;
  }
  return null;
}

function getAttributes(element) {
  if (ts.isJsxElement(element)) {
    return element.openingElement.attributes;
  }
  if (ts.isJsxSelfClosingElement(element)) {
    return element.attributes;
  }
  return null;
}

function getLineAndChar(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${line + 1}:${character + 1}`;
}

export async function lintDirectory(dir) {
  const absDir = resolve(dir);
  const files = await getSourceFiles(absDir);
  const violations = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    function checkNode(node) {
      // Check font families in literals
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const text = node.text;
        if (text.toLowerCase().includes('fontfamily') || (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name.getText() === 'fontFamily')) {
          if (!ALLOWED_FONTS.has(text) && !text.includes('var(')) {
            violations.push({
              file,
              location: getLineAndChar(sourceFile, node),
              rule: 'font-lock',
              message: `Font family '${text}' violates locked typography. Must use Noto Sans Tamil, Inter, or JetBrains Mono.`,
            });
          }
        }
      }

      // Check JSX elements
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = getTagName(node);
        const attrs = getAttributes(node);

        if (!tagName || !attrs) {
          ts.forEachChild(node, checkNode);
          return;
        }

        // Image check: accessibilityLabel or marked decorative
        if (tagName === 'Image' || tagName === 'ExpoImage') {
          const hasLabel = hasProp(attrs, 'accessibilityLabel') || hasProp(attrs, 'aria-label') || hasProp(attrs, 'alt');
          const isDecorative = (
            getProp(attrs, 'accessible')?.initializer?.getText?.() === '{false}' ||
            getProp(attrs, 'aria-hidden')?.initializer?.getText?.() === '{true}' ||
            getProp(attrs, 'importantForAccessibility')?.initializer?.getText?.() === '"no"'
          );

          if (!hasLabel && !isDecorative) {
            violations.push({
              file,
              location: getLineAndChar(sourceFile, node),
              rule: 'image-accessible-name',
              message: `<${tagName}> missing accessibilityLabel or accessible={false}/importantForAccessibility="no" for decorative images.`,
            });
          }
        }

        // Check interactive primitives
        if (['TouchableOpacity', 'TouchableHighlight', 'Pressable'].includes(tagName)) {
          const hasRole = hasProp(attrs, 'accessibilityRole') || hasProp(attrs, 'role');
          const hasLabel = hasProp(attrs, 'accessibilityLabel') || hasProp(attrs, 'aria-label');
          const isHidden = (
            getProp(attrs, 'accessible')?.initializer?.getText?.() === '{false}' ||
            getProp(attrs, 'aria-hidden')?.initializer?.getText?.() === '{true}'
          );

          if (!hasRole && !hasLabel && !isHidden) {
            // Check if it wraps text or button
            let hasVisibleText = false;
            if (ts.isJsxElement(node)) {
              const childrenText = node.children.map(c => c.getText()).join(' ');
              if (/AppText|Text|Button|Icon|Ionicons/.test(childrenText)) {
                hasVisibleText = true;
              }
            }
            if (!hasVisibleText) {
              violations.push({
                file,
                location: getLineAndChar(sourceFile, node),
                rule: 'interactive-accessible-role',
                message: `<${tagName}> interactive element missing accessibilityRole or accessibilityLabel.`,
              });
            }
          }
        }

        // Check shielding View: <View accessible={true}> wrapping interactive child
        if (tagName === 'View') {
          const accessibleProp = getProp(attrs, 'accessible');
          const isAccessibleTrue = accessibleProp && (!accessibleProp.initializer || accessibleProp.initializer.getText() === '{true}');
          if (isAccessibleTrue && ts.isJsxElement(node)) {
            const innerCode = node.children.map(c => c.getText()).join(' ');
            if (/<(Button|TextInput|TextField|SelectField|Checkbox|Pressable|TouchableOpacity)/.test(innerCode)) {
              violations.push({
                file,
                location: getLineAndChar(sourceFile, node),
                rule: 'no-shielding-container',
                message: `<View accessible={true}> wraps interactive children, shielding them from screen readers. Use accessible={false} or remove prop.`,
              });
            }
          }
        }
      }

      ts.forEachChild(node, checkNode);
    }

    ts.forEachChild(sourceFile, checkNode);
  }

  return violations;
}

// CLI runner
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const dirs = process.argv.slice(2);
  const targetDirs = dirs.length > 0 ? dirs : ['apps/member-mobile'];

  let totalViolations = 0;
  for (const dir of targetDirs) {
    const violations = await lintDirectory(dir);
    if (violations.length > 0) {
      console.error(`\nAccessibility violations in ${dir}:`);
      for (const v of violations) {
        console.error(`  ${v.file}:${v.location} [${v.rule}] ${v.message}`);
      }
      totalViolations += violations.length;
    } else {
      console.log(`✓ ${dir}: No accessibility violations found.`);
    }
  }

  if (totalViolations > 0) {
    process.exit(1);
  }
}
