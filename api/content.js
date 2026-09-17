import { adminClient, allowMethod, gameId, isAdmin, noStore } from './_lib/server.js';

export default async function handler(request, response) {
  if (!allowMethod(request, response, ['GET', 'POST'])) return;
  noStore(response);
  const supabase = adminClient();
  const id = gameId();
  if (request.method === 'GET') {
    const { data, error } = await supabase.from('game_content').select('content, updated_at').eq('id', id).maybeSingle();
    if (error) return response.status(500).json({ error: error.message });
    return response.status(200).json({ content: data?.content || null, updatedAt: data?.updated_at || null });
  }
  if (!isAdmin(request)) return response.status(401).json({ error: 'Sai mật khẩu admin' });
  const content = request.body?.content;
  if (!content || typeof content !== 'object') return response.status(400).json({ error: 'Nội dung không hợp lệ' });
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('game_content').upsert({ id, content, updated_at: updatedAt });
  if (error) return response.status(500).json({ error: error.message });
  return response.status(200).json({ ok: true, updatedAt });
}
