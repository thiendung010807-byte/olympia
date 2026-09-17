const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const isPresentation = new URLSearchParams(location.search).get('mode') === 'present'
  || /^\/trinh-chieu\/?$/i.test(location.pathname);

const stage = $('#stage');
const video = $('#introVideo');
const kickoffVideo = $('#kickoffVideo');
const obstacleVideo = $('#obstacleVideo');
const speedVideo = $('#speedVideo');
const finishVideo = $('#finishVideo');
const kickoffOutroVideo = $('#kickoffOutroVideo');
const obstacleOutroVideo = $('#obstacleOutroVideo');
const slideNumber = $('#slideNumber');
const stateLabel = $('#stateLabel');
const dockContext = $('#dockContext');
const previousSlide = $('#previousSlide');
const nextSlide = $('#nextSlide');
const playPauseButton = $('#playPauseButton');
const playLabel = $('#playLabel');
const progressFill = $('#progressFill');

const teams = [
  { name: 'NHÓM 1', score: 0 },
  { name: 'NHÓM 2', score: 0 },
  { name: 'NHÓM 3', score: 0 },
];

const privateQuestions = teams.map((team) =>
  Array.from({ length: 15 }, (_, index) => `Nội dung câu hỏi riêng số ${index + 1} dành cho ${team.name}`),
);
const commonQuestions = Array.from(
  { length: 15 },
  (_, index) => `Nội dung câu hỏi chung số ${index + 1} dành cho cả ba nhóm`,
);
const obstacleQuestions = Array.from(
  { length: 7 },
  (_, index) => `Nội dung câu hỏi Vượt Chướng Ngại Vật số ${index + 1}`,
);
const speedQuestions = Array.from(
  { length: 24 },
  (_, index) => `Nội dung câu hỏi Tăng Tốc số ${index + 1}`,
);
const finishQuestions = teams.map((team) => Array.from({ length: 4 }, (_, index) => `Nội dung câu hỏi Về Đích số ${index + 1} dành cho ${team.name}`));
const privateAnswers = teams.map(() => Array(15).fill(''));
const commonAnswers = Array(15).fill('');
const obstacleAnswers = Array(7).fill('');
const speedAnswers = Array(24).fill('');
const finishAnswers = teams.map(() => Array(4).fill(''));
const speedResponseTimes = Array.from({ length: 24 }, () => Array(3).fill(null));
const questionBank = { private: privateQuestions, common: commonQuestions, obstacle: obstacleQuestions, speed: speedQuestions, finish: finishQuestions };
const answerBank = { private: privateAnswers, common: commonAnswers, obstacle: obstacleAnswers, speed: speedAnswers, finish: finishAnswers };
const blankMedia = () => ({ mode: 'text', audioUrl: '', visualUrl: '', visualType: '' });
const mediaBank = {
  private: teams.map(() => Array.from({ length: 15 }, blankMedia)), common: Array.from({ length: 15 }, blankMedia),
  obstacle: Array.from({ length: 7 }, blankMedia), speed: Array.from({ length: 24 }, blankMedia),
  finish: teams.map(() => Array.from({ length: 4 }, blankMedia)),
};
const roundVideos = { kickoffOutroUrl: '', obstacleOutroUrl: '' };
const questionAudio = new Audio();
let lastQuestionMediaKey = '';

const slideContexts = [
  'INTRO · 00:31', 'GIỚI THIỆU NHÓM', 'INTRO KHỞI ĐỘNG', 'KHỞI ĐỘNG', 'LUẬT CHƠI',
  'LƯỢT RIÊNG', 'KẾT QUẢ', 'LƯỢT CHUNG', 'CÂU HỎI CHUNG', 'KẾT QUẢ',
  'INTRO VƯỢT CHƯỚNG NGẠI VẬT', 'VƯỢT CHƯỚNG NGẠI VẬT', 'LUẬT CHƠI',
  'BÀN CHƠI', 'CÂU TRẢ LỜI', 'KẾT QUẢ',
  'INTRO TĂNG TỐC', 'TĂNG TỐC', 'LUẬT CHƠI', 'BÀN CHƠI', 'CÂU TRẢ LỜI', 'KẾT QUẢ',
  'INTRO VỀ ĐÍCH', 'VỀ ĐÍCH', 'LUẬT CHƠI',
  'CHỌN GÓI · LƯỢT 1', 'VỀ ĐÍCH · LƯỢT 1', 'KẾT QUẢ',
  'CHỌN GÓI · LƯỢT 2', 'VỀ ĐÍCH · LƯỢT 2', 'KẾT QUẢ',
  'CHỌN GÓI · LƯỢT 3', 'VỀ ĐÍCH · LƯỢT 3', 'KẾT QUẢ CHUNG CUỘC',
  'VIDEO KẾT THÚC KHỞI ĐỘNG', 'VIDEO KẾT THÚC VƯỢT CHƯỚNG NGẠI VẬT',
];

let currentSlide = 1;
let privateTeamIndex = 0;
let privateQuestionIndex = 0;
let commonQuestionIndex = 0;
let commonSelectedTeam = null;
let privateCanJudge = false;
let commonCanJudge = false;
let obstacleQuestionIndex = null;
let obstacleRevealed = Array(7).fill(false);
let obstacleWrongTeams = new Set();
let speedQuestionIndex = 0;
let speedWrongTeams = new Set();
let finishOrder = [];
const finishPacks = teams.map(() => [20, 20, 20, 20]);
const finishProgress = teams.map(() => 0);
const finishStarsUsed = new Set();
let finishStarActive = false;
let finishQuestionRevealed = false;
let finishCanJudge = false;
let finishSteal = { active: false, round: null, activeTeam: null, winner: null, points: 0 };
let stealInterval = null;
let questionStartedAt = null;
let timerActive = false;
let timerInterval = null;
let introPlayback = { playing: false, startedAt: null, position: 0, revision: 0 };
let lastAppliedIntroRevision = -1;
let lastResetToken = null;

const signalStateChange = () => window.dispatchEvent(new CustomEvent('olympia-state-change'));

const formatTime = (value) => {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
};

const setState = (state, label) => {
  stage.dataset.state = state;
  stateLabel.textContent = label;
  const playing = state === 'playing';
  playPauseButton.classList.toggle('is-paused', playing);
  playLabel.textContent = playing ? 'Tạm dừng' : 'Phát';
};

const currentAnswer = () => {
  if (currentSlide === 6) return privateAnswers[privateTeamIndex]?.[privateQuestionIndex] ?? '';
  if (currentSlide === 9) return commonAnswers[commonQuestionIndex] ?? '';
  if ([14, 15].includes(currentSlide) && obstacleQuestionIndex !== null) return obstacleAnswers[obstacleQuestionIndex] ?? '';
  if ([20, 21].includes(currentSlide)) return speedAnswers[speedQuestionIndex] ?? '';
  const round = { 27: 0, 30: 1, 33: 2 }[currentSlide];
  if (round !== undefined) {
    const teamIndex = finishTeamForRound(round);
    return finishAnswers[teamIndex]?.[Math.min(finishProgress[teamIndex], 3)] ?? '';
  }
  return null;
};

