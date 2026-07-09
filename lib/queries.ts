import { sql, clampDays } from "./db";
import { resolvePeriod, type PeriodInput, type Period } from "./period";

// Helper: coerce Neon's string-typed numerics to JS numbers.
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

// Compact period descriptor returned to the client for labels.
const meta = (p: Period) => ({ mode: p.mode, days: p.days, label: p.label, prevLabel: p.prevLabel, hasPrev: p.hasPrev });

/* ------------------------------------------------------------------ */
/* OVERVIEW — headline KPIs with period-over-period deltas             */
/* ------------------------------------------------------------------ */
export async function getOverview(params: PeriodInput) {
  const p = resolvePeriod(params, [1, 7, 30, 90], 30);

  const [signups, active, revenue, matches, subs, conversion] = await Promise.all([
    sql`SELECT
          COUNT(*) FILTER (WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz)         AS cur,
          COUNT(*) FILTER (WHERE created_at >= ${p.prevStart}::timestamptz AND created_at < ${p.prevEndEx}::timestamptz) AS prev
        FROM users WHERE is_admin = false`,
    sql`SELECT
          COUNT(*) FILTER (WHERE last_active_at >= ${p.start}::timestamptz AND last_active_at < ${p.endEx}::timestamptz)         AS cur,
          COUNT(*) FILTER (WHERE last_active_at >= ${p.prevStart}::timestamptz AND last_active_at < ${p.prevEndEx}::timestamptz) AS prev
        FROM users WHERE is_admin = false AND is_disabled = false`,
    sql`WITH txns AS (
          SELECT created_at, amount FROM subscription_payments WHERE status = 'succeeded'
          UNION ALL
          SELECT created_at, amount FROM purchases WHERE payment_status = 'paid'
        )
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz), 0)         AS cur,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= ${p.prevStart}::timestamptz AND created_at < ${p.prevEndEx}::timestamptz), 0) AS prev
        FROM txns`,
    sql`SELECT
          COUNT(*) FILTER (WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz)         AS cur,
          COUNT(*) FILTER (WHERE created_at >= ${p.prevStart}::timestamptz AND created_at < ${p.prevEndEx}::timestamptz) AS prev
        FROM likes WHERE is_match = true`,
    // New premium subscriptions = subscriptions whose FIRST successful payment
    // lands in the period (a real paid conversion, not an unpaid subscription row).
    sql`WITH first_paid AS (
          SELECT subscription_id, MIN(created_at) AS fp
          FROM subscription_payments WHERE status = 'succeeded' GROUP BY subscription_id
        )
        SELECT
          COUNT(*) FILTER (WHERE fp >= ${p.start}::timestamptz AND fp < ${p.endEx}::timestamptz)         AS cur,
          COUNT(*) FILTER (WHERE fp >= ${p.prevStart}::timestamptz AND fp < ${p.prevEndEx}::timestamptz) AS prev
        FROM first_paid`,
    // Free→paid for the period's signup cohort: of users who signed up in the
    // window, how many are paying (have an active subscription).
    sql`SELECT
          COUNT(*) FILTER (WHERE u.created_at >= ${p.start}::timestamptz AND u.created_at < ${p.endEx}::timestamptz)                              AS signups_cur,
          COUNT(*) FILTER (WHERE u.created_at >= ${p.start}::timestamptz AND u.created_at < ${p.endEx}::timestamptz AND s.user_id IS NOT NULL)     AS paid_cur,
          COUNT(*) FILTER (WHERE u.created_at >= ${p.prevStart}::timestamptz AND u.created_at < ${p.prevEndEx}::timestamptz)                       AS signups_prev,
          COUNT(*) FILTER (WHERE u.created_at >= ${p.prevStart}::timestamptz AND u.created_at < ${p.prevEndEx}::timestamptz AND s.user_id IS NOT NULL) AS paid_prev
        FROM users u
        LEFT JOIN (SELECT DISTINCT user_id FROM user_subscriptions WHERE status = 'active') s ON s.user_id = u.id
        WHERE u.is_admin = false`,
  ]);

  const pv = (v: number) => (p.hasPrev ? v : null);
  const cv = conversion[0];
  const convCur = num(cv.signups_cur) ? (100 * num(cv.paid_cur)) / num(cv.signups_cur) : 0;
  const convPrev = num(cv.signups_prev) ? (100 * num(cv.paid_prev)) / num(cv.signups_prev) : 0;

  return {
    period: meta(p),
    tiles: [
      { key: "signups", label: "New sign-ups", value: num(signups[0].cur), prev: pv(num(signups[0].prev)), format: "int" },
      { key: "active", label: "Active users", value: num(active[0].cur), prev: pv(num(active[0].prev)), format: "int" },
      { key: "matches", label: "New matches", value: num(matches[0].cur), prev: pv(num(matches[0].prev)), format: "int" },
      { key: "revenue", label: "Revenue (all sources)", value: num(revenue[0].cur), prev: pv(num(revenue[0].prev)), format: "money" },
      { key: "subs", label: "New premium subs", value: num(subs[0].cur), prev: pv(num(subs[0].prev)), sub: "first paid subscription", format: "int" },
      { key: "conversion", label: "Free → paid", value: convCur, prev: pv(convPrev), sub: `${num(cv.paid_cur)} of ${fmtIntLocal(num(cv.signups_cur))} signups`, format: "pct" },
    ],
  };
}

