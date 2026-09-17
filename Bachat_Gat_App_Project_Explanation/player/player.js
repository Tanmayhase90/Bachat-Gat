// Chapter Definitions with Multilingual Titles
const CHAPTERS = [
  { id: 1,  start: 0.0,   end: 48.0,  title_mr: "प्रकल्प ओळख",           title_hi: "परियोजना परिचय",       title_en: "Project Introduction" },
  { id: 2,  start: 48.0,  end: 88.0,  title_mr: "सुरक्षा आणि लॉगिन",       title_hi: "सुरक्षा और लॉगिन",     title_en: "Login & Authentication" },
  { id: 3,  start: 88.0,  end: 161.0, title_mr: "कार्यकारी डॅशबोर्ड",      title_hi: "मुख्य डैशबोर्ड",        title_en: "Executive Dashboard" },
  { id: 4,  start: 161.0, end: 201.0, title_mr: "ग्रुप नियम आणि सेटिंग्स", title_hi: "ग्रुप नियम और सेटिंग्स", title_en: "Group Settings & Rules" },
  { id: 5,  start: 201.0, end: 256.0, title_mr: "सभासद व्यवस्थापन",       title_hi: "सदस्य प्रबंधन",         title_en: "Member Management (M-1...)" },
  { id: 6,  start: 256.0, end: 307.0, title_mr: "मासिक बचत संकलन",        title_hi: "मासिक बचत संग्रह",      title_en: "Monthly Savings Collection" },
  { id: 7,  start: 307.0, end: 352.0, title_mr: "कर्ज वाटप आणि तरलता",     title_hi: "ऋण वितरण और तरलता",    title_en: "Loan Issuance & Liquidity" },
  { id: 8,  start: 352.0, end: 396.0, title_mr: "कर्ज परतफेड पद्धत",       title_hi: "ऋण चुकौती प्रक्रिया",  title_en: "Loan Repayment Workflow" },
  { id: 9,  start: 396.0, end: 444.0, title_mr: "वित्तीय अहवाल व नोंदवह्या", title_hi: "वित्तीय रिपोर्ट और रजिस्टर", title_en: "Financial Reports & Registers" },
  { id: 10, start: 444.0, end: 481.0, title_mr: "अलीकडील व्यवहारांचा ताळेबंद", title_hi: "हालिया लेनदेन खाता",  title_en: "Recent Transactions Ledger" },
  { id: 11, start: 481.0, end: 521.0, title_mr: "गणितीय आणि आर्थिक सूत्रे",  title_hi: "गणितीय और वित्तीय सूत्र", title_en: "Mathematical Business Logic" },
  { id: 12, start: 521.0, end: 561.0, title_mr: "तांत्रिक रचना व स्टॅक",   title_hi: "तकनीकी संरचना और स्टैक", title_en: "Technical Architecture" },
  { id: 13, start: 561.0, end: 589.0, title_mr: "निष्कर्ष आणि आभार",        title_hi: "निष्कर्ष और समापन",     title_en: "Conclusion & Closing Remarks" },
];

const LANG_NAMES = {
  mr: { name: "मराठी", label: "मराठी (Marathi)", toast: "मराठी ऑडिओ सुरू आहे 🌐" },
  hi: { name: "हिन्दी", label: "हिन्दी (Hindi)", toast: "हिन्दी ऑडियो सक्रिय है 🌐" },
  en: { name: "English", label: "English", toast: "English Audio Active 🌐" },
};

// DOM Elements
const video = document.getElementById('main-video');
const videoContainer = document.getElementById('video-container');
const audios = {
  mr: document.getElementById('audio-mr'),
  hi: document.getElementById('audio-hi'),
  en: document.getElementById('audio-en'),
};
let currentLang = 'mr'; // Default Marathi
let activeAudio = audios['mr'];
let subtitlesData = { mr: [], hi: [], en: [] };
let subtitlesEnabled = true;