const renderAdminAnswerKey = () => {
  const panel = $('#adminAnswerKey');
  const answer = currentAnswer();
  panel.hidden = answer === null;
  if (answer !== null) panel.querySelector('strong').textContent = answer.trim() || 'Chưa nhập đáp án';
};

const editorRoundMeta = {
  private: { count: 15, teams: true }, common: { count: 15, teams: false }, obstacle: { count: 7, teams: false },
  speed: { count: 24, teams: false }, finish: { count: 4, teams: true },
};

const editorLocation = () => {
  const round = $('#editorRound').value;
  const team = Number($('#editorTeam').value) || 0;
  const question = Number($('#editorQuestion').value) || 0;
  return { round, team, question, meta: editorRoundMeta[round] };
};

const loadEditorContent = () => {
  const { round, team, question, meta } = editorLocation();
  $('#editorTeamWrap').hidden = !meta.teams;
  const questions = meta.teams ? questionBank[round][team] : questionBank[round];
  const answers = meta.teams ? answerBank[round][team] : answerBank[round];
  const media = meta.teams ? mediaBank[round][team] : mediaBank[round];
  $('#editorQuestionText').value = questions[question] ?? '';
  $('#editorAnswerText').value = answers[question] ?? '';
  $('#editorQuestionMode').value = media[question]?.mode || 'text';
  $('#editorAudioWrap').hidden = $('#editorQuestionMode').value !== 'audio';
  $('#editorVisualWrap').hidden = round !== 'speed';
  $('#editorSaveStatus').textContent = '';
};

const refreshEditorQuestions = () => {
  const round = $('#editorRound').value;
  const meta = editorRoundMeta[round];
  $('#editorQuestion').innerHTML = Array.from({ length: meta.count }, (_, index) => `<option value="${index}">Câu ${index + 1}${round === 'obstacle' && index === 6 ? ' · Gợi ý trung tâm' : ''}</option>`).join('');
  loadEditorContent();
};

const openQuestionEditor = () => {
  $('#questionEditor').hidden = false;
  refreshEditorQuestions();
};

const closeQuestionEditor = () => { $('#questionEditor').hidden = true; };

const saveQuestionContent = async () => {
  const { round, team, question, meta } = editorLocation();
  const questions = meta.teams ? questionBank[round][team] : questionBank[round];
  const answers = meta.teams ? answerBank[round][team] : answerBank[round];
  const media = meta.teams ? mediaBank[round][team] : mediaBank[round];
  const status = $('#editorSaveStatus');
  status.textContent = 'Đang lưu…';
  try {
  questions[question] = $('#editorQuestionText').value.trim();
  answers[question] = $('#editorAnswerText').value.trim();
  media[question].mode = $('#editorQuestionMode').value;
  const audioFile = $('#editorAudioFile').files[0];
  const visualFile = $('#editorVisualFile').files[0];
  if (audioFile) media[question].audioUrl = (await window.OlympiaSync.uploadMedia(audioFile)).publicUrl;
  if (visualFile) {
    media[question].visualUrl = (await window.OlympiaSync.uploadMedia(visualFile)).publicUrl;
    media[question].visualType = visualFile.type.startsWith('video/') ? 'video' : 'image';
  }
  const kickoffOutro = $('#editorKickoffOutroFile').files[0];
  const obstacleOutro = $('#editorObstacleOutroFile').files[0];
  if (kickoffOutro) roundVideos.kickoffOutroUrl = (await window.OlympiaSync.uploadMedia(kickoffOutro)).publicUrl;
  if (obstacleOutro) roundVideos.obstacleOutroUrl = (await window.OlympiaSync.uploadMedia(obstacleOutro)).publicUrl;
  await window.OlympiaSync.saveContent(getContent());
  renderCurrentSynchronizedSlide();
  renderAdminAnswerKey();
  signalStateChange();
  status.textContent = 'Đã lưu bền vững và đồng bộ';
  } catch (error) { status.textContent = `Lỗi lưu: ${error.message}`; }
};

const clearCountdown = () => {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerActive = false;
  $$('.timer-button').forEach((button) => button.classList.remove('running'));
};

const countdown = ({ display, button, onStart, onEnd, duration = 5 }) => {
  clearCountdown();
  questionStartedAt = new Date().toISOString();
  timerActive = true;
  let seconds = duration;
  display.textContent = seconds;
  button.classList.add('running');
  button.querySelector('small').textContent = 'ĐANG ĐẾM';
  onStart?.();
  timerInterval = window.setInterval(() => {
    seconds -= 1;
    display.textContent = seconds;
    if (seconds <= 0) {
      clearCountdown();
      button.querySelector('small').textContent = 'HẾT GIỜ';
      onEnd?.();
    }
  }, 1000);
};

const teamStripMarkup = (selectable = false) => teams.map((team, index) => {
  const active = currentSlide === 6 && index === privateTeamIndex ? ' active' : '';
  const selected = currentSlide === 9 && index === commonSelectedTeam ? ' selected' : '';
  const tag = selectable ? 'button' : 'div';
  return `<${tag} class="team-pill${active}${selected}" ${selectable ? `type="button" data-team="${index}"` : ''}><span class="mini-number">${index + 1}</span><strong>${team.name}</strong><b>${team.score}</b></${tag}>`;
}).join('');

const renderTeamStrips = () => {
  $('#privateTeamStrip').innerHTML = teamStripMarkup(false);
  $('#commonTeamStrip').innerHTML = teamStripMarkup(true);
  $$('#commonTeamStrip [data-team]').forEach((button) => {
    button.addEventListener('click', () => selectCommonTeam(Number(button.dataset.team)));
  });
};

const renderPrivateRound = () => {
  const team = teams[privateTeamIndex];
  $('#privateTeamName').textContent = team.name;
  $('#privateQuestionNumber').textContent = `CÂU ${String(privateQuestionIndex + 1).padStart(2, '0')} / 15`;
  $('#privateTeamProgress').textContent = `${team.name} · LƯỢT RIÊNG`;
  const media = mediaBank.private[privateTeamIndex][privateQuestionIndex];
  $('#privateQuestion').textContent = media?.mode === 'audio' ? 'CÂU HỎI ÂM THANH' : privateQuestions[privateTeamIndex][privateQuestionIndex];
  playQuestionAudio(media, `private-${privateTeamIndex}-${privateQuestionIndex}`);
  $('#privateTimer').textContent = '5';
  $('#privateTimerButton small').textContent = 'BẮT ĐẦU';
  privateCanJudge = false;
  $('#privateCorrect').disabled = true;
  $('#privateWrong').disabled = true;
  renderTeamStrips();
  renderAdminAnswerKey();
};

const startPrivateTimer = () => countdown({
  display: $('#privateTimer'),
  button: $('#privateTimerButton'),
  onStart: () => {
    privateCanJudge = true;
    $('#privateCorrect').disabled = false;
    $('#privateWrong').disabled = false;
  },
});

const advancePrivate = () => {
  clearCountdown();
  if (privateQuestionIndex < 14) privateQuestionIndex += 1;
  else if (privateTeamIndex < 2) {
    privateTeamIndex += 1;
    privateQuestionIndex = 0;
  } else {
    goToSlide(7);
    return;
  }
  renderPrivateRound();
};

const judgePrivate = (correct) => {
  if (!privateCanJudge) return;
  if (correct) teams[privateTeamIndex].score += 10;
  privateCanJudge = false;
  advancePrivate();
};

