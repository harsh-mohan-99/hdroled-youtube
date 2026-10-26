from pathlib import Path
import json
import zipfile
import runpy

root = Path(__file__).resolve().parent.parent
runpy.run_path(str(root / 'scripts/build-panel.py'))
source = root / 'extension'
version = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))['version']
label = '.'.join(version.split('.')[:2])
dist = root / 'dist'
dist.mkdir(exist_ok=True)
files = sorted(path for path in source.rglob('*') if path.is_file())
for browser in ('Chromium', 'Firefox'):
    target = dist / f'HDROLED-{label}-{browser}.zip'
    manifest = source / 'manifest.json' if browser == 'Chromium' else root / 'manifests/firefox.json'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as package:
        for file in files:
            name = file.relative_to(source).as_posix()
            package.writestr(name, manifest.read_bytes() if name == 'manifest.json' else file.read_bytes())
    with zipfile.ZipFile(target) as package:
        assert package.testzip() is None
        assert json.loads(package.read('manifest.json'))['version'] == version
        for file in files:
            name = file.relative_to(source).as_posix()
            expected = manifest.read_bytes() if name == 'manifest.json' else file.read_bytes()
            assert package.read(name) == expected
    print(f'{target.name}: verified {len(files)} files, {target.stat().st_size} bytes')
