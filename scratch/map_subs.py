import json, re, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/subs_full/segments.json', 'r', encoding='utf-8') as f:
    segs = json.load(f)

with open('scratch/marathi.srt', 'r', encoding='utf-8') as f:
    srt_text = f.read()

srt_entries = []
for block in srt_text.strip().split('\n\n'):
    lines = block.strip().split('\n')
    if len(lines) >= 3:
        idx = int(lines[0])
        timing = lines[1]
        text = ' '.join(lines[2:])
        m = re.match(r'(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)', timing)
        if m:
            s_sec = int(m.group(1))*3600 + int(m.group(2))*60 + int(m.group(3)) + int(m.group(4))/1000.0
            e_sec = int(m.group(5))*3600 + int(m.group(6))*60 + int(m.group(7)) + int(m.group(8))/1000.0
            srt_entries.append({'id': idx, 'start': s_sec, 'end': e_sec, 'text': text})

print(f'Segments from video: {len(segs)}, SRT entries: {len(srt_entries)}')

with open('scratch/mapped_subs.txt', 'w', encoding='utf-8') as out_f:
    for s in segs:
        st = s['start_time']
        et = s['end_time']
        matched = [e for e in srt_entries if not (e['end'] < st or e['start'] > et)]
        if matched:
            match_str = ' | '.join([f"[{m['id']}] {m['text']}" for m in matched])
        else:
            match_str = 'NO DIRECT SRT MATCH'
        line = f"{s['index']:02d}: {st:6.2f}s - {et:6.2f}s ({s['duration']:4.2f}s) -> {match_str}"
        out_f.write(line + '\n')

print('Saved scratch/mapped_subs.txt')