const renderCommonRound = () => {
  $('#commonQuestionNumber').textContent = `CÂU ${String(commonQuestionIndex + 1).padStart(2, '0')} / 15`;
  const media = mediaBank.common[commonQuestionIndex];
  $('#commonQuestion').textContent = media?.mode === 'audio' ? 'CÂU HỎI ÂM THANH' : commonQuestions[commonQuestionIndex];
  playQuestionAudio(media, `common-${commonQuestionIndex}`);
  $('#commonPhaseLabel').textContent = commonSelectedTeam === null ? 'GIÀNH QUYỀN TRẢ LỜI' : `${teams[commonSelectedTeam].name} ĐANG TRẢ LỜI`;
  $('#selectHint').textContent = commonSelectedTeam === null ? 'Chọn nhóm giành quyền trả lời' : `${teams[commonSelectedTeam].name} đã giành quyền`;
  $('#commonTimer').textContent = '5';
  $('#commonTimerButton small').textContent = commonSelectedTeam === null ? 'BẮT ĐẦU' : 'TRẢ LỜI';
  commonCanJudge = false;
  $('#commonCorrect').disabled = true;
  $('#commonWrong').disabled = true;
  renderTeamStrips();
  renderAdminAnswerKey();
};

const selectCommonTeam = (index) => {
  clearCountdown();
  commonSelectedTeam = index;
  renderCommonRound();
};

const startCommonTimer = () => countdown({
  display: $('#commonTimer'),
  button: $('#commonTimerButton'),
  onStart: () => {
    if (commonSelectedTeam !== null) {
      commonCanJudge = true;
      $('#commonCorrect').disabled = false;
      $('#commonWrong').disabled = false;
    }
  },
});

const advanceCommon = () => {
  clearCountdown();
  if (commonQuestionIndex < 14) {
    commonQuestionIndex += 1;
    commonSelectedTeam = null;
    renderCommonRound();
  } else goToSlide(10);
};

const judgeCommon = (correct) => {
  if (!commonCanJudge || commonSelectedTeam === null) return;
  teams[commonSelectedTeam].score += correct ? 10 : -5;
  commonCanJudge = false;
  advanceCommon();
};

const scoreboardMarkup = (orderedTeams = teams, highlightFirst = false) => orderedTeams.map((team, index) => `
  <article class="score-card${highlightFirst && index === 0 ? ' winner' : ''}">
    <h3>${team.name}</h3><strong>${team.score}</strong><span>ĐIỂM</span>
  </article>`).join('');

const renderScoreboards = () => {
  $('#privateScoreboard').innerHTML = scoreboardMarkup();
  $('#finalScoreboard').innerHTML = scoreboardMarkup();
  $('#obstacleScoreboard').innerHTML = scoreboardMarkup();
  $('#speedScoreboard').innerHTML = scoreboardMarkup();
  $('#finishScoreboard1').innerHTML = scoreboardMarkup();
  $('#finishScoreboard2').innerHTML = scoreboardMarkup();
  $('#championScoreboard').innerHTML = scoreboardMarkup([...teams].sort((a, b) => b.score - a.score), true);
};

const playQuestionAudio = (media, key) => {
  if (!media?.audioUrl || media.mode !== 'audio' || lastQuestionMediaKey === key) return;
  lastQuestionMediaKey = key;
  questionAudio.src = media.audioUrl;
  questionAudio.currentTime = 0;
  questionAudio.play().catch(() => window.dispatchEvent(new CustomEvent('olympia-media-blocked')));
};

const renderObstacleGame = () => {
  const hasSelection = obstacleQuestionIndex !== null;
  $('#obstacleQuestionNumber').textContent = hasSelection ? String(obstacleQuestionIndex + 1).padStart(2, '0') : '--';
  $('#obstacleQuestionLabel').textContent = hasSelection ? (obstacleQuestionIndex < 6 ? `TỪ HÀNG NGANG ${obstacleQuestionIndex + 1}` : 'GỢI Ý TRUNG TÂM') : 'CHỌN CÂU HỎI';
  const obstacleMedia = hasSelection ? mediaBank.obstacle[obstacleQuestionIndex] : null;
  $('#obstacleQuestion').textContent = hasSelection ? (obstacleMedia?.mode === 'audio' ? 'CÂU HỎI ÂM THANH' : obstacleQuestions[obstacleQuestionIndex]) : 'Admin nhấn một mảnh ghép từ 1–7 để chọn câu hỏi.';
  if (hasSelection) playQuestionAudio(obstacleMedia, `obstacle-${obstacleQuestionIndex}`);
  $('#obstacleTimer').textContent = '15';
  $('#obstacleTimerButton small').textContent = 'BẮT ĐẦU';
  $('#obstacleTimerButton').disabled = !hasSelection;
  $('#puzzleBoard').innerHTML = obstacleRevealed.map((revealed, index) => `<button type="button" aria-label="Chọn câu hỏi ${index + 1}" class="puzzle-piece${revealed ? ' revealed' : ''}${index === obstacleQuestionIndex ? ' current' : ''}" data-obstacle-piece="${index}" ${revealed ? 'disabled' : ''}>${revealed ? '' : index + 1}</button>`).join('');
  const answerLength = (value) => [...String(value || '').replace(/\s/g, '')].length;
  $('#obstacleAnswerLength').textContent = `${answerLength(obstacleAnswers[6])} CHỮ CÁI`;
  $('#obstacleClueList').innerHTML = obstacleAnswers.slice(0, 6).map((answer, index) => {
    const count = answerLength(answer);
    return `
    <div class="clue-row${obstacleRevealed[index] ? ' revealed' : ''}${index === obstacleQuestionIndex ? ' current' : ''}">
      <strong>${index + 1}</strong><div class="letter-dots">${Array.from({ length: count }, () => '<i class="letter-dot"></i>').join('')}</div><span>${count} chữ</span>
    </div>`;
  }).join('');
  $$('[data-obstacle-piece]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.obstaclePiece);
    if (index === 6) {
      obstacleRevealed[6] = true;
      obstacleQuestionIndex = null;
      renderObstacleGame();
      if (obstacleRevealed.every(Boolean)) window.setTimeout(() => goToSlide(16), 500);
      return;
    }
    obstacleQuestionIndex = index;
    renderObstacleGame();
  }));
  renderAdminAnswerKey();
};

const startObstacleTimer = () => {
  if (obstacleQuestionIndex === null) return;
  countdown({
  display: $('#obstacleTimer'),
  button: $('#obstacleTimerButton'),
  duration: 15,
  onEnd: () => goToSlide(15),
  });
};

const renderObstacleResponses = () => {
  $('#responseQuestionNumber').textContent = obstacleQuestionIndex === null ? '--' : String(obstacleQuestionIndex + 1).padStart(2, '0');
  $('#confirmObstacleResponses').disabled = obstacleQuestionIndex === null;
  $('#obstacleResponseCards').innerHTML = teams.map((team, index) => `
    <button class="response-card${obstacleWrongTeams.has(index) ? ' wrong' : ''}" type="button" data-response-team="${index}">
      <strong>${team.name}</strong><p></p><span class="answer-orb"></span>
    </button>`).join('');
  $$('[data-response-team]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.responseTeam);
    if (obstacleWrongTeams.has(index)) obstacleWrongTeams.delete(index);
    else obstacleWrongTeams.add(index);
    renderObstacleResponses();
  }));
  renderAdminAnswerKey();
  window.queueMicrotask(() => window.dispatchEvent(new CustomEvent('olympia-responses-rendered')));
};

