import cv2, numpy as np, subprocess, imageio_ffmpeg, os

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# We will test rendering the video section from t=15s to t=35s
cap = cv2.VideoCapture('Bachat_Gat_Project_Explanation_Marathi_original.mp4')
fps = cap.get(cv2.CAP_PROP_FPS)

# Build clean patch
cap.set(cv2.CAP_PROP_POS_FRAMES, 25)
ret, f25 = cap.read()
col_profile = np.mean(f25[945:984, 30:60], axis=1, keepdims=True)
clean_strip = np.repeat(col_profile, 1920, axis=1).astype(np.uint8)

# Output test clip
out_clip = 'scratch/test_clip_15_35s.mp4'
cmd = [
    ffmpeg_exe, '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-s', '1920x1080',
    '-pix_fmt', 'bgr24',
    '-r', str(fps),
    '-i', '-',
    '-ss', '15', '-t', '20', '-i', 'Bachat_Gat_Project_Explanation_Marathi_original.mp4',
    '-vf', 'ass=scratch/subtitles_corrected.ass',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-map', '0:v:0',
    '-map', '1:a:0',
    out_clip
]

proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

start_frame = int(15 * fps)
end_frame = int(35 * fps)
cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

for fno in range(start_frame, end_frame):
    ret, frame = cap.read()
    if not ret:
        break
    # Apply patch
    frame[945:984, :] = clean_strip
    proc.stdin.write(frame.tobytes())

proc.stdin.close()
proc.wait()
cap.release()
print(f'Test clip finished with code {proc.returncode}')

# Extract sample frames from the rendered test clip
cap_clip = cv2.VideoCapture(out_clip)
for sec_rel, sec_abs in [(2, 17), (10, 25), (18, 33)]:
    cap_clip.set(cv2.CAP_PROP_POS_FRAMES, int(sec_rel * fps))
    ret, frame = cap_clip.read()
    if ret:
        cv2.imwrite(f'scratch/clip_frame_{sec_abs}s.png', frame)
        print(f'Saved scratch/clip_frame_{sec_abs}s.png')
cap_clip.release()
