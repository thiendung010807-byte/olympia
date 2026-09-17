import { adminClient, allowMethod, gameId, isAdmin, noStore } from './_lib/server.js';

export default async function handler(request, response) {
  if (!allowMethod(request, response, ['POST'])) return;
  noStore(response);
  if (!isAdmin(request)) return response.status(401).json({ error: 'Sai mật khẩu admin' });
  const supabase = adminClient();
  const id = gameId();
  const clearedAt = new Date().toISOString();
  const state = { currentSlide: 1, scores: [0, 0, 0], resetToken: clearedAt, updatedAt: clearedAt };
  const [{ error: answerError }, { error: buzzError }, { error: stateError }] = await Promise.all([
    supabase.from('team_answers').delete().eq('game_id', id),
    supabase.from('buzzes').delete().eq('game_id', id),
    supabase.from('game_state').upsert({ id, state, updated_at: clearedAt }),
  ]);
  const error = answerError || buzzError || stateError;
  if (error) return response.status(500).json({ error: error.message });
  return response.status(200).json({ ok: true, state });
}