const confirmObstacleResponses = () => {
  if (obstacleQuestionIndex === null) return;
  teams.forEach((team, index) => { if (!obstacleWrongTeams.has(index)) team.score += 10; });
  obstacleRevealed[obstacleQuestionIndex] = true;
  obstacleWrongTeams = new Set();
  obstacleQuestionIndex = null;
  if (obstacleRevealed.every(Boolean)) goToSlide(16);
  else goToSlide(14);
};

const speedDuration = () => (speedQuestionIndex < 12 ? 20 : 30);

const renderSpeedGame = () => {
  const duration = speedDuration();
  $('#speedQuestionNumber').textContent = String(speedQuestionIndex + 1).padStart(2, '0');
  $('#speedQuestionTime').textContent = `${duration} GIÂY`;
  const media = mediaBank.speed[speedQuestionIndex];
  $('#speedQuestion').textContent = media?.mode === 'audio' ? 'CÂU HỎI ÂM THANH' : speedQuestions[speedQuestionIndex];
  playQuestionAudio(media, `speed-${speedQuestionIndex}`);
  const mediaBox = $('#speedMedia');
  if (media?.visualUrl) mediaBox.innerHTML = media.visualType === 'video' ? `<video src="${media.visualUrl}" autoplay playsinline controls></video>` : `<img src="${media.visualUrl}" alt="Minh họa câu hỏi"/>`;
  else mediaBox.innerHTML = '<strong>HÌNH ẢNH / VIDEO CÂU HỎI</strong><small>Chưa có tệp minh họa</small>';
  $('#speedTimer').textContent = String(duration);
  $('#speedTimerButton small').textContent = 'BẮT ĐẦU';
  $('#speedTeamScores').innerHTML = teams.map((team) => `<span><b>${team.name}</b><strong>${team.score}</strong></span>`).join('');
  renderAdminAnswerKey();
};

const startSpeedTimer = () => countdown({
  display: $('#speedTimer'),
  button: $('#speedTimerButton'),
  duration: speedDuration(),
  onEnd: () => goToSlide(21),
});

const renderSpeedResponses = () => {
  $('#speedResponseQuestionNumber').textContent = String(speedQuestionIndex + 1).padStart(2, '0');
  $('#speedResponseCards').innerHTML = teams.map((team, index) => `
    <button class="response-card speed-response-card${speedWrongTeams.has(index) ? ' wrong' : ''}" type="button" data-speed-response-team="${index}">
      <strong>${team.name}</strong><p></p><time>${Number.isFinite(speedResponseTimes[speedQuestionIndex][index]) ? `${speedResponseTimes[speedQuestionIndex][index].toFixed(2)} giây` : ''}</time>
    </button>`).join('');
  $$('[data-speed-response-team]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.speedResponseTeam);
    if (speedWrongTeams.has(index)) speedWrongTeams.delete(index);
    else speedWrongTeams.add(index);
    renderSpeedResponses();
  }));
  renderAdminAnswerKey();
  window.queueMicrotask(() => window.dispatchEvent(new CustomEvent('olympia-responses-rendered')));
};

const confirmSpeedResponses = () => {
  const ranking = teams
    .map((team, index) => ({ team, index, time: speedResponseTimes[speedQuestionIndex][index] }))
    .filter(({ index, time }) => !speedWrongTeams.has(index) && Number.isFinite(time))
    .sort((a, b) => a.time - b.time);
  ranking.forEach(({ team }, rank) => { team.score += [40, 30, 20][rank] ?? 0; });
  speedWrongTeams = new Set();
  if (speedQuestionIndex < 23) {
    speedQuestionIndex += 1;
    goToSlide(20);
  } else goToSlide(22);
};

const ensureFinishOrder = () => {
  if (finishOrder.length) return;
  finishOrder = teams
    .map((team, index) => ({ index, score: team.score }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ index }) => index);
};

const finishTeamForRound = (round) => {
  ensureFinishOrder();
  return finishOrder[round];
};

const renderFinishSelection = (round) => {
  const section = $(`[data-finish-selection-round="${round}"]`);
  const teamIndex = finishTeamForRound(round);
  section.querySelector('.finish-select-team').textContent = `${teams[teamIndex].name} · ${teams[teamIndex].score} ĐIỂM`;
  section.querySelector('.finish-pack-options').innerHTML = finishPacks[teamIndex].map((points, index) => `
    <button class="finish-point-card${points === 30 ? ' thirty' : ''}" type="button" data-finish-slot="${index}">
      <small>CÂU ${index + 1}</small><strong>${points}</strong><span>ĐIỂM</span>
    </button>`).join('');
  section.querySelectorAll('[data-finish-slot]').forEach((button) => button.addEventListener('click', () => {
    const slot = Number(button.dataset.finishSlot);
    finishPacks[teamIndex][slot] = finishPacks[teamIndex][slot] === 20 ? 30 : 20;
    renderFinishSelection(round);
  }));
};

const finishQuestionText = (teamIndex, questionIndex) => finishQuestions[teamIndex]?.[questionIndex] ?? '';

