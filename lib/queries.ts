import { sql, clampDays } from "./db";

// Helper: coerce Neon's string-typed numerics to JS numbers.
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/* ------------------------------------------------------------------ */
/* OVERVIEW — headline KPIs with period-over-period deltas             */
/* ------------------------------------------------------------------ */
export async function getOverview(daysIn: unknown) {
  const days = clampDays(daysIn, [7, 30, 90]);

  const [signups, active, revenue, matches, subs, conversion] = await Promise.all([
    sql`SELECT
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days}))                                   AS cur,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${2 * days})
                             AND created_at <  CURRENT_DATE - (INTERVAL '1 day' * ${days}))                                   AS prev
        FROM users WHERE is_admin = false`,
    sql`SELECT
          COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days}))                               AS cur,
          COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - (INTERVAL '1 day' * ${2 * days})
                             AND last_active_at <  CURRENT_DATE - (INTERVAL '1 day' * ${days}))                               AS prev
        FROM users WHERE is_admin = false AND is_disabled = false`,
    sql`SELECT
          COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})), 0)                   AS cur,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${2 * days})
                             AND created_at <  CURRENT_DATE - (INTERVAL '1 day' * ${days})), 0)                               AS prev
        FROM purchases WHERE payment_status = 'paid'`,
    sql`SELECT
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days}))                                   AS cur,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${2 * days})
                             AND created_at <  CURRENT_DATE - (INTERVAL '1 day' * ${days}))                                   AS prev
        FROM likes WHERE is_match = true`,
    sql`SELECT
          COUNT(*) FILTER (WHERE status = 'active')                                                                           AS cur,
          COUNT(*) FILTER (WHERE status = 'active' AND created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days}))             AS new_in_period
        FROM user_subscriptions`,
    sql`SELECT
          COUNT(*) FILTER (WHERE u.is_admin = false)                                                                          AS total_users,
          COUNT(DISTINCT s.user_id)                                                                                           AS paying
        FROM users u LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active'`,
  ]);

  const totalUsers = num(conversion[0].total_users);
  const paying = num(conversion[0].paying);

  return {
    days,
    tiles: [
      { key: "signups", label: "New sign-ups", value: num(signups[0].cur), prev: num(signups[0].prev), format: "int" },
      { key: "active", label: "Active users", value: num(active[0].cur), prev: num(active[0].prev), format: "int" },
      { key: "matches", label: "New matches", value: num(matches[0].cur), prev: num(matches[0].prev), format: "int" },
      { key: "revenue", label: "Revenue", value: num(revenue[0].cur), prev: num(revenue[0].prev), format: "money" },
      { key: "subs", label: "Active subscribers", value: num(subs[0].cur), prev: null, sub: `+${num(subs[0].new_in_period)} new in period`, format: "int" },
      { key: "conversion", label: "Free → paid", value: totalUsers ? (100 * paying) / totalUsers : 0, prev: null, sub: `${paying} of ${totalUsers.toLocaleString()} users`, format: "pct" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* GROWTH — daily sign-up trend + source mix                          */
/* ------------------------------------------------------------------ */
export async function getGrowth(daysIn: unknown) {
  const days = clampDays(daysIn, [14, 30, 90]);

  const [trend, sources] = await Promise.all([
    sql`SELECT created_at::date AS date, COUNT(*) AS signups
        FROM users
        WHERE is_admin = false AND created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
        GROUP BY created_at::date ORDER BY date`,
    sql`SELECT COALESCE(register_source::text, 'unknown') AS source, COUNT(*) AS signups
        FROM users
        WHERE is_admin = false AND created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
        GROUP BY 1 ORDER BY signups DESC`,
  ]);

  return {
    days,
    trend: trend.map((r) => ({ date: String(r.date).slice(0, 10), signups: num(r.signups) })),
    sources: sources.map((r) => ({ source: r.source as string, signups: num(r.signups) })),
  };
}

/* ------------------------------------------------------------------ */
/* FUNNEL — register → complete → like → match → message + completion  */
/* ------------------------------------------------------------------ */
export async function getFunnel(daysIn: unknown) {
  const days = clampDays(daysIn, [7, 30, 90]);

  const [funnel, completion] = await Promise.all([
    sql`WITH cohort AS (
          SELECT id FROM users WHERE is_admin = false AND created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
        )
        SELECT
          COUNT(DISTINCT c.id)                              AS registered,
          COUNT(DISTINCT c.id) FILTER (WHERE p.is_complete) AS completed_profile,
          COUNT(DISTINCT l.liker_id)                        AS sent_a_like,
          COUNT(DISTINCT m.liker_id)                        AS got_a_match,
          COUNT(DISTINCT msg.sender_id)                     AS sent_a_message
        FROM cohort c
        LEFT JOIN profiles p   ON p.user_id  = c.id
        LEFT JOIN likes    l   ON l.liker_id = c.id
        LEFT JOIN likes    m   ON m.liker_id = c.id AND m.is_match = true
        LEFT JOIN messages msg ON msg.sender_id = c.id AND msg.message_type = 'user'`,
    sql`SELECT u.created_at::date AS date, COUNT(*) AS registered,
          ROUND(100.0 * COUNT(*) FILTER (WHERE p.is_complete) / NULLIF(COUNT(*),0), 1) AS pct_complete
        FROM users u LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.is_admin = false AND u.created_at >= CURRENT_DATE - (INTERVAL '1 day' * 14)
        GROUP BY u.created_at::date ORDER BY date`,
  ]);

  const f = funnel[0];
  const stages = [
    { stage: "Registered", users: num(f.registered) },
    { stage: "Completed profile", users: num(f.completed_profile) },
    { stage: "Sent a like", users: num(f.sent_a_like) },
    { stage: "Got a match", users: num(f.got_a_match) },
    { stage: "Sent a message", users: num(f.sent_a_message) },
  ];
  const top = stages[0].users || 1;
  return {
    days,
    stages: stages.map((s, i) => ({
      ...s,
      pctOfTop: Math.round((100 * s.users) / top),
      stepConversion: i === 0 ? 100 : Math.round((100 * s.users) / (stages[i - 1].users || 1)),
    })),
    completion: completion.map((r) => ({ date: String(r.date).slice(0, 10), pct_complete: num(r.pct_complete) })),
  };
}

/* ------------------------------------------------------------------ */
/* ENGAGEMENT — match→convo, retention, swipe volume                   */
/* ------------------------------------------------------------------ */
export async function getEngagement(daysIn: unknown) {
  const days = clampDays(daysIn, [7, 30, 90]);

  const [convo, retention, swipes] = await Promise.all([
    sql`WITH recent_matches AS (
          SELECT liker_id, liked_id FROM likes
          WHERE is_match = true AND created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
        )
        SELECT COUNT(*) AS matches,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM messages msg WHERE msg.message_type = 'user'
              AND ((msg.sender_id = rm.liker_id AND msg.receiver_id = rm.liked_id)
                OR (msg.sender_id = rm.liked_id AND msg.receiver_id = rm.liker_id)))) AS talked
        FROM recent_matches rm`,
    sql`SELECT '7d' AS cohort, COUNT(*) AS size,
          ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1) AS pct
        FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 7
        UNION ALL SELECT '14d', COUNT(*),
          ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1)
        FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 14
        UNION ALL SELECT '30d', COUNT(*),
          ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1)
        FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 30`,
    sql`SELECT COALESCE(SUM(swipes_count),0) AS swipes, COALESCE(SUM(likes_count),0) AS likes,
          COALESCE(SUM(passes_count),0) AS passes
        FROM daily_actions WHERE action_date >= CURRENT_DATE - (INTERVAL '1 day' * ${days})`,
  ]);

  const matches = num(convo[0].matches);
  const talked = num(convo[0].talked);
  const sw = swipes[0];
  return {
    days,
    matchConvo: { matches, talked, dead: matches - talked, pct: matches ? Math.round((1000 * talked) / matches) / 10 : 0 },
    retention: retention.map((r) => ({ cohort: r.cohort as string, size: num(r.size), pct: num(r.pct) })),
    swipes: {
      swipes: num(sw.swipes),
      likes: num(sw.likes),
      passes: num(sw.passes),
      likeRate: num(sw.swipes) ? Math.round((1000 * num(sw.likes)) / num(sw.swipes)) / 10 : 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* LIQUIDITY — density by residence country (+ gender split)           */
/* ------------------------------------------------------------------ */
export async function getLiquidity(minUsersIn: unknown, limitIn: unknown, genderIn: unknown) {
  const minUsers = clampDays(minUsersIn, [1, 5, 10, 25, 50], 5);
  const limit = clampDays(limitIn, [10, 15, 25, 50], 15);
  const gender = genderIn === "male" || genderIn === "female" ? (genderIn as string) : "all";

  let rows;
  if (gender === "all") {
    rows = await sql`
      SELECT COALESCE(NULLIF(p.residence_country, ''), '—') AS country, COUNT(*) AS users,
        COUNT(*) FILTER (WHERE lower(p.gender) = 'male')   AS men,
        COUNT(*) FILTER (WHERE lower(p.gender) = 'female') AS women
      FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
      WHERE p.is_complete = true
      GROUP BY 1 HAVING COUNT(*) >= ${minUsers} ORDER BY users DESC LIMIT ${limit}`;
  } else {
    rows = await sql`
      SELECT COALESCE(NULLIF(p.residence_country, ''), '—') AS country, COUNT(*) AS users,
        COUNT(*) FILTER (WHERE lower(p.gender) = 'male')   AS men,
        COUNT(*) FILTER (WHERE lower(p.gender) = 'female') AS women
      FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
      WHERE p.is_complete = true AND lower(p.gender) = ${gender}
      GROUP BY 1 HAVING COUNT(*) >= ${minUsers} ORDER BY users DESC LIMIT ${limit}`;
  }

  const genderTotals = await sql`
    SELECT COALESCE(NULLIF(p.gender, ''), '(none)') AS gender, COUNT(*) AS users
    FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
    WHERE p.is_complete = true GROUP BY 1 ORDER BY users DESC`;

  return {
    minUsers,
    limit,
    gender,
    rows: rows.map((r) => ({ country: r.country as string, users: num(r.users), men: num(r.men), women: num(r.women) })),
    genderMix: genderTotals.map((r) => ({ gender: r.gender as string, users: num(r.users) })),
  };
}

/* ------------------------------------------------------------------ */
/* MONETIZATION — revenue, plans, conversion, offers, payment health   */
/* ------------------------------------------------------------------ */
export async function getMonetization(daysIn: unknown) {
  const days = clampDays(daysIn, [30, 90], 30);

  const [services, plans, offers, payments, revTrend] = await Promise.all([
    sql`SELECT ots.name AS service, COUNT(*) AS purchases, COALESCE(SUM(pu.amount),0) AS revenue, COALESCE(SUM(pu.quantity),0) AS units
        FROM purchases pu JOIN one_time_services ots ON ots.id = pu.service_id
        WHERE pu.payment_status = 'paid' AND pu.created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
        GROUP BY ots.name ORDER BY revenue DESC NULLS LAST`,
    sql`SELECT sp.display_name, sp.price, sp.duration, COUNT(*) FILTER (WHERE us.status = 'active') AS active_subs
        FROM user_subscriptions us JOIN subscription_plans sp ON sp.id = us.plan_id
        GROUP BY sp.display_name, sp.price, sp.duration
        HAVING COUNT(*) FILTER (WHERE us.status = 'active') > 0 ORDER BY active_subs DESC`,
    sql`SELECT o.name, COUNT(*) AS impressions,
          COUNT(*) FILTER (WHERE uoi.status = 'claimed') AS claimed,
          ROUND(100.0 * COUNT(*) FILTER (WHERE uoi.status='claimed') / NULLIF(COUNT(*),0),1) AS claim_rate
        FROM user_offer_impressions uoi JOIN offers o ON o.id = uoi.offer_id
        GROUP BY o.name ORDER BY impressions DESC`,
    sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'paid') AS succeeded,
          COUNT(*) FILTER (WHERE status <> 'paid') AS failed
        FROM subscription_payments WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})`,
    sql`SELECT created_at::date AS date, COALESCE(SUM(amount),0) AS revenue
        FROM purchases WHERE payment_status = 'paid' AND created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
        GROUP BY created_at::date ORDER BY date`,
  ]);

  const pay = payments[0];
  return {
    days,
    services: services.map((r) => ({ service: r.service as string, purchases: num(r.purchases), revenue: num(r.revenue), units: num(r.units) })),
    plans: plans.map((r) => ({ name: r.display_name as string, price: num(r.price), duration: (r.duration as string) || "", active: num(r.active_subs) })),
    offers: offers.map((r) => ({ name: r.name as string, impressions: num(r.impressions), claimed: num(r.claimed), claimRate: num(r.claim_rate) })),
    payments: { total: num(pay.total), succeeded: num(pay.succeeded), failed: num(pay.failed), failRate: num(pay.total) ? Math.round((1000 * num(pay.failed)) / num(pay.total)) / 10 : 0 },
    revenueTrend: revTrend.map((r) => ({ date: String(r.date).slice(0, 10), revenue: num(r.revenue) })),
  };
}

/* ------------------------------------------------------------------ */
/* TRUST & SAFETY — verification, data quality, spam signals           */
/* ------------------------------------------------------------------ */
export async function getSafety(daysIn: unknown) {
  const days = clampDays(daysIn, [14, 30, 90], 14);

  const [verification, quality, zeroPhotos, spam, reports, dupBios, ipMulti] = await Promise.all([
    sql`SELECT verification_status AS status, COUNT(*) AS users FROM users
        WHERE is_admin = false GROUP BY verification_status ORDER BY users DESC`,
    sql`SELECT COUNT(*) AS complete,
          COUNT(*) FILTER (WHERE gender IS NULL OR gender = '') AS missing_gender,
          COUNT(*) FILTER (WHERE heritage_country IS NULL OR heritage_country = '') AS missing_heritage,
          COUNT(*) FILTER (WHERE residence_country IS NULL OR residence_country = '') AS missing_residence,
          COUNT(*) FILTER (WHERE birthdate IS NULL) AS missing_birthdate
        FROM profiles WHERE is_complete = true`,
    sql`SELECT COUNT(*) AS n FROM profiles p WHERE p.is_complete = true
          AND NOT EXISTS (SELECT 1 FROM profile_photos pp WHERE pp.profile_id = p.id)`,
    sql`SELECT COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_disabled = false
        WHERE p.bio ~* '(whats\\s?app|telegram|viber|instagram|snapchat|@[a-z0-9_]+|\\+?\\d[\\d \\-]{7,}\\d)'`,
    sql`SELECT created_at::date AS date, COUNT(*) AS reports FROM profile_reports
        WHERE created_at >= CURRENT_DATE - (INTERVAL '1 day' * ${days}) GROUP BY created_at::date ORDER BY date`,
    sql`SELECT p.bio, COUNT(*) AS num FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_disabled = false
        WHERE p.bio IS NOT NULL AND LENGTH(TRIM(p.bio)) > 15 GROUP BY p.bio HAVING COUNT(*) > 1 ORDER BY num DESC LIMIT 10`,
    sql`SELECT il.ip_address, COUNT(DISTINCT il.user_id) AS accounts FROM ip_logs il
        GROUP BY il.ip_address HAVING COUNT(DISTINCT il.user_id) >= 3 ORDER BY accounts DESC LIMIT 10`,
  ]);

  const q = quality[0];
  return {
    days,
    verification: verification.map((r) => ({ status: (r.status as string) || "unknown", users: num(r.users) })),
    quality: {
      complete: num(q.complete),
      missing_gender: num(q.missing_gender),
      missing_heritage: num(q.missing_heritage),
      missing_residence: num(q.missing_residence),
      missing_birthdate: num(q.missing_birthdate),
    },
    zeroPhotos: num(zeroPhotos[0].n),
    spamBios: num(spam[0].n),
    reports: reports.map((r) => ({ date: String(r.date).slice(0, 10), reports: num(r.reports) })),
    duplicateBios: dupBios.map((r) => ({ bio: r.bio as string, num: num(r.num) })),
    ipClusters: ipMulti.map((r) => ({ ip: r.ip_address as string, accounts: num(r.accounts) })),
  };
}
