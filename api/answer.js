import { adminClient, allowMethod, gameId, isTeam, noStore } from './_lib/server.js';

export default async function handler(request, response) {
  if (!allowMethod(request, response, ['POST'])) return;
  noStore(response);
  const teamId = Number(request.body?.teamId);
  const round = request.body?.round;
  const questionIndex = Number(request.body?.questionIndex);
  const answer = String(request.body?.answer || '').trim().slice(0, 300);
  if (![1, 2, 3].includes(teamId) || !isTeam(request, teamId)) return response.status(401).json({ error: 'Sai mã PIN của nhóm' });
  if (!['obstacle', 'speed'].includes(round) || !Number.isInteger(questionIndex) || !answer) return response.status(400).json({ error: 'Câu trả lời không hợp lệ' });

  const supabase = adminClient();
  const id = gameId();
  const { data: game, error: stateError } = await supabase.from('game_state').select('state').eq('id', id).maybeSingle();
  if (stateError) return response.status(500).json({ error: stateError.message });
  const state = game?.state || {};
  const expectedIndex = round === 'obstacle' ? state.obstacleQuestionIndex : state.speedQuestionIndex;
  const expectedSlide = round === 'obstacle' ? 14 : 20;
  if (!state.timerActive || Number(state.currentSlide) !== expectedSlide || Number(expectedIndex) !== questionIndex) return response.status(409).json({ error: 'Câu hỏi chưa bắt đầu hoặc đã hết giờ' });
  const started = Date.parse(state.questionStartedAt || '');
  const responseMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : null;
  const { error } = await supabase.from('team_answers').upsert({
    game_id: id,
    round,
    question_index: questionIndex,
    team_id: teamId,
    answer,
    response_ms: responseMs,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'game_id,round,question_index,team_id' });
  if (error) return response.status(500).json({ error: error.message });
  return response.status(200).json({ ok: true, responseMs });
}