// Controls
const btnPlay = document.getElementById('btn-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const centerPlayBtn = document.getElementById('center-play-btn');
const timelineContainer = document.getElementById('timeline-container');
const timelineProgress = document.getElementById('timeline-progress');
const timelineThumb = document.getElementById('timeline-thumb');
const timelineBuffer = document.getElementById('timeline-buffer');
const timelineTooltip = document.getElementById('timeline-tooltip');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const btnMute = document.getElementById('btn-mute');
const iconVolHigh = document.getElementById('icon-vol-high');
const iconVolMute = document.getElementById('icon-vol-mute');
const volumeSlider = document.getElementById('volume-slider');
const btnCC = document.getElementById('btn-cc');
const ccBadge = document.getElementById('cc-badge');
const subtitleText = document.getElementById('subtitle-text');
const btnSpeed = document.getElementById('btn-speed');
const speedDropdown = document.getElementById('speed-dropdown');
const btnLangMenu = document.getElementById('btn-lang-menu');
const langDropdown = document.getElementById('lang-dropdown');
const currentLangText = document.getElementById('current-lang-text');
const langToast = document.getElementById('lang-toast');
const btnFullscreen = document.getElementById('btn-fullscreen');
const iconFsEnter = document.getElementById('icon-fs-enter');
const iconFsExit = document.getElementById('icon-fs-exit');
const curChapNum = document.getElementById('cur-chap-num');
const curChapTitle = document.getElementById('cur-chap-title');
const chapterList = document.getElementById('chapter-list');
const chapterMarkers = document.getElementById('chapter-markers');

// Format Seconds -> MM:SS
function formatTime(sec) {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Parse VTT files
async function loadSubtitles(lang) {
  try {
    const res = await fetch(`../subtitles/${lang == 'mr' ? 'marathi' : (lang == 'hi' ? 'hindi' : 'english')}.vtt`);
    if (!res.ok) return;
    const text = await res.text();
    const cues = [];
    const pattern = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n|\Z)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const parseTime = (t) => {
        const parts = t.split(':');
        const sParts = parts[2].split('.');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(sParts[0]) + parseInt(sParts[1]) / 1000;
      };
      cues.push({
        start: parseTime(match[1]),
        end: parseTime(match[2]),
        text: match[3].replace(/\r?\n/g, ' ').trim()
      });
    }
    subtitlesData[lang] = cues;
  } catch (e) {
    console.warn("Subtitles load error:", e);
  }
}

