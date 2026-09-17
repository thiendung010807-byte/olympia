import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const queryTeam = Number(new URLSearchParams(location.search).get('team'));
const pathTeam = Number(location.pathname.match(/\/nhom\/(\d+)/)?.[1]);
const teamId = [1, 2, 3].includes(queryTeam) ? queryTeam : pathTeam;
if (![1, 2, 3].includes(teamId)) location.replace('/');

const $ = (selector) => document.querySelector(selector);
$('#teamName').textContent = `NHÓM ${teamId}`;
const pinKey = `olympia-team-${teamId}-pin`;
const storedPin = sessionStorage.getItem(pinKey) || '';
let pin = '';
if (storedPin) $('#teamPin').value = storedPin;

const config = await fetch('/api/config', { cache: 'no-store' }).then((response) => response.json());
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
let currentState = null;
let submittedKey = '';
let activeQuestionKey = '';
let lastStateUpdatedAt = null;
let statePollBusy = false;

const show = (target) => {
  ['#waitPanel', '#answerPanel', '#buzzPanel'].forEach((selector) => { $(selector).hidden = selector !== target; });
};

const render = (state) => {
  currentState = state;
  if (!pin) {
    $('#loginPanel').hidden = false;
    show(null);
    return;
  }
  $('#loginPanel').hidden = true;
  const slide = Number(state?.currentSlide);
  const obstacleReady = slide === 14 && state.timerActive && state.obstacleQuestionIndex !== null && state.obstacleQuestionIndex < 6;
  const speedReady = slide === 20 && state.timerActive;
  const canBuzz = state?.finishSteal?.active && state.finishSteal.winner === null && Number(state.finishSteal.activeTeam) !== teamId - 1;

  if (canBuzz) {
    show('#buzzPanel');
    $('#buzzButton').disabled = false;
    $('#buzzStatus').textContent = 'Chỉ lượt bấm đầu tiên được ghi nhận.';
    return;
  }
  if (obstacleReady || speedReady) {
    show('#answerPanel');
    const round = obstacleReady ? 'obstacle' : 'speed';
    const index = obstacleReady ? state.obstacleQuestionIndex : state.speedQuestionIndex;
    $('#answerPanel').dataset.round = round;
    $('#answerPanel').dataset.questionIndex = index;
    $('#roundLabel').textContent = obstacleReady ? 'VƯỢT CHƯỚNG NGẠI VẬT' : 'TĂNG TỐC';
    $('#questionLabel').textContent = `CÂU ${Number(index) + 1}`;
    const key = `${round}-${index}`;
    if (activeQuestionKey !== key) {
      $('#answerInput').value = '';
      $('#answerStatus').textContent = '';
      submittedKey = '';
      activeQuestionKey = key;
    }
    return;
  }
  activeQuestionKey = '';
  show('#waitPanel');
};

const enterRoom = async (candidate) => {
  if (!candidate) {
    $('#loginStatus').textContent = 'Vui lòng nhập mã PIN.';
    return false;
  }
  const button = $('#savePin');
  button.disabled = true;
  button.textContent = 'ĐANG KIỂM TRA…';
  $('#loginStatus').textContent = '';
  try {
    const response = await fetch('/api/team-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-team-pin': candidate },
      body: JSON.stringify({ teamId }),
    });
    const result = await response.json();
    if (!response.ok) {
      sessionStorage.removeItem(pinKey);
      $('#loginStatus').textContent = result.error || 'Không thể vào phòng.';
      return false;
    }
    pin = candidate;
    sessionStorage.setItem(pinKey, pin);
    $('#connectionState').textContent = 'Đã vào phòng · đang kết nối realtime…';
    render(currentState);
    return true;
  } catch {
    $('#loginStatus').textContent = 'Không kết nối được máy chủ. Hãy thử lại.';
    return false;
  } finally {
    button.disabled = false;
    button.textContent = 'VÀO PHÒNG';
  }
};

$('#savePin').addEventListener('click', () => enterRoom($('#teamPin').value.trim()));
$('#teamPin').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') enterRoom($('#teamPin').value.trim());
});

$('#answerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const panel = $('#answerPanel');
  const round = panel.dataset.round;
  const questionIndex = Number(panel.dataset.questionIndex);
  const answer = $('#answerInput').value.trim();
  if (!answer) return;
  const response = await fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-team-pin': pin },
    body: JSON.stringify({ teamId, round, questionIndex, answer }),
  });
  const result = await response.json();
  if (!response.ok) {
    $('#answerStatus').textContent = result.error || 'Không thể gửi câu trả lời';
    return;
  }
  submittedKey = `${round}-${questionIndex}`;
  $('#answerStatus').textContent = result.responseMs === null ? 'Đã gửi câu trả lời' : `Đã gửi sau ${(result.responseMs / 1000).toFixed(2)} giây`;
});

$('#buzzButton').addEventListener('click', async () => {
  $('#buzzButton').disabled = true;
  const response = await fetch('/api/buzz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-team-pin': pin },
    body: JSON.stringify({ teamId }),
  });
  const result = await response.json();
  $('#buzzStatus').textContent = response.ok ? 'Bạn đã giành quyền trả lời!' : (result.error || 'Không giành được quyền');
});

const initial = await fetch('/api/state', { cache: 'no-store' }).then((response) => response.json());
lastStateUpdatedAt = initial.updatedAt || null;
render(initial.state);
if (storedPin) await enterRoom(storedPin);

supabase.channel(`team-${teamId}-${config.gameId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: `id=eq.${config.gameId}` }, ({ new: row }) => {
    lastStateUpdatedAt = row.updated_at || lastStateUpdatedAt;
    render(row.state);
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buzzes', filter: `game_id=eq.${config.gameId}` }, ({ new: row }) => {
    if (currentState?.finishSteal?.active) {
      $('#buzzButton').disabled = true;
      $('#buzzStatus').textContent = row.team_id === teamId ? 'Bạn đã giành quyền trả lời!' : `Nhóm ${row.team_id} đã giành quyền trước`;
    }
  })
  .subscribe((status) => { $('#connectionState').textContent = status === 'SUBSCRIBED' ? 'Realtime đã kết nối' : 'Đang kết nối…'; });

window.setInterval(async () => {
  if (statePollBusy) return;
  statePollBusy = true;
  try {
    const payload = await fetch('/api/state', { cache: 'no-store' }).then((response) => response.json());
    if (payload.updatedAt && payload.updatedAt !== lastStateUpdatedAt) {
      lastStateUpdatedAt = payload.updatedAt;
      render(payload.state);
    }
  } catch {
    $('#connectionState').textContent = 'Đang kết nối lại…';
  } finally {
    statePollBusy = false;
  }
}, 700);
