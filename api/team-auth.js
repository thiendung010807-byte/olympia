import { allowMethod, isTeam, noStore } from './_lib/server.js';

export default function handler(request, response) {
  if (!allowMethod(request, response, ['POST'])) return;
  noStore(response);
  const teamId = Number(request.body?.teamId);
  if (![1, 2, 3].includes(teamId)) return response.status(400).json({ error: 'Nhóm không hợp lệ' });
  if (!process.env[`TEAM_${teamId}_PIN`]) return response.status(503).json({ error: `Chưa cấu hình TEAM_${teamId}_PIN trên Vercel` });
  if (!isTeam(request, teamId)) return response.status(401).json({ error: 'Sai mã PIN của nhóm' });
  return response.status(200).json({ ok: true, teamId });
}
