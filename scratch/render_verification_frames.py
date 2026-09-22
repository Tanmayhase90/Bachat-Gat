import cv2, numpy as np, os, subprocess, imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs('scratch/test_verification_frames', exist_ok=True)

# 1. Clean patch
cap = cv2.VideoCapture('Bachat_Gat_Project_Explanation_Marathi_original.mp4')
cap.set(cv2.CAP_PROP_POS_FRAMES, 25)
ret, f25 = cap.read()
col_profile = np.mean(f25[905:958, 30:60], axis=1, keepdims=True)
clean_strip = np.repeat(col_profile, 1920, axis=1).astype(np.uint8)

test_seconds = [5, 25, 55, 115, 180, 225, 270, 330, 375, 415]
fps = 25.0

for t in test_seconds:
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
    ret, frame = cap.read()
    if not ret:
        continue
    frame_patched = frame.copy()
    frame_patched[905:958, :] = clean_strip
    
    tmp_path = f'scratch/test_verification_frames/patched_{t:03d}s.png'
    out_path = f'scratch/test_verification_frames/rendered_{t:03d}s.png'
    cv2.imwrite(tmp_path, frame_patched)
    
    cmd = [
        ffmpeg_exe, '-y',
        '-ss', str(t),
        '-loop', '1', '-i', tmp_path,
        '-vf', 'ass=scratch/subtitles_corrected.ass',
        '-vframes', '1',
        out_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f'Rendered sample frame at {t:03d}s')

print('All verification frames rendered!')
