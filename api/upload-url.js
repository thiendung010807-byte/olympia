import crypto from 'node:crypto';
import { adminClient, allowMethod, gameId, isAdmin, noStore } from './_lib/server.js';

export default async function handler(request, response) {
  if (!allowMethod(request, response, ['POST'])) return;
  noStore(response);
  if (!isAdmin(request)) return response.status(401).json({ error: 'Sai mật khẩu admin' });
  const original = String(request.body?.fileName || 'media').slice(0, 120);
  const safeName = original.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
  const path = `${gameId()}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const supabase = adminClient();
  const { data, error } = await supabase.storage.from('olympia-media').createSignedUploadUrl(path, { upsert: true });
  if (error) return response.status(500).json({ error: error.message });
  const { data: publicData } = supabase.storage.from('olympia-media').getPublicUrl(path);
  return response.status(200).json({ path, token: data.token, publicUrl: publicData.publicUrl });
}
