import importlib.util
from pathlib import Path

from PIL import Image
import pytest

spec = importlib.util.spec_from_file_location('asset_gate', Path(__file__).resolve().parents[2]/'scripts/check_assets.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


@pytest.mark.parametrize('kind', ['pointer', 'corrupt', 'placeholder', 'missing'])
def test_gate_rejects_unshippable_assets(tmp_path, kind):
    root = tmp_path/'assets'
    if kind != 'missing':
        root.mkdir()
        if kind == 'pointer':
            (root/'tab.png').write_text('version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 1024\n')
        elif kind == 'corrupt':
            (root/'tab.png').write_bytes(b'not-an-image')
        else:
            Image.new('RGBA', (1, 1)).save(root/'tab.png')
    _, failures = gate.check_assets([root])
    assert len(failures) == 1


def test_gate_decodes_real_images_and_svg(tmp_path):
    Image.new('RGBA', (48, 48)).save(tmp_path/'tab.png')
    (tmp_path/'logo.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>')
    assert gate.check_assets([tmp_path]) == (2, [])
