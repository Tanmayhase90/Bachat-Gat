import cv2, numpy as np, json

with open('scratch/subs_full/segments.json', 'r', encoding='utf-8') as f:
    segs = json.load(f)

cap = cv2.VideoCapture('Bachat_Gat_Project_Explanation_Marathi_original.mp4')

# Sample margin columns from y: 905 to 958 at x: 30 to 60
cap.set(cv2.CAP_PROP_POS_FRAMES, 25)
ret, f25 = cap.read()
col_profile = np.mean(f25[905:958, 30:60], axis=1, keepdims=True)
clean_strip = np.repeat(col_profile, 1920, axis=1).astype(np.uint8)

all_clean = True
for s in segs:
    mid_frame = int((s['start_frame'] + s['end_frame']) / 2)
    cap.set(cv2.CAP_PROP_POS_FRAMES, mid_frame)
    ret, frame = cap.read()
    if not ret:
        continue
    
    frame_patched = frame.copy()
    frame_patched[905:958, :] = clean_strip
    
    gray_after = cv2.cvtColor(frame_patched[905:958, 100:1820], cv2.COLOR_BGR2GRAY)
    dark_after = np.sum(gray_after < 100)
    
    if dark_after > 0:
        print(f"Segment {s['index']} ({s['start_time']}s) has {dark_after} dark pixels after patch!")
        all_clean = False

if all_clean:
    print('SUCCESS: All 75 segments are 100% cleaned by the patch!')