const fmtIntLocal = (n: number) => n.toLocaleString("en-US");

/* ------------------------------------------------------------------ */
/* GROWTH — daily sign-up trend + source mix                          */
/* ------------------------------------------------------------------ */
export async function getGrowth(params: PeriodInput) {
  const p = resolvePeriod(params, [1, 7, 14, 30, 90], 30);

  const [trend, sources] = await Promise.all([
    sql`SELECT created_at::date AS date, COUNT(*) AS signups
        FROM users
        WHERE is_admin = false AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
        GROUP BY 1 ORDER BY 1`,
    sql`SELECT COALESCE(register_source::text, 'unknown') AS source, COUNT(*) AS signups
        FROM users
        WHERE is_admin = false AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
        GROUP BY 1 ORDER BY signups DESC`,
  ]);

  return {
    period: meta(p),
    trend: trend.map((r) => ({ date: String(r.date).slice(0, 10), signups: num(r.signups) })),
    sources: sources.map((r) => ({ source: r.source as string, signups: num(r.signups) })),
  };
}

/* ------------------------------------------------------------------ */
/* FUNNEL — register → complete → like → match → message + completion  */
/* ------------------------------------------------------------------ */
export async function getFunnel(params: PeriodInput) {
  const p = resolvePeriod(params, [1, 7, 28, 90], 28);

  const [cur, prev, completion] = await Promise.all([
    sql`WITH cohort AS (
          SELECT id FROM users WHERE is_admin = false
            AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
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
    sql`WITH cohort AS (
          SELECT id FROM users WHERE is_admin = false
            AND created_at >= ${p.prevStart}::timestamptz AND created_at < ${p.prevEndEx}::timestamptz
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

  const c = cur[0];
  const pvRow = prev[0];
  const defs: [string, string][] = [
    ["Registered", "registered"],
    ["Completed profile", "completed_profile"],
    ["Sent a like", "sent_a_like"],
    ["Got a match", "got_a_match"],
    ["Sent a message", "sent_a_message"],
  ];
  const stages = defs.map(([stage, key]) => ({ stage, users: num(c[key]), prevUsers: num(pvRow[key]) }));
  const top = stages[0].users || 1;
  return {
    period: meta(p),
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
export async function getEngagement(params: PeriodInput) {
  const p = resolvePeriod(params, [1, 7, 30, 90], 30);

  const [convo, retention, swipes] = await Promise.all([
    sql`WITH recent_matches AS (
          SELECT liker_id, liked_id FROM likes
          WHERE is_match = true AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
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
        FROM daily_actions WHERE action_date >= ${p.startDate}::date AND action_date < ${p.endExDate}::date`,
  ]);

  const matches = num(convo[0].matches);
  const talked = num(convo[0].talked);
  const sw = swipes[0];
  return {
    period: meta(p),
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
/* USERS — drill-down list behind sign-ups / active-users tiles        */
/* ------------------------------------------------------------------ */
export async function getUsers(params: PeriodInput, typeIn: unknown) {
  // Broad allow-list so any section's preset window (incl. 14/28) passes through.
  const p = resolvePeriod(params, [1, 7, 14, 28, 30, 90], 30);
  const allowed = ["signups", "active", "completed", "liked", "matched", "messaged"];
  const type = allowed.includes(String(typeIn)) ? String(typeIn) : "signups";

  // 'active' = last_active in window; everything else = signup cohort in window,
  // optionally filtered to a funnel stage.
  const rows = await sql`
    SELECT u.id,
      NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS name,
      u.email, u.created_at, u.last_active_at,
      u.verification_status AS verification, COALESCE(u.register_source::text, 'unknown') AS source,
      EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id = u.id AND pr.is_complete) AS complete
    FROM users u
    WHERE u.is_admin = false
      AND (
        (${type} = 'active'
          AND u.is_disabled = false AND u.last_active_at >= ${p.start}::timestamptz AND u.last_active_at < ${p.endEx}::timestamptz)
        OR (${type} <> 'active'
          AND u.created_at >= ${p.start}::timestamptz AND u.created_at < ${p.endEx}::timestamptz
          AND (${type} <> 'completed' OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id = u.id AND pr.is_complete))
          AND (${type} <> 'liked'     OR EXISTS (SELECT 1 FROM likes l WHERE l.liker_id = u.id))
          AND (${type} <> 'matched'   OR EXISTS (SELECT 1 FROM likes l WHERE l.liker_id = u.id AND l.is_match = true))
          AND (${type} <> 'messaged'  OR EXISTS (SELECT 1 FROM messages m WHERE m.sender_id = u.id AND m.message_type = 'user'))
        )
      )
    ORDER BY (CASE WHEN ${type} = 'active' THEN u.last_active_at ELSE u.created_at END) DESC NULLS LAST
    LIMIT 500`;

  return {
    period: meta(p),
    type,
    rows: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string | null,
      email: r.email as string | null,
      createdAt: r.created_at ? String(r.created_at) : null,
      lastActiveAt: r.last_active_at ? String(r.last_active_at) : null,
      verification: (r.verification as string) || "unverified",
      source: r.source as string,
      complete: r.complete as boolean,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* SUBSCRIBERS — active subscribers behind a plan row                  */
/* ------------------------------------------------------------------ */
export async function getSubscribers(nameIn: unknown, priceIn: unknown, durationIn: unknown) {
  const name = String(nameIn ?? "");
  const price = String(priceIn ?? "");
  const duration = String(durationIn ?? "");

  const rows = await sql`
    SELECT u.id,
      NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS name,
      u.email, us.created_at AS subscribed_at
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    JOIN users u ON u.id = us.user_id
    WHERE us.status = 'active'
      AND sp.display_name = ${name} AND sp.price = ${price}::numeric AND sp.duration = ${duration}
    ORDER BY us.created_at DESC
    LIMIT 500`;

  return {
    plan: { name: name.trim(), price: num(price), duration },
    rows: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string | null,
      email: r.email as string | null,
      subscribedAt: r.subscribed_at ? String(r.subscribed_at) : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* MATCHES — drill-down list behind the Engagement tiles               */
/* ------------------------------------------------------------------ */
export async function getMatches(params: PeriodInput, typeIn: unknown) {
  const p = resolvePeriod(params, [1, 7, 30, 90], 30);
  const type = typeIn === "talked" || typeIn === "dead" ? (typeIn as string) : "all";

  const rows = await sql`
    WITH m AS (
      SELECT LEAST(liker_id, liked_id) AS a, GREATEST(liker_id, liked_id) AS b, MIN(created_at) AS matched_at
      FROM likes
      WHERE is_match = true AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
      GROUP BY 1, 2
    ),
    msg AS (
      SELECT LEAST(sender_id, receiver_id) AS a, GREATEST(sender_id, receiver_id) AS b, COUNT(*) AS c
      FROM messages WHERE message_type = 'user' GROUP BY 1, 2
    )
    SELECT m.a, m.b, m.matched_at, msg.c AS msgs,
      NULLIF(TRIM(COALESCE(ua.first_name,'') || ' ' || COALESCE(ua.last_name,'')), '') AS a_name, ua.email AS a_email,
      NULLIF(TRIM(COALESCE(ub.first_name,'') || ' ' || COALESCE(ub.last_name,'')), '') AS b_name, ub.email AS b_email
    FROM m
    LEFT JOIN msg   ON msg.a = m.a AND msg.b = m.b
    JOIN users ua   ON ua.id = m.a
    JOIN users ub   ON ub.id = m.b
    WHERE (${type} = 'all' OR (${type} = 'talked' AND msg.c IS NOT NULL) OR (${type} = 'dead' AND msg.c IS NULL))
    ORDER BY m.matched_at DESC
    LIMIT 500`;

  return {
    period: meta(p),
    type,
    rows: rows.map((r) => ({
      a: { id: r.a as string, name: r.a_name as string | null, email: r.a_email as string | null },
      b: { id: r.b as string, name: r.b_name as string | null, email: r.b_email as string | null },
      matchedAt: r.matched_at ? String(r.matched_at) : null,
      messages: num(r.msgs),
      talked: num(r.msgs) > 0,
    })),
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
      GROUP BY 1 HAVING COUNT(*) >= ${minUsers} ORDER BY users DESC LIMIT ${limit}`;
  } else {
    rows = await sql`
      SELECT COALESCE(NULLIF(p.residence_country, ''), '—') AS country, COUNT(*) AS users,
        COUNT(*) FILTER (WHERE lower(p.gender) = 'male')   AS men,
        COUNT(*) FILTER (WHERE lower(p.gender) = 'female') AS women
      FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
      WHERE lower(p.gender) = ${gender}
      GROUP BY 1 HAVING COUNT(*) >= ${minUsers} ORDER BY users DESC LIMIT ${limit}`;
  }

  const genderTotals = await sql`
    SELECT COALESCE(NULLIF(p.gender, ''), '(none)') AS gender, COUNT(*) AS users
    FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
    GROUP BY 1 ORDER BY users DESC`;

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
export async function getMonetization(params: PeriodInput) {
  const p = resolvePeriod(params, [1, 7, 14, 30, 90], 30);

  // Unified revenue: subscription payments (first-per-subscription = new, later = renewal)
  // + one-time purchases split by service type. The txns CTE is repeated inline in the
  // two queries below so each can stay a single parameterised tagged template.
  const [byType, trend, plans, offers, payments] = await Promise.all([
    sql`WITH txns AS (
          SELECT sp.created_at, CASE WHEN sp.rn = 1 THEN 'Subscriptions' ELSE 'Renewals' END AS type, sp.amount
          FROM (SELECT created_at, amount, ROW_NUMBER() OVER (PARTITION BY subscription_id ORDER BY created_at) AS rn
                FROM subscription_payments WHERE status = 'succeeded') sp
          UNION ALL
          SELECT pu.created_at,
                 CASE ots.service_type WHEN 'message' THEN 'Roses' WHEN 'super_like' THEN 'Super Likes'
                      WHEN 'profile_boost' THEN 'Boosts' ELSE ots.name END AS type, pu.amount
          FROM purchases pu JOIN one_time_services ots ON ots.id = pu.service_id WHERE pu.payment_status = 'paid'
        )
        SELECT type, COUNT(*) AS transactions, COALESCE(SUM(amount),0) AS revenue
        FROM txns WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
        GROUP BY type ORDER BY revenue DESC`,
    sql`WITH txns AS (
          SELECT sp.created_at, sp.amount
          FROM (SELECT created_at, amount FROM subscription_payments WHERE status = 'succeeded') sp
          UNION ALL
          SELECT pu.created_at, pu.amount
          FROM purchases pu WHERE pu.payment_status = 'paid'
        )
        SELECT created_at::date AS date, COALESCE(SUM(amount),0) AS revenue
        FROM txns WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
        GROUP BY 1 ORDER BY 1`,
    sql`SELECT sp.display_name, sp.price, sp.duration, COUNT(*) FILTER (WHERE us.status = 'active') AS active_subs
        FROM user_subscriptions us JOIN subscription_plans sp ON sp.id = us.plan_id
        GROUP BY sp.display_name, sp.price, sp.duration
        HAVING COUNT(*) FILTER (WHERE us.status = 'active') > 0 ORDER BY active_subs DESC`,
    sql`SELECT o.name, COUNT(*) AS impressions,
          COUNT(*) FILTER (WHERE uoi.status = 'claimed') AS claimed,
          ROUND(100.0 * COUNT(*) FILTER (WHERE uoi.status='claimed') / NULLIF(COUNT(*),0),1) AS claim_rate
        FROM user_offer_impressions uoi JOIN offers o ON o.id = uoi.offer_id
        GROUP BY o.name ORDER BY impressions DESC`,
    // NOTE: in subscription_payments the success value is 'succeeded' (not 'paid').
    sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
          COUNT(*) FILTER (WHERE status <> 'succeeded') AS failed
        FROM subscription_payments WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz`,
  ]);

  const pay = payments[0];
  const revenueByType = byType.map((r) => ({ type: r.type as string, transactions: num(r.transactions), revenue: num(r.revenue) }));
  const totalRevenue = revenueByType.reduce((s, r) => s + r.revenue, 0);
  return {
    period: meta(p),
    revenueByType,
    totalRevenue,
    revenueTrend: trend.map((r) => ({ date: String(r.date).slice(0, 10), revenue: num(r.revenue) })),
    plans: plans.map((r) => ({ name: r.display_name as string, price: num(r.price), duration: (r.duration as string) || "", active: num(r.active_subs) })),
    offers: offers.map((r) => ({ name: r.name as string, impressions: num(r.impressions), claimed: num(r.claimed), claimRate: num(r.claim_rate) })),
    payments: { total: num(pay.total), succeeded: num(pay.succeeded), failed: num(pay.failed), failRate: num(pay.total) ? Math.round((1000 * num(pay.failed)) / num(pay.total)) / 10 : 0 },
  };
}

/* ------------------------------------------------------------------ */
/* DIAGNOSTICS — the leaky-bucket analysis (structural, all-time)      */
/* ------------------------------------------------------------------ */
export async function getDiagnostics() {
  const [retention, ttv, dead, push] = await Promise.all([
    // Day-1 behaviour of a mature cohort (registered 7–30 days ago), split by
    // whether they're still active in the last 3 days.
    sql`WITH cohort AS (
          SELECT id, created_at,
            CASE WHEN last_active_at IS NULL THEN 'ghost'
                 WHEN last_active_at >= CURRENT_DATE - INTERVAL '3 days' THEN 'retained'
                 ELSE 'churned' END AS grp
          FROM users WHERE is_admin = false
            AND created_at::date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 7
        )
        SELECT grp, COUNT(*) AS n,
          ROUND(100.0*AVG((EXISTS(SELECT 1 FROM likes l WHERE l.liker_id=c.id AND l.created_at < c.created_at + INTERVAL '1 day'))::int),1) AS liked,
          ROUND(100.0*AVG((EXISTS(SELECT 1 FROM likes l WHERE l.liker_id=c.id AND l.is_match AND l.created_at < c.created_at + INTERVAL '1 day'))::int),1) AS matched,
          ROUND(100.0*AVG((EXISTS(SELECT 1 FROM messages m WHERE m.sender_id=c.id AND m.message_type='user' AND m.created_at < c.created_at + INTERVAL '1 day'))::int),1) AS messaged,
          ROUND(100.0*AVG((EXISTS(SELECT 1 FROM profiles p WHERE p.user_id=c.id AND p.is_complete))::int),1) AS complete
        FROM cohort c GROUP BY grp`,
    // Median hours from signup to first like / match / message (+ how many ever did it).
    sql`WITH fl AS (SELECT liker_id uid, MIN(created_at) t FROM likes GROUP BY 1),
             fm AS (SELECT liker_id uid, MIN(created_at) t FROM likes WHERE is_match GROUP BY 1),
             fg AS (SELECT sender_id uid, MIN(created_at) t FROM messages WHERE message_type='user' GROUP BY 1)
        SELECT
          ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fl.t-u.created_at))/3600)::numeric,1) AS like_h,
          ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fm.t-u.created_at))/3600)::numeric,1) AS match_h,
          ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fg.t-u.created_at))/3600)::numeric,1) AS msg_h,
          COUNT(fl.t) AS ever_liked, COUNT(fm.t) AS ever_matched, COUNT(fg.t) AS ever_messaged, COUNT(*) AS total
        FROM users u LEFT JOIN fl ON fl.uid=u.id LEFT JOIN fm ON fm.uid=u.id LEFT JOIN fg ON fg.uid=u.id
        WHERE u.is_admin=false`,
    // Dead-match split: of all matches, how many had 0 / 1 / 2 people message.
    sql`WITH matches AS (SELECT DISTINCT LEAST(liker_id,liked_id) a, GREATEST(liker_id,liked_id) b FROM likes WHERE is_match=true),
             pm AS (SELECT LEAST(sender_id,receiver_id) a, GREATEST(sender_id,receiver_id) b, COUNT(DISTINCT sender_id) senders FROM messages WHERE message_type='user' GROUP BY 1,2)
        SELECT COALESCE(pm.senders,0) AS senders, COUNT(*) AS matches
        FROM matches m LEFT JOIN pm ON pm.a=m.a AND pm.b=m.b GROUP BY 1`,
    // Push reach: how many users could actually be re-engaged.
    sql`SELECT (SELECT COUNT(DISTINCT user_id) FROM push_notification_tokens) AS tokens,
               (SELECT COUNT(*) FROM users WHERE is_admin=false) AS users`,
  ]);

  const g = (name: string) => retention.find((r) => r.grp === name) || {};
  const grp = (r: any) => ({
    n: num(r.n), liked: num(r.liked), matched: num(r.matched), messaged: num(r.messaged), complete: num(r.complete),
  });
  const t = ttv[0];
  const deadBy = (s: number) => num((dead.find((r) => num(r.senders) === s) || {}).matches);
  const neither = deadBy(0), oneSided = deadBy(1), alive = deadBy(2);
  const totalMatches = neither + oneSided + alive;
  const cohortN = num(g("retained").n) + num(g("churned").n) + num(g("ghost").n);

  return {
    retention: {
      cohortN,
      retained: grp(g("retained")),
      churned: grp(g("churned")),
      ghost: grp(g("ghost")),
    },
    timeToValue: {
      likeH: num(t.like_h), matchH: num(t.match_h), msgH: num(t.msg_h),
      everLiked: num(t.ever_liked), everMatched: num(t.ever_matched), everMessaged: num(t.ever_messaged), total: num(t.total),
    },
    deadMatches: { neither, oneSided, alive, total: totalMatches },
    pushReach: { tokens: num(push[0].tokens), users: num(push[0].users) },
  };
}

/* ------------------------------------------------------------------ */
/* RETENTION USERS — per-user detail behind a diagnostics segment      */
/* ------------------------------------------------------------------ */
export async function getRetentionUsers(segmentIn: unknown) {
  const segment = ["retained", "churned", "ghost"].includes(String(segmentIn)) ? String(segmentIn) : "churned";

  const [summary, rows] = await Promise.all([
    sql`WITH cohort AS (
          SELECT id, last_active_at,
            CASE WHEN last_active_at IS NULL THEN 'ghost'
                 WHEN last_active_at >= CURRENT_DATE - INTERVAL '3 days' THEN 'retained'
                 ELSE 'churned' END AS grp
          FROM users WHERE is_admin = false AND created_at::date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 7
        ),
        lks AS (SELECT l.liker_id uid, COUNT(*) c FROM likes l JOIN cohort co ON co.id = l.liker_id GROUP BY 1),
        lkr AS (SELECT l.liked_id uid, COUNT(*) c FROM likes l JOIN cohort co ON co.id = l.liked_id GROUP BY 1),
        mss AS (SELECT m.sender_id uid, COUNT(*) c FROM messages m JOIN cohort co ON co.id = m.sender_id WHERE m.message_type='user' GROUP BY 1),
        ph  AS (SELECT DISTINCT profile_id FROM profile_photos)
        SELECT COUNT(*) AS n,
          ROUND(100.0*AVG((COALESCE(p.is_complete,false))::int),1) AS pct_complete,
          ROUND(100.0*AVG((ph.profile_id IS NOT NULL)::int),1) AS pct_photo,
          ROUND(100.0*AVG((lower(p.gender)='female')::int),1) AS pct_female,
          ROUND(100.0*AVG((lower(p.gender)='male')::int),1) AS pct_male,
          ROUND(100.0*AVG((p.heritage_countries IS NOT NULL AND cardinality(p.heritage_countries)>0)::int),1) AS pct_heritage,
          ROUND(AVG(COALESCE(lks.c,0)),1) AS avg_likes_sent,
          ROUND(AVG(COALESCE(lkr.c,0)),1) AS avg_likes_received,
          ROUND(AVG(COALESCE(mss.c,0)),1) AS avg_msgs_sent
        FROM cohort c
        LEFT JOIN profiles p ON p.user_id=c.id
        LEFT JOIN ph ON ph.profile_id=p.id
        LEFT JOIN lks ON lks.uid=c.id LEFT JOIN lkr ON lkr.uid=c.id LEFT JOIN mss ON mss.uid=c.id
        WHERE c.grp = ${segment}`,
    sql`WITH cohort AS (
          SELECT id, first_name, last_name, email, created_at, last_active_at, verification_status,
            CASE WHEN last_active_at IS NULL THEN 'ghost'
                 WHEN last_active_at >= CURRENT_DATE - INTERVAL '3 days' THEN 'retained'
                 ELSE 'churned' END AS grp
          FROM users WHERE is_admin = false AND created_at::date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 7
        ),
        lks AS (SELECT l.liker_id uid, COUNT(*) c FROM likes l JOIN cohort co ON co.id = l.liker_id GROUP BY 1),
        lkr AS (SELECT l.liked_id uid, COUNT(*) c FROM likes l JOIN cohort co ON co.id = l.liked_id GROUP BY 1),
        mss AS (SELECT m.sender_id uid, COUNT(*) c FROM messages m JOIN cohort co ON co.id = m.sender_id WHERE m.message_type='user' GROUP BY 1),
        msr AS (SELECT m.receiver_id uid, COUNT(*) c FROM messages m JOIN cohort co ON co.id = m.receiver_id WHERE m.message_type='user' GROUP BY 1),
        ph  AS (SELECT DISTINCT profile_id FROM profile_photos)
        SELECT c.id,
          NULLIF(TRIM(COALESCE(c.first_name,'')||' '||COALESCE(c.last_name,'')),'') AS name,
          c.email, c.created_at, c.last_active_at, c.verification_status AS verification,
          p.gender, COALESCE(NULLIF(p.residence_country,''),'—') AS residence,
          array_to_string(p.heritage_countries, ', ') AS heritage,
          COALESCE(p.is_complete,false) AS complete,
          (ph.profile_id IS NOT NULL) AS has_photo,
          COALESCE(lks.c,0) AS likes_sent, COALESCE(lkr.c,0) AS likes_received,
          COALESCE(mss.c,0) AS msgs_sent, COALESCE(msr.c,0) AS msgs_received
        FROM cohort c
        LEFT JOIN profiles p ON p.user_id=c.id
        LEFT JOIN ph ON ph.profile_id=p.id
        LEFT JOIN lks ON lks.uid=c.id LEFT JOIN lkr ON lkr.uid=c.id
        LEFT JOIN mss ON mss.uid=c.id LEFT JOIN msr ON msr.uid=c.id
        WHERE c.grp = ${segment}
        ORDER BY c.last_active_at DESC NULLS LAST LIMIT 500`,
  ]);

  const s = summary[0];
  return {
    segment,
    summary: {
      n: num(s.n), pctComplete: num(s.pct_complete), pctPhoto: num(s.pct_photo),
      pctFemale: num(s.pct_female), pctMale: num(s.pct_male), pctHeritage: num(s.pct_heritage),
      avgLikesSent: num(s.avg_likes_sent), avgLikesReceived: num(s.avg_likes_received), avgMsgsSent: num(s.avg_msgs_sent),
    },
    rows: rows.map((r) => ({
      id: r.id as string, name: r.name as string | null, email: r.email as string | null,
      gender: (r.gender as string) || null, residence: r.residence as string, heritage: (r.heritage as string) || null,
      complete: r.complete as boolean, hasPhoto: r.has_photo as boolean,
      likesSent: num(r.likes_sent), likesReceived: num(r.likes_received),
      msgsSent: num(r.msgs_sent), msgsReceived: num(r.msgs_received),
      lastActiveAt: r.last_active_at ? String(r.last_active_at) : null,
      createdAt: r.created_at ? String(r.created_at) : null,
      verification: (r.verification as string) || "unverified",
    })),
  };
}

/* ------------------------------------------------------------------ */
/* TRUST & SAFETY — verification, data quality, spam signals           */
/* ------------------------------------------------------------------ */
export async function getSafety(params: PeriodInput) {
  const p = resolvePeriod(params, [1, 7, 14, 30, 90], 14);

  // Every metric is scoped to profiles/users registered in the selected window
  // (and reports/IP-logs recorded in it), so the whole section reacts to the filter.
  const [verification, quality, zeroPhotos, spam, reports, dupBios, ipMulti, reportedUsers, botEmails] = await Promise.all([
    // Data-quality + verification measure the signup cohort in the window.
    sql`SELECT verification_status AS status, COUNT(*) AS users FROM users
        WHERE is_admin = false AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
        GROUP BY verification_status ORDER BY users DESC`,
    sql`SELECT COUNT(*) AS complete,
          COUNT(*) FILTER (WHERE gender IS NULL OR gender = '') AS missing_gender,
          COUNT(*) FILTER (WHERE heritage_countries IS NULL OR cardinality(heritage_countries) = 0) AS missing_heritage,
          COUNT(*) FILTER (WHERE residence_country IS NULL OR residence_country = '') AS missing_residence,
          COUNT(*) FILTER (WHERE birthdate IS NULL) AS missing_birthdate
        FROM profiles WHERE is_complete = true AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz`,
    sql`SELECT COUNT(*) AS n FROM profiles p WHERE p.is_complete = true
          AND p.created_at >= ${p.start}::timestamptz AND p.created_at < ${p.endEx}::timestamptz
          AND NOT EXISTS (SELECT 1 FROM profile_photos pp WHERE pp.profile_id = p.id)`,
    sql`SELECT COUNT(*) AS n FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_disabled = false
        WHERE p.created_at >= ${p.start}::timestamptz AND p.created_at < ${p.endEx}::timestamptz
          AND p.bio ~* '(whats\\s?app|telegram|viber|instagram|snapchat|@[a-z0-9_]+|\\+?\\d[\\d \\-]{7,}\\d)'`,
    sql`SELECT created_at::date AS date, COUNT(*) AS reports FROM profile_reports
        WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz GROUP BY 1 ORDER BY 1`,
    sql`SELECT p.bio, COUNT(*) AS num,
          json_agg(DISTINCT jsonb_build_object(
            'id', u.id,
            'name', NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
            'email', u.email)) AS members
        FROM profiles p JOIN users u ON u.id = p.user_id AND u.is_disabled = false
        WHERE p.bio IS NOT NULL AND LENGTH(TRIM(p.bio)) > 15
          AND p.created_at >= ${p.start}::timestamptz AND p.created_at < ${p.endEx}::timestamptz
        GROUP BY p.bio HAVING COUNT(*) > 1 ORDER BY num DESC LIMIT 10`,
    sql`SELECT il.ip_address, COUNT(DISTINCT il.user_id) AS accounts,
          json_agg(DISTINCT jsonb_build_object(
            'id', u.id,
            'name', NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
            'email', u.email)) AS members
        FROM ip_logs il JOIN users u ON u.id = il.user_id
        WHERE il.created_at >= ${p.start}::timestamptz AND il.created_at < ${p.endEx}::timestamptz
        GROUP BY il.ip_address HAVING COUNT(DISTINCT il.user_id) >= 3 ORDER BY accounts DESC LIMIT 10`,
    // repeatedly-reported users (>=2 reports in window)
    sql`SELECT r.reported_user_id AS id, COUNT(*) AS reports,
          mode() WITHIN GROUP (ORDER BY r.category::text) AS top_category,
          NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS name, u.email
        FROM profile_reports r JOIN users u ON u.id = r.reported_user_id
        WHERE r.created_at >= ${p.start}::timestamptz AND r.created_at < ${p.endEx}::timestamptz
        GROUP BY r.reported_user_id, u.first_name, u.last_name, u.email
        HAVING COUNT(*) >= 2 ORDER BY reports DESC LIMIT 10`,
    // bot-like emails: 5+ consecutive digits before the @ (auto-generated handles)
    sql`SELECT COUNT(*) AS total,
          COALESCE(json_agg(jsonb_build_object('id', id, 'name', name, 'email', email)) FILTER (WHERE rn <= 15), '[]') AS sample
        FROM (
          SELECT id, NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), '') AS name, email,
                 ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
          FROM users WHERE is_admin = false AND email ~ '[0-9]{5,}@'
            AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
        ) t`,
  ]);

  const q = quality[0];
  return {
    period: meta(p),
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
    duplicateBios: dupBios.map((r) => ({ bio: r.bio as string, num: num(r.num), members: (r.members as any[]) || [] })),
    ipClusters: ipMulti.map((r) => ({ ip: r.ip_address as string, accounts: num(r.accounts), members: (r.members as any[]) || [] })),
    reportedUsers: reportedUsers.map((r) => ({ id: r.id as string, reports: num(r.reports), category: (r.top_category as string) || "other", name: r.name as string | null, email: r.email as string | null })),
    botEmails: { total: num(botEmails[0].total), sample: (botEmails[0].sample as any[]) || [] },
  };
}