const renderFinishGame = (round) => {
  const section = $(`[data-finish-game-round="${round}"]`);
  const teamIndex = finishTeamForRound(round);
  const questionIndex = Math.min(finishProgress[teamIndex], 3);
  const points = finishPacks[teamIndex][questionIndex];
  const starUsed = finishStarsUsed.has(teamIndex);
  const duration = points === 20 ? 15 : 20;
  section.querySelector('.finish-game-team').textContent = teams[teamIndex].name;
  section.querySelector('.finish-score-strip').innerHTML = teams.map((team, index) => `<span class="${index === teamIndex ? 'active' : ''}"><b>${team.name}</b><strong>${team.score}</strong></span>`).join('');
  section.querySelector('.finish-question-label').textContent = `CÂU ${questionIndex + 1} / 4 · ${points} ĐIỂM`;
  const finishMedia = mediaBank.finish[teamIndex][questionIndex];
  section.querySelector('.finish-question-text').textContent = finishQuestionRevealed ? (finishMedia?.mode === 'audio' ? 'CÂU HỎI ÂM THANH' : finishQuestionText(teamIndex, questionIndex)) : 'CHỜ CHỌN NGÔI SAO HY VỌNG';
  if (finishQuestionRevealed) playQuestionAudio(finishMedia, `finish-${teamIndex}-${questionIndex}`);
  let starChoice = section.querySelector('.finish-star-choice');
  if (!starChoice) {
    starChoice = document.createElement('div');
    starChoice.className = 'finish-star-choice';
    starChoice.innerHTML = '<strong>SỬ DỤNG NGÔI SAO HY VỌNG?</strong><button type="button" data-star-choice="yes">CÓ</button><button type="button" data-star-choice="no">KHÔNG</button>';
    section.querySelector('.finish-question-panel').append(starChoice);
    starChoice.querySelectorAll('[data-star-choice]').forEach((button) => button.addEventListener('click', () => {
      if (isPresentation) return;
      finishStarActive = button.dataset.starChoice === 'yes';
      if (finishStarActive) finishStarsUsed.add(teamIndex);
      finishQuestionRevealed = true;
      renderFinishGame(round);
      signalStateChange();
    }));
  }
  starChoice.hidden = starUsed || finishQuestionRevealed;
  const timerButton = section.querySelector('.finish-timer');
  timerButton.querySelector('span').textContent = duration;
  timerButton.querySelector('small').textContent = 'BẮT ĐẦU';
  const starButton = section.querySelector('.finish-star');
  starButton.classList.toggle('active', finishStarActive);
  starButton.disabled = starUsed;
  starButton.lastChild.textContent = starUsed ? ' ĐÃ DÙNG NGÔI SAO' : ' NGÔI SAO HY VỌNG';
  const multiplier = finishStarActive ? 2 : 1;
  section.querySelector('.finish-correct').innerHTML = `ĐÚNG <b>+${points * multiplier}</b>`;
  section.querySelector('.finish-wrong').innerHTML = `SAI <b>${finishStarActive ? `−${points}` : '+0'}</b>`;
  section.querySelector('.finish-correct').disabled = !finishCanJudge;
  section.querySelector('.finish-wrong').disabled = !finishCanJudge;
  section.querySelector('.finish-pack-status').innerHTML = finishPacks[teamIndex].map((value, index) => `<span class="${index < questionIndex ? 'done' : ''}${index === questionIndex ? ' current' : ''}">${value}</span>`).join('');
  const stealPanel = section.querySelector('.finish-steal-panel');
  const stealing = finishSteal.active && finishSteal.round === round;
  stealPanel.hidden = !stealing;
  if (stealing) {
    const status = stealPanel.querySelector('span');
    status.textContent = finishSteal.winner === null ? '5 GIÂY GIÀNH QUYỀN' : `${teams[finishSteal.winner].name} GIÀNH QUYỀN`;
    stealPanel.querySelector('.finish-buzz-teams').innerHTML = teams.map((team, index) => index === teamIndex ? '' : `<button type="button" data-finish-buzz="${index}" ${finishSteal.winner !== null ? 'disabled' : ''}>${team.name}</button>`).join('');
    stealPanel.querySelectorAll('[data-finish-buzz]').forEach((button) => button.addEventListener('click', () => registerFinishBuzz(Number(button.dataset.finishBuzz))));
    timerButton.disabled = true;
    starButton.disabled = true;
    if (finishSteal.winner !== null) {
      section.querySelector('.finish-correct').innerHTML = `ĐÚNG <b>+${points}</b>`;
      section.querySelector('.finish-wrong').innerHTML = `SAI <b>−${Math.ceil(points / 2)}</b>`;
      section.querySelector('.finish-correct').disabled = false;
      section.querySelector('.finish-wrong').disabled = false;
    }
  } else timerButton.disabled = !finishQuestionRevealed;
  renderAdminAnswerKey();
};

const startFinishTimer = (round) => {
  const section = $(`[data-finish-game-round="${round}"]`);
  const teamIndex = finishTeamForRound(round);
  if (!finishQuestionRevealed) return;
  const points = finishPacks[teamIndex][finishProgress[teamIndex]];
  if (finishStarActive) finishStarsUsed.add(teamIndex);
  countdown({
    display: section.querySelector('.finish-timer span'),
    button: section.querySelector('.finish-timer'),
    duration: points === 20 ? 15 : 20,
    onStart: () => {
      finishCanJudge = true;
      section.querySelector('.finish-star').disabled = true;
      section.querySelector('.finish-correct').disabled = false;
      section.querySelector('.finish-wrong').disabled = false;
    },
  });
};

const advanceFinishQuestion = (round) => {
  const teamIndex = finishTeamForRound(round);
  window.clearInterval(stealInterval);
  stealInterval = null;
  finishSteal = { active: false, round: null, activeTeam: null, winner: null, points: 0 };
  finishCanJudge = false;
  finishStarActive = false;
  finishQuestionRevealed = finishStarsUsed.has(teamIndex);
  finishProgress[teamIndex] += 1;
  clearCountdown();
  if (finishProgress[teamIndex] >= 4) goToSlide([28, 31, 34][round]);
  else renderFinishGame(round);
};

const beginFinishSteal = (round, teamIndex, points) => {
  clearCountdown();
  finishCanJudge = false;
  finishStarActive = false;
  finishSteal = { active: true, round, activeTeam: teamIndex, winner: null, points };
  renderFinishGame(round);
  const section = $(`[data-finish-game-round="${round}"]`);
  let seconds = 5;
  const display = section.querySelector('.finish-steal-panel>strong');
  display.textContent = seconds;
  window.clearInterval(stealInterval);
  stealInterval = window.setInterval(() => {
    seconds -= 1;
    display.textContent = seconds;
    if (seconds <= 0) advanceFinishQuestion(round);
  }, 1000);
};

const registerFinishBuzz = (teamIndex) => {
  if (!finishSteal.active || finishSteal.winner !== null || teamIndex === finishSteal.activeTeam) return false;
  finishSteal.winner = teamIndex;
  window.clearInterval(stealInterval);
  finishCanJudge = true;
  renderFinishGame(finishSteal.round);
  const round = finishSteal.round;
  const display = $(`[data-finish-game-round="${round}"] .finish-steal-panel>strong`);
  let seconds = 5;
  display.textContent = seconds;
  stealInterval = window.setInterval(() => {
    seconds -= 1;
    display.textContent = seconds;
    if (seconds <= 0) advanceFinishQuestion(round);
  }, 1000);
  return true;
};

const judgeFinish = (round, correct) => {
  if (!finishCanJudge) return;
  const teamIndex = finishTeamForRound(round);
  const points = finishPacks[teamIndex][finishProgress[teamIndex]];
  if (finishSteal.active && finishSteal.winner !== null) {
    teams[finishSteal.winner].score += correct ? points : -Math.ceil(points / 2);
    advanceFinishQuestion(round);
    return;
  }
  if (correct) {
    teams[teamIndex].score += points * (finishStarActive ? 2 : 1);
    advanceFinishQuestion(round);
    return;
  }
  if (finishStarActive) teams[teamIndex].score -= points;
  beginFinishSteal(round, teamIndex, points);
};

const toggleFinishStar = (round) => {
  const teamIndex = finishTeamForRound(round);
  if (finishStarsUsed.has(teamIndex) || finishCanJudge) return;
  finishStarActive = !finishStarActive;
  renderFinishGame(round);
};

const confirmFinishPack = (round) => {
  const teamIndex = finishTeamForRound(round);
  finishProgress[teamIndex] = 0;
  finishStarActive = false;
  finishQuestionRevealed = finishStarsUsed.has(teamIndex);
  finishCanJudge = false;
  finishSteal = { active: false, round: null, activeTeam: null, winner: null, points: 0 };
  goToSlide([27, 30, 33][round]);
};