// Build Chapter Sidebar & Markers
function buildChaptersUI() {
  const total = 589.0;
  chapterList.innerHTML = '';
  chapterMarkers.innerHTML = '';

  CHAPTERS.forEach((ch, idx) => {
    // Marker on timeline
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = `${(ch.start / total) * 100}%`;
    chapterMarkers.appendChild(marker);

    // Sidebar Item
    const item = document.createElement('div');
    item.className = `chapter-item ${idx === 0 ? 'active' : ''}`;
    item.id = `chapter-item-${ch.id}`;
    item.innerHTML = `
      <span class="chapter-num">${ch.id}</span>
      <div class="chapter-info">
        <span class="chapter-name">${ch[`title_${currentLang}`] || ch.title_en}</span>
        <span class="chapter-time">${formatTime(ch.start)}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      seekTo(ch.start);
      playMedia();
    });
    chapterList.appendChild(item);
  });
}

// Update Active Chapter Display
function updateCurrentChapter(t) {
  let active = CHAPTERS[0];
  for (let ch of CHAPTERS) {
    if (t >= ch.start && t < ch.end) {
      active = ch;
      break;
    }
  }
  curChapNum.textContent = active.id;
  curChapTitle.textContent = `${active[`title_${currentLang}`] || active.title_en} • ${active.title_en}`;

  document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.getElementById(`chapter-item-${active.id}`);
  if (activeEl) {
    activeEl.classList.add('active');
    // Keep visible in sidebar
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Playback Engine with Sync Guard
function playMedia() {
  video.muted = true; // Video track is pure visual
  activeAudio.currentTime = video.currentTime;
  
  Promise.all([video.play(), activeAudio.play()]).then(() => {
    videoContainer.classList.remove('paused');
    videoContainer.classList.add('playing');
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  }).catch(e => console.log("Play interrupted:", e));
}

function pauseMedia() {
  video.pause();
  activeAudio.pause();
  videoContainer.classList.add('paused');
  videoContainer.classList.remove('playing');
  iconPlay.style.display = 'block';
  iconPause.style.display = 'none';
}

function togglePlay() {
  if (video.paused) {
    playMedia();
  } else {
    pauseMedia();
  }
}

function seekTo(targetTime) {
  video.currentTime = targetTime;
  activeAudio.currentTime = targetTime;
  updateUI(targetTime);
}

// Switch Language Seamlessly
function setLanguage(lang) {
  if (lang === currentLang) return;
  
  const wasPlaying = !video.paused;
  const currentPos = video.currentTime;

  // Stop old audio
  activeAudio.pause();

  currentLang = lang;
  activeAudio = audios[lang];
  activeAudio.currentTime = currentPos;
  activeAudio.volume = volumeSlider.value;
  activeAudio.muted = video.muted && volumeSlider.value == 0;

  // Update Buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
  document.querySelectorAll('#lang-dropdown .dropdown-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-lang') === lang);
  });
  currentLangText.textContent = LANG_NAMES[lang].name;

  // Update Chapter titles
  CHAPTERS.forEach(ch => {
    const item = document.getElementById(`chapter-item-${ch.id}`);
    if (item) {
      const nameEl = item.querySelector('.chapter-name');
      if (nameEl) nameEl.textContent = ch[`title_${currentLang}`] || ch.title_en;
    }
  });
  updateCurrentChapter(currentPos);
  updateUI(currentPos);

  // Show Toast
  langToast.textContent = LANG_NAMES[lang].toast;
  langToast.classList.add('show');
  setTimeout(() => langToast.classList.remove('show'), 2000);

  // Resume playback seamlessly
  if (wasPlaying) {
    Promise.all([video.play(), activeAudio.play()]).catch(() => {});
  }
}

// Main Time Update Loop
function updateUI(currentTime) {
  const duration = video.duration || 589.0;
  timeCurrent.textContent = formatTime(currentTime);
  timeTotal.textContent = formatTime(duration);

  // Timeline position
  const pct = Math.min((currentTime / duration) * 100, 100);
  timelineProgress.style.width = `${pct}%`;
  timelineThumb.style.left = `${pct}%`;

  // Update Subtitle Text
  if (subtitlesEnabled && subtitlesData[currentLang]) {
    const currentCue = subtitlesData[currentLang].find(c => currentTime >= c.start && currentTime <= c.end);
    if (currentCue) {
      subtitleText.textContent = currentCue.text;
    } else {
      subtitleText.textContent = '';
    }
  } else {
    subtitleText.textContent = '';
  }

  // Update Chapter
  updateCurrentChapter(currentTime);

  // Synchronizer Guard (Fix drift > 60ms)
  if (!video.paused && Math.abs(activeAudio.currentTime - video.currentTime) > 0.06) {
    activeAudio.currentTime = video.currentTime;
  }
}

// Event Listeners
video.addEventListener('timeupdate', () => updateUI(video.currentTime));
video.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(video.duration || 589.0);
});

// Buffer Progress
video.addEventListener('progress', () => {
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const duration = video.duration || 589.0;
    timelineBuffer.style.width = `${(bufferedEnd / duration) * 100}%`;
  }
});

// Play / Pause events
btnPlay.addEventListener('click', togglePlay);
centerPlayBtn.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);

// Timeline Scrubbing
let isScrubbing = false;
function handleScrub(e) {
  const rect = timelineContainer.getBoundingClientRect();
  const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const pct = clickX / rect.width;
  const duration = video.duration || 589.0;
  seekTo(pct * duration);
}

timelineContainer.addEventListener('mousedown', (e) => {
  isScrubbing = true;
  handleScrub(e);
});

window.addEventListener('mousemove', (e) => {
  if (isScrubbing) handleScrub(e);
  
  // Tooltip
  const rect = timelineContainer.getBoundingClientRect();
  if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top - 10 && e.clientY <= rect.bottom + 10) {
    const hoverX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = hoverX / rect.width;
    const duration = video.duration || 589.0;
    timelineTooltip.style.left = `${hoverX}px`;
    timelineTooltip.textContent = formatTime(pct * duration);
    timelineTooltip.style.display = 'block';
  } else {
    timelineTooltip.style.display = 'none';
  }
});

window.addEventListener('mouseup', () => {
  if (isScrubbing) isScrubbing = false;
});

// Volume & Mute
volumeSlider.addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value);
  activeAudio.volume = vol;
  if (vol === 0) {
    iconVolHigh.style.display = 'none';
    iconVolMute.style.display = 'block';
  } else {
    iconVolHigh.style.display = 'block';
    iconVolMute.style.display = 'none';
  }
});

btnMute.addEventListener('click', () => {
  if (activeAudio.volume > 0) {
    activeAudio.dataset.prevVol = activeAudio.volume;
    activeAudio.volume = 0;
    volumeSlider.value = 0;
    iconVolHigh.style.display = 'none';
    iconVolMute.style.display = 'block';
  } else {
    const prev = parseFloat(activeAudio.dataset.prevVol || 1);
    activeAudio.volume = prev;
    volumeSlider.value = prev;
    iconVolHigh.style.display = 'block';
    iconVolMute.style.display = 'none';
  }
});

// Subtitles Toggle
btnCC.addEventListener('click', () => {
  subtitlesEnabled = !subtitlesEnabled;
  ccBadge.classList.toggle('active', subtitlesEnabled);
  if (!subtitlesEnabled) subtitleText.textContent = '';
});

// Playback Speed
btnSpeed.addEventListener('click', (e) => {
  e.stopPropagation();
  speedDropdown.classList.toggle('show');
  langDropdown.classList.remove('show');
});

document.querySelectorAll('#speed-dropdown .dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    const speed = parseFloat(item.dataset.speed);
    video.playbackRate = speed;
    activeAudio.playbackRate = speed;
    btnSpeed.textContent = `${speed}x`;
    document.querySelectorAll('#speed-dropdown .dropdown-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    speedDropdown.classList.remove('show');
  });
});

// Language Select Dropdown
btnLangMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  langDropdown.classList.toggle('show');
  speedDropdown.classList.remove('show');
});

document.querySelectorAll('#lang-dropdown .dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    setLanguage(item.dataset.lang);
    langDropdown.classList.remove('show');
  });
});

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
  });
});

// Close Dropdowns on outside click
window.addEventListener('click', () => {
  speedDropdown.classList.remove('show');
  langDropdown.classList.remove('show');
});

// Fullscreen
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    videoContainer.requestFullscreen().catch(() => {});
    iconFsEnter.style.display = 'none';
    iconFsExit.style.display = 'block';
  } else {
    document.exitFullscreen();
    iconFsEnter.style.display = 'block';
    iconFsExit.style.display = 'none';
  }
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    iconFsEnter.style.display = 'block';
    iconFsExit.style.display = 'none';
  }
});

// Keyboard Controls
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

  switch (e.code) {
    case 'Space':
    case 'KeyK':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      seekTo(Math.max(0, video.currentTime - 5));
      break;
    case 'ArrowRight':
      e.preventDefault();
      seekTo(Math.min(video.duration || 589, video.currentTime + 5));
      break;
    case 'KeyM':
      btnMute.click();
      break;
    case 'KeyF':
      btnFullscreen.click();
      break;
    case 'KeyC':
      btnCC.click();
      break;
    case 'Digit1':
      setLanguage('mr');
      break;
    case 'Digit2':
      setLanguage('hi');
      break;
    case 'Digit3':
      setLanguage('en');
      break;
  }
});

// Hide controls when playing & idle
let controlsTimeout;
videoContainer.addEventListener('mousemove', () => {
  videoContainer.classList.remove('hide-controls');
  clearTimeout(controlsTimeout);
  if (!video.paused) {
    controlsTimeout = setTimeout(() => {
      videoContainer.classList.add('hide-controls');
    }, 2800);
  }
});

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  buildChaptersUI();
  if (window.SUBTITLES) { subtitlesData = window.SUBTITLES; } else { await Promise.all([loadSubtitles('mr'), loadSubtitles('hi'), loadSubtitles('en')]); }
  videoContainer.classList.add('paused');
  updateUI(0);
});
