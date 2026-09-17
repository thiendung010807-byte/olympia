import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const params = new URLSearchParams(location.search);
const presentationPath = /^\/trinh-chieu\/?$/i.test(location.pathname);
const mode = params.get('mode') === 'present' || presentationPath ? 'present' : 'admin';
document.body.classList.add(`${mode}-mode`);
document.body.dataset.mode = mode;

let presentationActivator = null;
if (mode === 'present') {
  presentationActivator = document.createElement('div');
  presentationActivator.className = 'presentation-activator';
  presentationActivator.innerHTML = '<div><button type="button">BẬT TRÌNH CHIẾU</button><p>Nhấn một lần để trình duyệt cho phép phát video và âm thanh đồng bộ</p></div>';
  document.body.append(presentationActivator);
  presentationActivator.querySelector('button').addEventListener('click', async () => {
    const ok = await window.OlympiaStage.activatePresentationMedia();
    if (ok) presentationActivator.hidden = true;
  });
  window.addEventListener('olympia-media-blocked', () => { presentationActivator.hidden = false; });
}

const badge = document.createElement('div');
badge.className = 'connection-badge';
badge.textContent = 'Đang kết nối…';
document.body.append(badge);

const setConnection = (online, text = online ? 'Realtime đã kết nối' : 'Mất kết nối') => {
  badge.className = `connection-badge ${online ? 'online' : 'offline'}`;
  badge.textContent = text;
};

const configResponse = await fetch('/api/config', { cache: 'no-store' });
const config = await configResponse.json();
if (!config.supabaseUrl || !config.supabaseAnonKey) {
  setConnection(false, 'Thiếu cấu hình Supabase');
  throw new Error('Missing Supabase browser configuration');
}

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
let adminPassword = mode === 'admin' ? sessionStorage.getItem('olympia-admin-password') : null;
if (mode === 'admin' && !adminPassword) {
  adminPassword = window.prompt('Nhập mật khẩu admin để đồng bộ chương trình') || '';
  if (adminPassword) sessionStorage.setItem('olympia-admin-password', adminPassword);
}

let applyingRemote = false;
let publishTimer = null;
let latestAnswers = [];
let lastRemoteUpdatedAt = null;
let pollBusy = false;

const hydrateAnswers = () => {
  const state = window.OlympiaStage?.getState();
  if (!state) return;
  if (state.currentSlide === 15 && state.obstacleQuestionIndex !== null) {
    document.querySelectorAll('[data-response-team]').forEach((card) => {
      const row = latestAnswers.find((item) => item.round === 'obstacle' && item.question_index === state.obstacleQuestionIndex && item.team_id === Number(card.dataset.responseTeam) + 1);
      card.querySelector('p').textContent = row?.answer || '';
    });
  }
  if (state.currentSlide === 21) {
    document.querySelectorAll('[data-speed-response-team]').forEach((card) => {
      const row = latestAnswers.find((item) => item.round === 'speed' && item.question_index === state.speedQuestionIndex && item.team_id === Number(card.dataset.speedResponseTeam) + 1);
      card.querySelector('p').textContent = row?.answer || '';
      const time = card.querySelector('time');
      if (time) time.textContent = row?.response_ms !== null && row?.response_ms !== undefined ? `${(row.response_ms / 1000).toFixed(2)} giây` : '';
    });
  }
};

window.addEventListener('olympia-responses-rendered', hydrateAnswers);

const loadAnswers = async () => {
  const { data } = await supabase.from('team_answers').select('*').eq('game_id', config.gameId).order('submitted_at');
  latestAnswers = data || [];
  window.OlympiaStage?.setRealtimeAnswers(latestAnswers);
  hydrateAnswers();
};

const publishState = async () => {
  if (mode !== 'admin' || applyingRemote || !adminPassword) return;
  const response = await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
    body: JSON.stringify({ state: window.OlympiaStage.getState() }),
  });
  if (response.status === 401) {
    sessionStorage.removeItem('olympia-admin-password');
    setConnection(false, 'Sai mật khẩu admin');
    return;
  }
  setConnection(response.ok, response.ok ? 'Đã đồng bộ' : 'Không thể đồng bộ');
};

const schedulePublish = () => {
  if (mode !== 'admin' || applyingRemote) return;
  window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(publishState, 180);
};

window.addEventListener('olympia-state-change', schedulePublish);

const applyRemoteState = (state, updatedAt = null) => {
  if (mode !== 'present' || !state) return;
  if (updatedAt && updatedAt === lastRemoteUpdatedAt) return;
  lastRemoteUpdatedAt = updatedAt || state.updatedAt || lastRemoteUpdatedAt;
  applyingRemote = true;
  window.OlympiaStage.applyState(state);
  applyingRemote = false;
  window.setTimeout(hydrateAnswers, 0);
};

const initial = await fetch('/api/state', { cache: 'no-store' }).then((response) => response.json());
if (initial.state) {
  if (mode === 'present') applyRemoteState(initial.state, initial.updatedAt);
  else {
    applyingRemote = true;
    window.OlympiaStage.applyState(initial.state);
    applyingRemote = false;
  }
}

if (mode === 'admin') {
  new MutationObserver(schedulePublish).observe(document.querySelector('#stage'), {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'disabled', 'hidden', 'data-current-slide'],
  });
}

await loadAnswers();

supabase.channel(`olympia-${config.gameId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: `id=eq.${config.gameId}` }, ({ new: row }) => {
    if (mode === 'present') applyRemoteState(row.state, row.updated_at);
    if ([15, 21].includes(Number(row.state?.currentSlide))) window.setTimeout(loadAnswers, 40);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'team_answers', filter: `game_id=eq.${config.gameId}` }, loadAnswers)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buzzes', filter: `game_id=eq.${config.gameId}` }, ({ new: row }) => {
    if (mode === 'admin' && window.OlympiaStage.registerFinishBuzz(row.team_id - 1)) schedulePublish();
  })
  .subscribe((status) => setConnection(status === 'SUBSCRIBED', status === 'SUBSCRIBED' ? 'Realtime đã kết nối' : 'Đang kết nối…'));

if (mode === 'present') window.setInterval(async () => {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const payload = await fetch('/api/state', { cache: 'no-store' }).then((response) => response.json());
    applyRemoteState(payload.state, payload.updatedAt);
  } catch {
    setConnection(false, 'Đang kết nối lại…');
  } finally {
    pollBusy = false;
  }
}, 700);

if (mode === 'admin') schedulePublish();