function goToSlide(number) {
  clearCountdown();
  currentSlide = Math.min(36, Math.max(1, number));
  stage.dataset.currentSlide = String(currentSlide);
  $$('.slide').forEach((slide) => slide.classList.toggle('active', Number(slide.dataset.slide) === currentSlide));
  slideNumber.textContent = String(currentSlide).padStart(2, '0');
  dockContext.textContent = slideContexts[currentSlide - 1];
  previousSlide.disabled = currentSlide === 1;
  nextSlide.disabled = currentSlide === 34;

  if (currentSlide !== 1) {
    video.pause();
    setState('presenting', currentSlide === 6 || currentSlide === 9 ? 'Đang thi' : 'Đang trình chiếu');
  } else {
    setState(video.currentTime === 0 ? 'ready' : 'paused', video.currentTime === 0 ? 'Đang chờ' : 'Tạm dừng');
  }
  if (currentSlide !== 3) {
    kickoffVideo.pause();
    $('.kickoff-intro').classList.remove('needs-play');
  } else {
    kickoffVideo.currentTime = 0;
    kickoffVideo.play().then(() => $('.kickoff-intro').classList.remove('needs-play')).catch(() => $('.kickoff-intro').classList.add('needs-play'));
  }
  if (currentSlide !== 11) {
    obstacleVideo.pause();
    $('[data-slide="11"]').classList.remove('needs-play');
  } else {
    obstacleVideo.currentTime = 0;
    obstacleVideo.play().then(() => $('[data-slide="11"]').classList.remove('needs-play')).catch(() => $('[data-slide="11"]').classList.add('needs-play'));
  }
  if (currentSlide !== 17) {
    speedVideo.pause();
    $('.speed-video-slide').classList.remove('needs-play');
  } else {
    speedVideo.currentTime = 0;
    speedVideo.play().then(() => $('.speed-video-slide').classList.remove('needs-play')).catch(() => $('.speed-video-slide').classList.add('needs-play'));
  }
  if (currentSlide !== 23) {
    finishVideo.pause();
    $('.finish-video-slide').classList.remove('needs-play');
  } else {
    finishVideo.currentTime = 0;
    finishVideo.play().then(() => $('.finish-video-slide').classList.remove('needs-play')).catch(() => $('.finish-video-slide').classList.add('needs-play'));
  }
  [[35, kickoffOutroVideo], [36, obstacleOutroVideo]].forEach(([slide, element]) => {
    if (currentSlide !== slide) { element.pause(); return; }
    element.currentTime = 0;
    element.play().catch(() => $(`[data-slide="${slide}"]`).classList.add('needs-play'));
  });
  if (currentSlide === 6) renderPrivateRound();
  if ([7, 10, 16, 22, 28, 31, 34].includes(currentSlide)) renderScoreboards();
  if (currentSlide === 9) renderCommonRound();
  if (currentSlide === 14) renderObstacleGame();
  if (currentSlide === 15) renderObstacleResponses();
  if (currentSlide === 20) renderSpeedGame();
  if (currentSlide === 21) renderSpeedResponses();
  const selectionRound = { 26: 0, 29: 1, 32: 2 }[currentSlide];
  if (selectionRound !== undefined) renderFinishSelection(selectionRound);
  const gameRound = { 27: 0, 30: 1, 33: 2 }[currentSlide];
  if (gameRound !== undefined) renderFinishGame(gameRound);
  renderAdminAnswerKey();
  if (!isPresentation) signalStateChange();
}

const nextLogicalSlide = () => {
  if (currentSlide === 10 && roundVideos.kickoffOutroUrl) return 35;
  if (currentSlide === 35) return 11;
  if (currentSlide === 16 && roundVideos.obstacleOutroUrl) return 36;
  if (currentSlide === 36) return 17;
  return currentSlide + 1;
};
const previousLogicalSlide = () => {
  if (currentSlide === 11 && roundVideos.kickoffOutroUrl) return 35;
  if (currentSlide === 35) return 10;
  if (currentSlide === 17 && roundVideos.obstacleOutroUrl) return 36;
  if (currentSlide === 36) return 16;
  return currentSlide - 1;
};

const playIntro = async (restart = false) => {
  goToSlide(1);
  if (restart || video.ended) video.currentTime = 0;
  try { await video.play(); } catch { setState('paused', 'Tạm dừng'); }
};

const togglePlayback = () => {
  if (video.paused || video.ended) playIntro(video.ended);
  else video.pause();
};

const readTimerValues = () => ({
  private: $('#privateTimer').textContent,
  common: $('#commonTimer').textContent,
  obstacle: $('#obstacleTimer').textContent,
  speed: $('#speedTimer').textContent,
  finish: $$('[data-finish-game-round]').map((section) => section.querySelector('.finish-timer span').textContent),
  steal: $$('[data-finish-game-round]').map((section) => section.querySelector('.finish-steal-panel>strong').textContent),
});

const getSynchronizedState = () => ({
  currentSlide,
  resetToken: lastResetToken,
  scores: teams.map((team) => team.score),
  privateTeamIndex, privateQuestionIndex, commonQuestionIndex, commonSelectedTeam,
  obstacleQuestionIndex, obstacleRevealed, obstacleWrongTeams: [...obstacleWrongTeams],
  speedQuestionIndex, speedWrongTeams: [...speedWrongTeams],
  finishOrder, finishPacks, finishProgress, finishStarsUsed: [...finishStarsUsed],
  finishStarActive, finishQuestionRevealed, finishCanJudge, finishSteal,
  questionStartedAt, timerActive,
  introPlayback,
  timers: readTimerValues(),
  updatedAt: new Date().toISOString(),
});

const renderCurrentSynchronizedSlide = () => {
  if (currentSlide === 6) renderPrivateRound();
  if ([7, 10, 16, 22, 28, 31, 34].includes(currentSlide)) renderScoreboards();
  if (currentSlide === 9) renderCommonRound();
  if (currentSlide === 14) renderObstacleGame();
  if (currentSlide === 15) renderObstacleResponses();
  if (currentSlide === 20) renderSpeedGame();
  if (currentSlide === 21) renderSpeedResponses();
  const selectionRound = { 26: 0, 29: 1, 32: 2 }[currentSlide];
  if (selectionRound !== undefined) renderFinishSelection(selectionRound);
  const gameRound = { 27: 0, 30: 1, 33: 2 }[currentSlide];
  if (gameRound !== undefined) renderFinishGame(gameRound);
  renderAdminAnswerKey();
};

const copyList = (target, source) => {
  if (!Array.isArray(source)) return;
  source.forEach((value, index) => { if (index < target.length && typeof value === 'string') target[index] = value; });
};

const copyNestedList = (target, source) => {
  if (!Array.isArray(source)) return;
  source.forEach((list, index) => { if (target[index]) copyList(target[index], list); });
};

const applyQuestionContent = (remoteQuestions, remoteAnswers) => {
  copyNestedList(privateQuestions, remoteQuestions?.private);
  copyList(commonQuestions, remoteQuestions?.common);
  copyList(obstacleQuestions, remoteQuestions?.obstacle);
  copyList(speedQuestions, remoteQuestions?.speed);
  copyNestedList(finishQuestions, remoteQuestions?.finish);
  copyNestedList(privateAnswers, remoteAnswers?.private);
  copyList(commonAnswers, remoteAnswers?.common);
  copyList(obstacleAnswers, remoteAnswers?.obstacle);
  copyList(speedAnswers, remoteAnswers?.speed);
  copyNestedList(finishAnswers, remoteAnswers?.finish);
};

