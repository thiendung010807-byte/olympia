import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

export const gameId = () => process.env.OLYMPIA_GAME_ID || 'main';

export const adminClient = () => createClient(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const isAdmin = (request) => safeEqual(request.headers['x-admin-password'], process.env.ADMIN_PASSWORD);

export const isTeam = (request, teamId) => {
  const expected = process.env[`TEAM_${teamId}_PIN`];
  return Boolean(expected) && safeEqual(request.headers['x-team-pin'], expected);
};

export const allowMethod = (request, response, methods) => {
  if (methods.includes(request.method)) return true;
  response.setHeader('Allow', methods.join(', '));
  response.status(405).json({ error: 'Method not allowed' });
  return false;
};

export const noStore = (response) => response.setHeader('Cache-Control', 'no-store');
