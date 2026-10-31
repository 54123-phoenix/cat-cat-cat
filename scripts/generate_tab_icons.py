"""Rasterize the existing Web tab icons for WeChat, preserving colors and shapes."""
import json
from pathlib import Path
import shutil
import subprocess

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'cat-miniprogram/src/assets/tab'
SCRIPT = """
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {Home, MapPin, Camera, MessageSquare, User, Cat} = require('lucide-react');
const icons = {home:Home, map:MapPin, scan:Camera, community:MessageSquare, profile:User};
const result = {};
for (const [name, icon] of Object.entries(icons)) {
  for (const [suffix, color] of [['','#78716C'],['-active','#F97316']]) {
    result[name+suffix] = renderToStaticMarkup(React.createElement(icon,{size:40, color, strokeWidth:2}));
  }
}
result['cat-marker'] = renderToStaticMarkup(React.createElement(Cat,{size:40,color:'#F97316',strokeWidth:2}));
process.stdout.write(JSON.stringify(result));
"""


def main():
    result = subprocess.run([shutil.which('node'), '-e', SCRIPT], cwd=ROOT/'cat-frontend', capture_output=True, text=True, check=True)
    icons = json.loads(result.stdout)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        page = browser.new_page(viewport={'width': 48, 'height': 48}, device_scale_factor=2)
        for name, svg in icons.items():
            page.set_content('<body style="margin:0;padding:4px">'+svg+'</body>')
            destination = DEST.parent/'map/cat.png' if name == 'cat-marker' else DEST/f'{name}.png'
            page.screenshot(path=str(destination), omit_background=True, scale='css')
        browser.close()
    shutil.copyfile(ROOT/'cat-frontend/node_modules/lucide-react/LICENSE', DEST/'LICENSE-lucide')
    print('Generated 10 tab icons and 1 cat map marker (transparent 48x48 Lucide icons).')


if __name__ == '__main__':
    main()
