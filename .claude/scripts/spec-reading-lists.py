#!/usr/bin/env python3
"""Regenerates plan/spec-reading/<Dnn>.md from the entry tables in plan/spec-map.md.

Each list holds every core entry plus every entry tagged with that deliverable,
without planning-only entries, with adjacent line ranges merged.
Usage: python3 .claude/scripts/spec-reading-lists.py
"""
import pathlib, re, subprocess

root = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
map_path = root / 'plan/spec-map.md'
out_dir = root / 'plan/spec-reading'

def cells(line):
    return [c.strip().replace('\\|', '|') for c in re.split(r'(?<!\\)\|', line.strip())[1:-1]]

entries, file = [], None
for line in map_path.read_text().splitlines():
    m = re.match(r'^### `(specs/[^`]+)`$', line)
    if m:
        file = m.group(1)
    elif file and re.match(r'^\| S\d{3} \|', line):
        id_, lines, _, chars, klass, early, late, _ = cells(line)
        start, end = (int(x) for x in lines.split('–'))
        tags = {t.strip() for t in (early + ',' + late).split(',') if t.strip()}
        entries.append(dict(id=id_, file=file, start=start, end=end, chars=int(chars.replace(',', '')),
                            klass=klass.split(' — ')[0], tags=tags))
    elif not line.startswith('|'):
        file = file if line.strip() == '' else (None if line.startswith('## ') else file)

file_lines = {f: len((root / f).read_text().splitlines()) for f in {e['file'] for e in entries}}

def dnum(d):
    return 99 if d == 'RC' else int(d[1:])

out_dir.mkdir(exist_ok=True)
for d in sorted({t for e in entries for t in e['tags']}, key=dnum):
    chosen = [e for e in entries if e['klass'] != 'planning-only' and (e['klass'] == 'core' or d in e['tags'])]
    by_file = {}
    for e in chosen:
        by_file.setdefault(e['file'], []).append(e)
    total = sum(e['chars'] for e in chosen)
    name = f'D{dnum(d):02d}' if d != 'RC' else 'RC'
    out = [f'# Spec reading list: {d}', '',
           f'Generated from [plan/spec-map.md](../spec-map.md) by `.claude/scripts/spec-reading-lists.py`; do not edit by hand.', '',
           f'Read each range in full with the Read tool (`offset` = first line, `limit` = last − first + 1). '
           f'{len(chosen)} entries, {total:,} characters (≈{round(total / 2.4 / 1000)}K tokens).', '']
    for f, es in by_file.items():
        es.sort(key=lambda e: e['start'])
        ranges = []
        for e in es:
            # Merge when only container headings or blank lines separate two entries.
            if ranges and e['start'] <= ranges[-1][1] + 3:
                ranges[-1][1] = max(ranges[-1][1], e['end'])
            else:
                ranges.append([e['start'], e['end']])
        if len(ranges) == 1 and ranges[0][0] <= 3 and ranges[0][1] >= file_lines[f]:
            spans = 'whole file'
        else:
            spans = ', '.join(f'{a}–{b}' for a, b in ranges)
        out.append(f'- `{f}`: {spans}')
    (out_dir / f'{name}.md').write_text('\n'.join(out) + '\n')
    print(f'{name}: {len(chosen)} entries, {total:,} chars')
