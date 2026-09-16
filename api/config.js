import { allowMethod, noStore, gameId } from './_lib/server.js';

export default function handler(request, response) {
  if (!allowMethod(request, response, ['GET'])) return;
  noStore(response);
  response.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    gameId: gameId(),
  });
}
