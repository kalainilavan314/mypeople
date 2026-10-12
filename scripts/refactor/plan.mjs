import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.resolve('app/src');
const dead = new Set([
  'components/DigitalMemberPass.tsx', 'components/HomeTopBar.tsx',
  'components/MemberVisuals.tsx', 'components/MembershipIdCard.tsx',
  'components/ui/demo.tsx', 'screens/NorthUnityHome.tsx',
  'screens/ReportDetail.tsx', 'screens/ReportNew.tsx',
  'lib/memberDisplay.manualtest.mjs',
]);
const features = {
  Home: 'home', Events: 'events', EventDetail: 'events', Card: 'card',
  Milestones: 'card', Gallery: 'gallery', Profile: 'profile', EditProfile: 'profile',
  Reports: 'reports', Community: 'community', MyArea: 'community',
  Announcement: 'community', Survey: 'surveys', Ideas: 'ideas',
  Skills: 'learning', Courses: 'learning', PartyFund: 'fundraising',
  Referral: 'referrals', Notifications: 'profile', Privacy: 'profile', Language: 'profile',
};
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(name) : [name];
  });
}
const moves = [], deletes = [];
for (const absolute of walk(src)) {
  const rel = path.relative(src, absolute).replaceAll('\\', '/');
  if (dead.has(rel)) { deletes.push('app/src/' + rel); continue; }
  let to = rel;
  if (rel.startsWith('styles/')) to = rel.replace('styles/', 'core/theme/');
  else if (rel.startsWith('theme/')) to = rel.replace('theme/', 'core/theme/');
  else if (rel.startsWith('i18n/')) to = rel.replace('i18n/', 'core/i18n/');
  else if (rel.startsWith('lib/')) to = rel.replace('lib/', 'core/lib/');
  else if (rel.startsWith('data/')) to = rel.replace('data/', 'core/api/').replace('/mock/', '/prototype/');
  else if (rel.startsWith('components/')) to = rel.replace('components/', 'shared/components/');
  else if (rel === 'hooks/useMe.ts') to = 'shared/hooks/useMe.ts';
  else if (rel === 'hooks/useOnline.ts') to = 'shared/hooks/useNetworkStatus.ts';
  else if (rel === 'state/auth.ts') to = 'shared/hooks/useAuth.ts';
  else if (rel === 'state/theme.ts') to = 'shared/hooks/useTheme.ts';
  else if (rel === 'state/signupDraft.ts') to = 'features/auth/state/signupDraft.ts';
  else if (rel.startsWith('screens/auth/')) {
    const name = path.basename(rel, '.tsx');
    to = name === 'parts' ? 'features/auth/components/parts.tsx'
      : `features/auth/${name === 'SignUp' ? 'Register' : name}Screen.tsx`;
  } else if (rel.startsWith('screens/onboarding/')) {
    to = `features/auth/onboarding/${path.basename(rel, '.tsx')}Screen.tsx`;
  } else if (rel.startsWith('screens/')) {
    const name = path.basename(rel, '.tsx');
    if (!features[name]) throw new Error('Unmapped screen: ' + rel);
    to = `features/${features[name]}/${name}Screen.tsx`;
  }
  if (rel === 'components/MembershipCredential.tsx' || rel === 'components/PalmyraMark.tsx')
    to = rel.replace('components/', 'features/card/components/');
  moves.push({ from: 'app/src/' + rel, to: 'app/src/' + to });
}
fs.mkdirSync('docs/refactor', { recursive: true });
fs.writeFileSync('docs/refactor/move-map.json', JSON.stringify({ moves, deletes }, null, 2) + '\n');
const commands = [
  '# Run only on the pre-refactor checkout; these moves have already been applied here.',
  `$projectRoot = (Resolve-Path -LiteralPath '${root.replaceAll("'", "''")}').Path`,
  '$projectPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar',
  'function Assert-ProjectPath([string]$relative) {',
  '  $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))',
  '  if (-not $target.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes project: $target" }',
  '  return $target',
  '}',
];
for (const dir of ['design/flutter', 'design/react-native', 'deployment/artifacts']) {
  commands.push(`$target = Assert-ProjectPath '${dir}'`);
  commands.push('if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }');
}
for (const { from, to } of moves.filter(m => m.from !== m.to)) {
  commands.push(`$source = Assert-ProjectPath '${from}'`);
  commands.push(`$destination = Assert-ProjectPath '${to}'`);
  commands.push('New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null');
  commands.push('Move-Item -LiteralPath $source -Destination $destination');
}
for (const name of deletes) commands.push(`Remove-Item -LiteralPath (Assert-ProjectPath '${name}')`);
fs.writeFileSync('docs/refactor/move-files.ps1', commands.join('\n') + '\n');
console.log('Planned', moves.filter(m => m.from !== m.to).length, 'moves and', deletes.length, 'dead-file removals');