const copyMedia = (target, source) => {
  if (!Array.isArray(source)) return;
  source.forEach((item, index) => { if (target[index] && item && typeof item === 'object') Object.assign(target[index], item); });
};
const getContent = () => ({ questionBank, answerBank, mediaBank, roundVideos });
const applyContent = (content) => {
  if (!content) return;
  applyQuestionContent(content.questionBank, content.answerBank);
  copyMedia(mediaBank.common, content.mediaBank?.common);
  copyMedia(mediaBank.obstacle, content.mediaBank?.obstacle);
  copyMedia(mediaBank.speed, content.mediaBank?.speed);
  content.mediaBank?.private?.forEach((list, index) => copyMedia(mediaBank.private[index], list));
  content.mediaBank?.finish?.forEach((list, index) => copyMedia(mediaBank.finish[index], list));
  Object.assign(roundVideos, content.roundVideos || {});
  if (roundVideos.kickoffOutroUrl) kickoffOutroVideo.src = roundVideos.kickoffOutroUrl;
  if (roundVideos.obstacleOutroUrl) obstacleOutroVideo.src = roundVideos.obstacleOutroUrl;
  renderCurrentSynchronizedSlide();
};

const resetLocalGame = () => {
  teams.forEach((team) => { team.score = 0; });
  privateTeamIndex = 0; privateQuestionIndex = 0; commonQuestionIndex = 0; commonSelectedTeam = null;
  obstacleQuestionIndex = null; obstacleRevealed = Array(7).fill(false); obstacleWrongTeams.clear();
  speedQuestionIndex = 0; speedWrongTeams.clear();
  speedResponseTimes.forEach((times) => times.fill(null));
  finishOrder = []; finishProgress.fill(0); finishStarsUsed.clear(); finishStarActive = false; finishQuestionRevealed = false; finishCanJudge = false;
  finishPacks.forEach((pack) => pack.fill(20));
  finishSteal = { active: false, round: null, activeTeam: null, winner: null, points: 0 };
  goToSlide(1);
};

const applySynchronizedState = (state) => {
  if (!state) return;
  if (state.resetToken && state.resetToken !== lastResetToken) {
    lastResetToken = state.resetToken;
    resetLocalGame();
  }
  state.scores?.forEach((score, index) => { if (teams[index]) teams[index].score = Number(score) || 0; });
  privateTeamIndex = state.privateTeamIndex ?? privateTeamIndex;
  privateQuestionIndex = state.privateQuestionIndex ?? privateQuestionIndex;
  commonQuestionIndex = state.commonQuestionIndex ?? commonQuestionIndex;
  commonSelectedTeam = state.commonSelectedTeam ?? null;
  obstacleQuestionIndex = state.obstacleQuestionIndex ?? null;
  obstacleRevealed = state.obstacleRevealed ?? obstacleRevealed;
  obstacleWrongTeams = new Set(state.obstacleWrongTeams ?? []);
  speedQuestionIndex = state.speedQuestionIndex ?? speedQuestionIndex;
  speedWrongTeams = new Set(state.speedWrongTeams ?? []);
  finishOrder = state.finishOrder ?? finishOrder;
  state.finishPacks?.forEach((pack, index) => { finishPacks[index] = pack; });
  state.finishProgress?.forEach((value, index) => { finishProgress[index] = value; });
  finishStarsUsed.clear();
  (state.finishStarsUsed ?? []).forEach((value) => finishStarsUsed.add(value));
  finishStarActive = Boolean(state.finishStarActive);
  finishQuestionRevealed = Boolean(state.finishQuestionRevealed);
  finishCanJudge = Boolean(state.finishCanJudge);
  finishSteal = state.finishSteal ?? finishSteal;
  questionStartedAt = state.questionStartedAt ?? questionStartedAt;
  const next = Number(state.currentSlide) || 1;
  if (next !== currentSlide) goToSlide(next);
  else renderCurrentSynchronizedSlide();
  timerActive = Boolean(state.timerActive);
  if (state.timers) {
    $('#privateTimer').textContent = state.timers.private ?? $('#privateTimer').textContent;
    $('#commonTimer').textContent = state.timers.common ?? $('#commonTimer').textContent;
    $('#obstacleTimer').textContent = state.timers.obstacle ?? $('#obstacleTimer').textContent;
    $('#speedTimer').textContent = state.timers.speed ?? $('#speedTimer').textContent;
    $$('[data-finish-game-round]').forEach((section, index) => {
      section.querySelector('.finish-timer span').textContent = state.timers.finish?.[index] ?? section.querySelector('.finish-timer span').textContent;
      section.querySelector('.finish-steal-panel>strong').textContent = state.timers.steal?.[index] ?? section.querySelector('.finish-steal-panel>strong').textContent;
    });
  }
  if (state.introPlayback) void applyIntroPlayback(state.introPlayback);
};

const applyIntroPlayback = async (remote, force = false) => {
  if (!remote) return true;
  const revision = Number(remote.revision) || 0;
  introPlayback = { ...introPlayback, ...remote, revision };
  if (!isPresentation || currentSlide !== 1) return true;
  if (!force && revision === lastAppliedIntroRevision) return !video.paused;
  lastAppliedIntroRevision = revision;
  const started = Date.parse(remote.startedAt || '');
  const elapsed = remote.playing && Number.isFinite(started) ? Math.max(0, (Date.now() - started) / 1000) : 0;
  const expected = Math.max(0, Number(remote.position) || 0) + elapsed;
  if (Number.isFinite(video.duration) && video.duration > 0) {
    video.currentTime = Math.min(expected, Math.max(0, video.duration - .05));
  } else if (expected > 0) {
    video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(expected, Math.max(0, video.duration - .05)); }, { once: true });
  }
  if (!remote.playing) {
    video.pause();
    return true;
  }
  try {
    await video.play();
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent('olympia-media-blocked'));
    return false;
  }
};

const activatePresentationMedia = async () => {
  if (!isPresentation) return true;
  if (currentSlide === 1 && introPlayback.playing) return applyIntroPlayback(introPlayback, true);
  const activeVideo = ({ 3: kickoffVideo, 11: obstacleVideo, 17: speedVideo, 23: finishVideo, 35: kickoffOutroVideo, 36: obstacleOutroVideo })[currentSlide];
  if (!activeVideo) return true;
  try {
    await activeVideo.play();
    return true;
  } catch {
    return false;
  }
};

const setRealtimeAnswers = (rows) => {
  (rows || []).forEach((row) => {
    if (row.round !== 'speed' || row.response_ms === null) return;
    if (speedResponseTimes[row.question_index]?.[row.team_id - 1] !== undefined) speedResponseTimes[row.question_index][row.team_id - 1] = row.response_ms / 1000;
  });
  if (currentSlide === 21) renderSpeedResponses();
};

window.OlympiaStage = { getState: getSynchronizedState, applyState: applySynchronizedState, getContent, applyContent, resetLocalGame, setRealtimeAnswers, registerFinishBuzz, goToSlide, activatePresentationMedia };

