import cv2, numpy as np, subprocess, imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

cap = cv2.VideoCapture('Bachat_Gat_Project_Explanation_Marathi_original.mp4')
cap.set(cv2.CAP_PROP_POS_FRAMES, 25)
ret, f25 = cap.read()

# Margin sample at x: 30 to 60 for y: 945 to 984 (39 pixels tall)
margin_sample = f25[945:984, 30:60]
col_profile = np.mean(margin_sample, axis=1, keepdims=True) # (39, 1, 3)
clean_strip = np.repeat(col_profile, 1920, axis=1).astype(np.uint8)

for t in [5, 25, 55, 115, 180, 225, 270, 330, 375, 415]:
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * 25))
    ret, frame = cap.read()
    if not ret:
        continue
    
    frame_patched = frame.copy()
    frame_patched[945:984, :] = clean_strip
    
    tmp_path = f'scratch/test_verification_frames/p_{t:03d}s.png'
    out_path = f'scratch/test_verification_frames/final_v2_{t:03d}s.png'
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
    print(f'Done {t:03d}s')

print('All frames processed!')
