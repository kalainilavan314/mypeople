from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2]
out = root / 'docs' / 'refactor'
out.mkdir(parents=True, exist_ok=True)
source = root / 'app' / 'src'
files = sorted(p for p in source.rglob('*') if p.is_file())

with ZipFile(out / 'refactored-source.zip', 'w', ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.relative_to(root).as_posix())
    for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html']:
        file = root / 'app' / name
        archive.write(file, file.relative_to(root).as_posix())
    community_photo = root / 'app' / 'public' / 'member' / 'community-hero-v1.webp'
    if community_photo.exists():
        archive.write(community_photo, community_photo.relative_to(root).as_posix())

sections = ['# Refactored frontend code\n',
            'This is a source handoff, not a standalone deployment package. '
            'Public image assets and the existing backend remain in the project. '
            'The terminal commands are in docs/refactor/README.md.\n']
for file in files:
    if file.suffix not in {'.ts', '.tsx', '.css'}:
        continue
    language = 'css' if file.suffix == '.css' else 'tsx' if file.suffix == '.tsx' else 'typescript'
    sections.append(f'## {file.relative_to(root).as_posix()}\n\n```{language}\n'
                    f'{file.read_text(encoding="utf-8").rstrip()}\n```\n')
(out / 'source-code.md').write_text('\n'.join(sections), encoding='utf-8')

tree = ['# Current project structure\n', 'Generated from the working tree. Dependency folders, '
        'credentials, build output and temporary QA artifacts are omitted.\n', '```text', root.name + '/']
for folder in ['app/src', 'server/src']:
    tree.append(folder + '/')
    base = root / folder
    for p in sorted(base.rglob('*')):
        if not p.name.startswith('.env'):
            depth = len(p.relative_to(base).parts) - 1
            tree.append('  ' * (depth + 1) + p.name + ('/' if p.is_dir() else ''))
tree.extend(['```', '', 'See docs/architecture.md and docs/refactor/README.md for boundaries and commands.'])
(root / 'PROJECT_STRUCTURE.md').write_text('\n'.join(tree) + '\n', encoding='utf-8')
print(f'Frontend source handoff contains {len(files)} files; no environment files or credentials included.')