$('#startButton').addEventListener('click', () => playIntro(true));
playPauseButton.addEventListener('click', togglePlayback);
$('#restartButton').addEventListener('click', () => playIntro(true));
$('#muteButton').addEventListener('click', () => {
  video.muted = !video.muted;
  $('#muteButton').style.opacity = video.muted ? '.42' : '1';
});
$('#fullscreenButton').addEventListener('click', async () => {
  if (!document.fullscreenElement) await stage.requestFullscreen?.();
  else await document.exitFullscreen?.();
});
$('#contentEditorButton').addEventListener('click', openQuestionEditor);
$('#closeQuestionEditor').addEventListener('click', closeQuestionEditor);
$('#editorRound').addEventListener('change', refreshEditorQuestions);
$('#editorTeam').addEventListener('change', loadEditorContent);
$('#editorQuestion').addEventListener('change', loadEditorContent);
$('#editorQuestionMode').addEventListener('change', () => { $('#editorAudioWrap').hidden = $('#editorQuestionMode').value !== 'audio'; });
$('#saveQuestionContent').addEventListener('click', saveQuestionContent);
$('#questionEditor').addEventListener('click', (event) => { if (event.target === $('#questionEditor')) closeQuestionEditor(); });
$('#kickoffPlay').addEventListener('click', () => kickoffVideo.play().then(() => $('.kickoff-intro').classList.remove('needs-play')));
$('#obstaclePlay').addEventListener('click', () => obstacleVideo.play().then(() => $('[data-slide="11"]').classList.remove('needs-play')));
$('#speedPlay').addEventListener('click', () => speedVideo.play().then(() => $('.speed-video-slide').classList.remove('needs-play')));
$('#finishPlay').addEventListener('click', () => finishVideo.play().then(() => $('.finish-video-slide').classList.remove('needs-play')));
$('#kickoffOutroPlay').addEventListener('click', () => kickoffOutroVideo.play());
$('#obstacleOutroPlay').addEventListener('click', () => obstacleOutroVideo.play());
previousSlide.addEventListener('click', () => goToSlide(previousLogicalSlide()));
nextSlide.addEventListener('click', () => goToSlide(nextLogicalSlide()));

$('#scoreEditorButton').addEventListener('click', () => {
  teams.forEach((team, index) => { $(`#scoreInput${index + 1}`).value = team.score; });
  $('#scoreEditor').hidden = false;
});
$('#closeScoreEditor').addEventListener('click', () => { $('#scoreEditor').hidden = true; });
$('#saveScores').addEventListener('click', () => {
  teams.forEach((team, index) => { team.score = Number($(`#scoreInput${index + 1}`).value) || 0; });
  renderCurrentSynchronizedSlide(); renderScoreboards(); signalStateChange(); $('#scoreEditor').hidden = true;
});
$('#resetGameButton').addEventListener('click', async () => {
  if (!window.confirm('Reset toàn bộ tiến trình và điểm? Câu hỏi đã lưu sẽ được giữ nguyên.')) return;
  try { const result = await window.OlympiaSync.resetGame(); applySynchronizedState(result.state); } catch (error) { window.alert(`Không thể reset: ${error.message}`); }
});
kickoffOutroVideo.addEventListener('ended', () => { if (!isPresentation) goToSlide(11); });
obstacleOutroVideo.addEventListener('ended', () => { if (!isPresentation) goToSlide(17); });

$('#privateTimerButton').addEventListener('click', startPrivateTimer);
$('#privateCorrect').addEventListener('click', () => judgePrivate(true));
$('#privateWrong').addEventListener('click', () => judgePrivate(false));
$('#commonTimerButton').addEventListener('click', startCommonTimer);
$('#commonSkip').addEventListener('click', advanceCommon);
$('#commonCorrect').addEventListener('click', () => judgeCommon(true));
$('#commonWrong').addEventListener('click', () => judgeCommon(false));
$('#obstacleTimerButton').addEventListener('click', startObstacleTimer);
$('#confirmObstacleResponses').addEventListener('click', confirmObstacleResponses);
$('#speedTimerButton').addEventListener('click', startSpeedTimer);
$('#confirmSpeedResponses').addEventListener('click', confirmSpeedResponses);
$$('[data-finish-selection-round]').forEach((section) => {
  const round = Number(section.dataset.finishSelectionRound);
  section.querySelector('.finish-confirm').addEventListener('click', () => confirmFinishPack(round));
});
$$('[data-finish-game-round]').forEach((section) => {
  const round = Number(section.dataset.finishGameRound);
  section.querySelector('.finish-star').addEventListener('click', () => toggleFinishStar(round));
  section.querySelector('.finish-timer').addEventListener('click', () => startFinishTimer(round));
  section.querySelector('.finish-correct').addEventListener('click', () => judgeFinish(round, true));
  section.querySelector('.finish-wrong').addEventListener('click', () => judgeFinish(round, false));
});

video.addEventListener('play', () => {
  setState('playing', 'Đang phát');
  if (!isPresentation) {
    introPlayback = { playing: true, startedAt: new Date().toISOString(), position: video.currentTime || 0, revision: introPlayback.revision + 1 };
    signalStateChange();
  }
});
video.addEventListener('pause', () => {
  if (!video.ended && currentSlide === 1) setState('paused', 'Tạm dừng');
  if (!isPresentation && !video.ended) {
    introPlayback = { playing: false, startedAt: null, position: video.currentTime || 0, revision: introPlayback.revision + 1 };
    signalStateChange();
  }
});
video.addEventListener('ended', () => window.setTimeout(() => goToSlide(2), 500));
video.addEventListener('timeupdate', () => {
  progressFill.style.width = `${video.duration ? (video.currentTime / video.duration) * 100 : 0}%`;
  if (currentSlide === 1) dockContext.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
});
kickoffVideo.addEventListener('ended', () => goToSlide(4));
kickoffVideo.addEventListener('timeupdate', () => {
  if (currentSlide === 3) dockContext.textContent = `${formatTime(kickoffVideo.currentTime)} / ${formatTime(kickoffVideo.duration)}`;
});
obstacleVideo.addEventListener('ended', () => goToSlide(12));
obstacleVideo.addEventListener('timeupdate', () => {
  if (currentSlide === 11) dockContext.textContent = `${formatTime(obstacleVideo.currentTime)} / ${formatTime(obstacleVideo.duration)}`;
});
speedVideo.addEventListener('ended', () => goToSlide(18));
speedVideo.addEventListener('timeupdate', () => {
  if (currentSlide === 17) dockContext.textContent = `${formatTime(speedVideo.currentTime)} / ${formatTime(speedVideo.duration)}`;
});
finishVideo.addEventListener('ended', () => goToSlide(24));
finishVideo.addEventListener('timeupdate', () => {
  if (currentSlide === 23) dockContext.textContent = `${formatTime(finishVideo.currentTime)} / ${formatTime(finishVideo.duration)}`;
});

document.addEventListener('keydown', (event) => {
  if (isPresentation) {
    if (event.key.toLowerCase() === 'f') $('#stage').requestFullscreen?.();
    return;
  }
  if (event.code === 'Space' && currentSlide === 1) { event.preventDefault(); togglePlayback(); }
  if (event.key === 'ArrowLeft') goToSlide(previousLogicalSlide());
  if (event.key === 'ArrowRight') goToSlide(nextLogicalSlide());
  if (event.key.toLowerCase() === 'r' && currentSlide === 1) playIntro(true);
  if (event.key.toLowerCase() === 'f') $('#fullscreenButton').click();
});

renderTeamStrips();
renderScoreboards();
goToSlide(1);
