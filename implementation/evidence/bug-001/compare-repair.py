from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,hashlib
root=Path('/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol')
run=root/'implementation/evidence/bug-001/visual/repair-visual-gate-1792876659511'
out=run/'comparisons';out.mkdir(exist_ok=True)
refs=root/'specs/reference/ui-screenshots'
pairs={'planned-list':'home','open-list':'home','planned-detail':'position-detail-planned','open-detail':'position-detail-stock','plan-stage1-blank':'new-plan-step1','plan-stage2-blank':'new-plan-step2','plan-stage2-filled':'new-plan-step2-filled','opening-blank':'add-fill','opening-rejected':'add-fill','opening-filled':'add-fill','trade-journal':'position-journal','debt-queue':'journal-timeline','owed-composer':'entry-composer'}
for width in [1440,814,390]:
 for screen,ref in pairs.items():
  source=refs/f'proto-{ref}{"-desktop" if width==1440 else ""}.png'; current=run/f'{width}-{screen}.png'
  original=Image.open(source).convert('RGB'); original=original.crop((0,45,original.width,original.height)); original=original.resize((1440 if width==1440 else 814,round(original.height/1.25)))
  target=Image.open(current).convert('RGB')
  #390 is responsive parity; do not claim the814 reference has390 geometry.
  canvasWidth=max(original.width,target.width);h=max(original.height,target.height)
  a=Image.new('RGB',(canvasWidth,h),'#f4f1eb');b=a.copy();a.paste(original,(0,0));b.paste(target,(0,0))
  comparison=Image.new('RGB',(canvasWidth*2,h+55),'#e5e2dc');comparison.paste(a,(0,55));comparison.paste(b,(canvasWidth,55));draw=ImageDraw.Draw(comparison)
  draw.text((10,10),f'REFERENCE {source.name} /1.25, host chrome removed',fill='black');draw.text((canvasWidth+10,10),f'CURRENT {width} CSS px; {screen}; required D2 content retained',fill='black')
  comparison.save(out/f'{width}-{screen}-side-by-side.jpg');Image.blend(a,b,.5).save(out/f'{width}-{screen}-overlay.jpg')
index={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir()};(out/'sha256.json').write_text(json.dumps(index,indent=2))
