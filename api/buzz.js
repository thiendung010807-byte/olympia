import { adminClient, allowMethod, gameId, isTeam, noStore } from './_lib/server.js';

export default async function handler(request, response) {
  if (!allowMethod(request, response, ['POST'])) return;
  noStore(response);
  const teamId = Number(request.body?.teamId);
  if (![1, 2, 3].includes(teamId) || !isTeam(request, teamId)) return response.status(401).json({ error: 'Sai mã PIN của nhóm' });
  const supabase = adminClient();
  const id = gameId();
  const { data: game, error: stateError } = await supabase.from('game_state').select('state').eq('id', id).maybeSingle();
  if (stateError) return response.status(500).json({ error: stateError.message });
  const steal = game?.state?.finishSteal;
  if (!steal?.active || steal.winner !== null || Number(steal.activeTeam) === teamId - 1) return response.status(409).json({ error: 'Chưa mở quyền giành trả lời' });
  const questionIndex = Number(game.state.finishProgress?.[steal.activeTeam] || 0);
  const attemptToken = String(game.state.questionStartedAt || `${steal.round}-${questionIndex}`);
  const { error } = await supabase.from('buzzes').insert({ game_id: id, round: Number(steal.round), question_index: questionIndex, attempt_token: attemptToken, team_id: teamId });
  if (error?.code === '23505') return response.status(409).json({ error: 'Nhóm khác đã giành quyền trước' });
  if (error) return response.status(500).json({ error: error.message });
  return response.status(200).json({ ok: true });
}
