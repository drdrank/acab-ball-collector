// ============================================================
// ENV.JS — Your credentials. Edit this file only.
// ============================================================
// HOW TO SET UP SUPABASE:
//   1. Go to https://supabase.com and create a free project
//   2. Settings → API → copy "Project URL" and "anon / public" key
//   3. Paste them below
//
// HOW TO SET UP THE LEADERBOARD TABLE:
//   Run this SQL in Supabase → SQL Editor:
//
//   CREATE TABLE leaderboard_scores (
//     id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     wallet_address  text NOT NULL UNIQUE,
//     display_name    text,
//     score           integer NOT NULL DEFAULT 0,
//     level_reached   integer NOT NULL DEFAULT 1,
//     smile_tokens    integer NOT NULL DEFAULT 0,
//     selected_skin   text DEFAULT 'classic',
//     game_version    text DEFAULT '1.0.0',
//     created_at      timestamptz DEFAULT now(),
//     updated_at      timestamptz DEFAULT now()
//   );
//
//   ALTER TABLE leaderboard_scores ENABLE ROW LEVEL SECURITY;
//
//   CREATE POLICY "public read" ON leaderboard_scores
//     FOR SELECT USING (true);
//
//   CREATE POLICY "public upsert" ON leaderboard_scores
//     FOR ALL USING (true) WITH CHECK (
//       score >= 0 AND score <= 999999 AND
//       level_reached BETWEEN 1 AND 10 AND
//       smile_tokens >= 0 AND smile_tokens <= 9999
//     );
//
//   ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_scores;
// ============================================================

const ENV = {
  SUPABASE_URL:      'YOUR_SUPABASE_URL_HERE',      // e.g. https://xyzabc.supabase.co
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY_HERE', // starts with eyJ...
  GAME_VERSION:      '1.0.0',
};
