import { adminClient, allowMethod, gameId, isAdmin, noStore } from './_lib/server.js';

export default async function handler(request, response) {
  if (!allowMethod(request, response, ['GET', 'POST'])) return;
  noStore(response);
  const supabase = adminClient();
  const id = gameId();

  if (request.method === 'GET') {
    const { data, error } = await supabase.from('game_state').select('state, updated_at').eq('id', id).maybeSingle();
    if (error) return response.status(500).json({ error: error.message });
    return response.status(200).json({ state: data?.state || null, updatedAt: data?.updated_at || null });
  }

  if (!isAdmin(request)) return response.status(401).json({ error: 'Sai mật khẩu admin' });
  const state = request.body?.state;
  if (!state || typeof state !== 'object') return response.status(400).json({ error: 'State không hợp lệ' });
  const { data: current } = await supabase.from('game_state').select('state').eq('id', id).maybeSingle();
  if (state.timerActive) {
    state.questionStartedAt = current?.state?.timerActive && current.state.questionStartedAt
      ? current.state.questionStartedAt
      : new Date().toISOString();
  }
  const { error } = await supabase.from('game_state').upsert({ id, state, updated_at: new Date().toISOString() });
  if (error) return response.status(500).json({ error: error.message });
  return response.status(200).json({ ok: true });
}
