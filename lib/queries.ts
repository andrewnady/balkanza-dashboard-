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
    // Distinct matched pairs (each match is two like rows — dedupe with LEAST/GREATEST).
    sql`SELECT
          COUNT(*) FILTER (WHERE mn >= ${p.start}::timestamptz AND mn < ${p.endEx}::timestamptz)         AS cur,
          COUNT(*) FILTER (WHERE mn >= ${p.prevStart}::timestamptz AND mn < ${p.prevEndEx}::timestamptz) AS prev
        FROM (SELECT MIN(created_at) AS mn FROM likes WHERE is_match = true
              GROUP BY LEAST(liker_id, liked_id), GREATEST(liker_id, liked_id)) t`,
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
    // Unique matched pairs (each match is stored as two like rows — dedupe with
    // LEAST/GREATEST). Split by how many of the two people ever messaged
    // (text or rose/gift): 2 = two-way conversation, 1 = one-sided, 0 = dead.
    sql`WITH m AS (
          SELECT LEAST(liker_id, liked_id) a, GREATEST(liker_id, liked_id) b, MIN(created_at) matched_at
          FROM likes WHERE is_match = true GROUP BY 1, 2
        ),
        pm AS (
          SELECT LEAST(sender_id, receiver_id) a, GREATEST(sender_id, receiver_id) b, COUNT(DISTINCT sender_id) senders
          FROM messages WHERE message_type IN ('user','one_time_service') GROUP BY 1, 2
        )
        SELECT
          COUNT(*) FILTER (WHERE m.matched_at >= ${p.start}::timestamptz AND m.matched_at < ${p.endEx}::timestamptz) AS matches,
          COUNT(*) FILTER (WHERE m.matched_at >= ${p.start}::timestamptz AND m.matched_at < ${p.endEx}::timestamptz AND pm.senders = 2) AS two_way,
          COUNT(*) FILTER (WHERE m.matched_at >= ${p.start}::timestamptz AND m.matched_at < ${p.endEx}::timestamptz AND pm.senders = 1) AS one_sided,
          COUNT(*) FILTER (WHERE m.matched_at >= ${p.start}::timestamptz AND m.matched_at < ${p.endEx}::timestamptz AND COALESCE(pm.senders,0) = 0) AS dead
        FROM m LEFT JOIN pm ON pm.a = m.a AND pm.b = m.b`,
    sql`SELECT '7d' AS cohort, COUNT(*) AS size,
          ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1) AS pct
        FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 7
        UNION ALL SELECT '14d', COUNT(*),
          ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1)
        FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 14
        UNION ALL SELECT '30d', COUNT(*),
          ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1)
        FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 30`,
    // Count likes and passes from the authoritative source-of-truth tables.
    // The daily_actions rollup only captures a fraction (one source, and only
    // since 2026-05-29), so it under-reports badly. `likes` holds every like
    // from any surface (swipe deck AND the "who liked you" page); `dislikes`
    // holds every pass.
    sql`SELECT
          (SELECT COUNT(*) FROM likes    WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz) AS likes,
          (SELECT COUNT(*) FROM likes    WHERE is_super_like AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz) AS super_likes,
          (SELECT COUNT(*) FROM dislikes WHERE created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz) AS passes`,
  ]);

  const matches = num(convo[0].matches);
  const twoWay = num(convo[0].two_way);
  const oneSided = num(convo[0].one_sided);
  const dead = num(convo[0].dead);
  const pctOf = (n: number) => (matches ? Math.round((1000 * n) / matches) / 10 : 0);
  const sw = swipes[0];
  const likes = num(sw.likes);
  const passes = num(sw.passes);
  const totalSwipes = likes + passes;
  return {
    period: meta(p),
    matchConvo: { matches, twoWay, oneSided, dead, twoWayPct: pctOf(twoWay), oneSidedPct: pctOf(oneSided), deadPct: pctOf(dead) },
    retention: retention.map((r) => ({ cohort: r.cohort as string, size: num(r.size), pct: num(r.pct) })),
    swipes: {
      swipes: totalSwipes,
      likes,
      superLikes: num(sw.super_likes),
      passes,
      likeRate: totalSwipes ? Math.round((1000 * likes) / totalSwipes) / 10 : 0,
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
/* ICEBREAKERS — preview generator for a post-match opener test        */
/* ------------------------------------------------------------------ */
const COUNTRY: Record<string, { name: string; adj: string; city: string; flag: string }> = {
  BA: { name: "Bosnia", adj: "Bosnian", city: "Sarajevo", flag: "🇧🇦" },
  RS: { name: "Serbia", adj: "Serbian", city: "Belgrade", flag: "🇷🇸" },
  HR: { name: "Croatia", adj: "Croatian", city: "Zagreb", flag: "🇭🇷" },
  MK: { name: "North Macedonia", adj: "Macedonian", city: "Skopje", flag: "🇲🇰" },
  AL: { name: "Albania", adj: "Albanian", city: "Tirana", flag: "🇦🇱" },
  ME: { name: "Montenegro", adj: "Montenegrin", city: "Podgorica", flag: "🇲🇪" },
  SI: { name: "Slovenia", adj: "Slovenian", city: "Ljubljana", flag: "🇸🇮" },
  XK: { name: "Kosovo", adj: "Kosovar", city: "Pristina", flag: "🇽🇰" },
  BG: { name: "Bulgaria", adj: "Bulgarian", city: "Sofia", flag: "🇧🇬" },
  GR: { name: "Greece", adj: "Greek", city: "Athens", flag: "🇬🇷" },
  RO: { name: "Romania", adj: "Romanian", city: "Bucharest", flag: "🇷🇴" },
};

const heritageLabel = (codes: string[] | null): string =>
  !codes || !codes.length ? "—" : codes.map((c) => (COUNTRY[c] ? `${COUNTRY[c].flag} ${COUNTRY[c].name}` : c)).join(", ");

function hashPair(a: string, b: string): number {
  const s = a + b;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length];

function makeIcebreaker(a: any, b: any): string {
  const seed = hashPair(a.id, b.id);
  const bn = (b.name || "").split(" ")[0] || "there";
  const aHer: string[] = a.heritage || [];
  const bHer: string[] = b.heritage || [];
  const shared = aHer.filter((x) => bHer.includes(x));

  if (shared.length && COUNTRY[shared[0]]) {
    const c = COUNTRY[shared[0]];
    return pick(
      [
        `Zdravo ${bn}! Two ${c.adj}s matching — that's basically destiny 😄 Is your family from ${c.city}, or somewhere else back home?`,
        `${bn}, fellow ${c.adj} here 🙌 When were you last back in ${c.name}? I'm long overdue for a trip.`,
        `Okay ${bn}, ${c.adj} roots on both sides ${c.flag} — settle a debate: whose baka makes the better food, yours or mine? 😅`,
      ],
      seed
    );
  }

  const aAdj = aHer.length && COUNTRY[aHer[0]] ? COUNTRY[aHer[0]].adj : null;
  const bAdj = bHer.length && COUNTRY[bHer[0]] ? COUNTRY[bHer[0]].adj : null;
  if (aAdj && bAdj) {
    return pick(
      [
        `${bn}, ${aAdj} meets ${bAdj} 😏 so we have to settle it — ćevapi or pljeskavica?`,
        `Zdravo ${bn}! Half the fun here is the friendly rivalry — ${aAdj} x ${bAdj}. What actually brought you to Balkanza?`,
        `Hey ${bn} 👋 ${bAdj} and proud? Tell me the one dish from home you'd never give up.`,
      ],
      seed
    );
  }

  if (a.residence && b.residence && a.residence === b.residence && a.residence !== "—") {
    return `Hey ${bn}! Both repping the diaspora in ${a.residence} 😄 found any good Balkan spots nearby, or are we both just missing home cooking?`;
  }
  return `Zdravo ${bn}! What made you join Balkanza — looking for someone who just *gets* the culture without you having to explain it?`;
}

export async function getIcebreakers() {
  const rows = await sql`
    WITH m AS (
      SELECT LEAST(liker_id, liked_id) a, GREATEST(liker_id, liked_id) b, MIN(created_at) matched_at
      FROM likes WHERE is_match = true GROUP BY 1, 2
    ),
    pm AS (
      SELECT LEAST(sender_id, receiver_id) a, GREATEST(sender_id, receiver_id) b, COUNT(DISTINCT sender_id) senders
      FROM messages WHERE message_type IN ('user','one_time_service') GROUP BY 1, 2
    )
    SELECT m.a, m.b, m.matched_at, COALESCE(pm.senders,0) AS senders,
      NULLIF(TRIM(COALESCE(ua.first_name,'') || ' ' || COALESCE(ua.last_name,'')), '') AS a_name, pa.gender AS a_gender,
      pa.heritage_countries AS a_her, COALESCE(NULLIF(pa.residence_country,''),'—') AS a_res,
      NULLIF(TRIM(COALESCE(ub.first_name,'') || ' ' || COALESCE(ub.last_name,'')), '') AS b_name, pb.gender AS b_gender,
      pb.heritage_countries AS b_her, COALESCE(NULLIF(pb.residence_country,''),'—') AS b_res
    FROM m
    LEFT JOIN pm ON pm.a = m.a AND pm.b = m.b
    JOIN users ua ON ua.id = m.a JOIN users ub ON ub.id = m.b
    JOIN profiles pa ON pa.user_id = m.a JOIN profiles pb ON pb.user_id = m.b
    WHERE COALESCE(pm.senders,0) < 2
      AND pa.heritage_countries IS NOT NULL AND cardinality(pa.heritage_countries) > 0
      AND pb.heritage_countries IS NOT NULL AND cardinality(pb.heritage_countries) > 0
    ORDER BY m.matched_at DESC
    LIMIT 100`;

  return {
    rows: rows.map((r) => {
      const a = { id: r.a as string, name: r.a_name as string | null, heritage: (r.a_her as string[]) || [], residence: r.a_res as string };
      const b = { id: r.b as string, name: r.b_name as string | null, heritage: (r.b_her as string[]) || [], residence: r.b_res as string };
      return {
        a: { ...a, heritageLabel: heritageLabel(a.heritage) },
        b: { ...b, heritageLabel: heritageLabel(b.heritage) },
        status: num(r.senders) === 1 ? "one-sided" : "dead",
        matchedAt: r.matched_at ? String(r.matched_at) : null,
        icebreaker: makeIcebreaker(a, b),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* BUYERS — users behind a revenue-by-service row                      */
/* ------------------------------------------------------------------ */
export async function getBuyers(params: PeriodInput, typeIn: unknown) {
  const p = resolvePeriod(params, [1, 7, 14, 30, 90], 30);
  const allowed = ["all", "Subscriptions", "Renewals", "Roses", "Super Likes", "Boosts"];
  const type = allowed.includes(String(typeIn)) ? String(typeIn) : "all";

  const rows = await sql`
    WITH txns AS (
      SELECT sp.user_id, CASE WHEN sp.rn = 1 THEN 'Subscriptions' ELSE 'Renewals' END AS type, sp.amount, sp.created_at
      FROM (SELECT user_id, amount, created_at, ROW_NUMBER() OVER (PARTITION BY subscription_id ORDER BY created_at) rn
            FROM subscription_payments WHERE status = 'succeeded') sp
      UNION ALL
      SELECT pu.user_id,
             CASE ots.service_type WHEN 'message' THEN 'Roses' WHEN 'super_like' THEN 'Super Likes'
                  WHEN 'profile_boost' THEN 'Boosts' ELSE ots.name END AS type, pu.amount, pu.created_at
      FROM purchases pu JOIN one_time_services ots ON ots.id = pu.service_id WHERE pu.payment_status = 'paid'
    )
    SELECT t.user_id AS id,
      NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS name, u.email,
      COUNT(*) AS txns, ROUND(SUM(t.amount)::numeric, 2) AS total, MAX(t.created_at) AS last_at,
      STRING_AGG(DISTINCT t.type, ', ' ORDER BY t.type) AS types
    FROM txns t JOIN users u ON u.id = t.user_id
    WHERE t.created_at >= ${p.start}::timestamptz AND t.created_at < ${p.endEx}::timestamptz
      AND (${type} = 'all' OR t.type = ${type})
    GROUP BY t.user_id, u.first_name, u.last_name, u.email
    ORDER BY total DESC NULLS LAST
    LIMIT 500`;

  return {
    period: meta(p),
    type,
    rows: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string | null,
      email: r.email as string | null,
      txns: num(r.txns),
      total: num(r.total),
      types: r.types as string,
      lastAt: r.last_at ? String(r.last_at) : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* CANCELLATIONS — churned subscribers with full engagement profile    */
/* ------------------------------------------------------------------ */
export async function getCancellations(params: PeriodInput, scopeIn: unknown) {
  const p = resolvePeriod(params, [1, 7, 30, 90], 30);

  // Which population: paid churn (default), only explicitly canceled, or all ended.
  const scope = ["paid", "canceled", "all"].includes(String(scopeIn)) ? String(scopeIn) : "paid";
  const statuses = scope === "canceled" ? ["canceled"] : ["canceled", "expired"];
  const requirePaid = scope === "paid";

  // The "churn date" is when the subscription ended — the explicit cancel
  // instant if present, else the end of the last paid period. The window
  // filters on that date so "last 7 days" means "churned in the last 7 days".
  const rows = await sql`
    WITH pay AS (
      SELECT subscription_id,
        COUNT(*) FILTER (WHERE status='succeeded') AS paid,
        MIN(processed_at) FILTER (WHERE status='succeeded') AS first_paid
      FROM subscription_payments GROUP BY 1
    ),
    months AS (
      SELECT subscription_id, STRING_AGG(to_char(mo,'Mon YYYY'), ', ' ORDER BY mo) AS pay_months
      FROM (SELECT DISTINCT subscription_id, date_trunc('month', processed_at) AS mo
            FROM subscription_payments WHERE status='succeeded') d
      GROUP BY subscription_id
    ),
    churned AS (
      SELECT DISTINCT ON (us.user_id)
        us.user_id, us.id AS sub_id, us.plan_id, us.status, us.amount,
        us.created_at AS started_at,
        COALESCE(us.canceled_at::timestamptz, us.current_period_end) AS ended_at,
        us.cancel_reason, COALESCE(p.paid,0) AS paid, mo.pay_months
      FROM user_subscriptions us
      LEFT JOIN pay p    ON p.subscription_id = us.id
      LEFT JOIN months mo ON mo.subscription_id = us.id
      WHERE us.status = ANY(${statuses})
        AND (${requirePaid} = false OR COALESCE(p.paid,0) >= 1)
        AND COALESCE(us.canceled_at::timestamptz, us.current_period_end) >= ${p.start}::timestamptz
        AND COALESCE(us.canceled_at::timestamptz, us.current_period_end) <  ${p.endEx}::timestamptz
      ORDER BY us.user_id, COALESCE(us.canceled_at::timestamptz, us.current_period_end) DESC
    ),
    ls AS (SELECT l.liker_id uid, COUNT(*) c, COUNT(*) FILTER (WHERE is_super_like) sc
           FROM likes l JOIN churned ch ON ch.user_id = l.liker_id GROUP BY 1),
    ds AS (SELECT d.disliker_id uid, COUNT(*) c
           FROM dislikes d JOIN churned ch ON ch.user_id = d.disliker_id GROUP BY 1),
    ms AS (SELECT mm.sender_id uid,
             COUNT(*) FILTER (WHERE message_type='user') msgs,
             COUNT(*) FILTER (WHERE message_type='one_time_service' AND one_time_service_id=1) roses
           FROM messages mm JOIN churned ch ON ch.user_id = mm.sender_id GROUP BY 1),
    bs AS (SELECT b.user_id uid, COUNT(*) c
           FROM profile_boosts b JOIN churned ch ON ch.user_id = b.user_id GROUP BY 1),
    mpairs AS (SELECT DISTINCT LEAST(liker_id,liked_id) a, GREATEST(liker_id,liked_id) b FROM likes WHERE is_match),
    cm AS (SELECT ch.user_id uid, COUNT(*) matches
           FROM churned ch JOIN mpairs mp ON ch.user_id IN (mp.a, mp.b) GROUP BY 1)
    SELECT c.user_id AS id,
      NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS name,
      u.email, pr.gender, u.last_active_at,
      c.status, c.amount, c.started_at, c.ended_at, c.cancel_reason, c.paid, c.pay_months,
      sp.display_name AS plan_name,
      COALESCE(ls.c,0) likes_sent, COALESCE(ls.sc,0) super_likes, COALESCE(ds.c,0) dislikes_sent,
      COALESCE(ms.msgs,0) msgs_sent, COALESCE(ms.roses,0) roses_sent, COALESCE(bs.c,0) boosts,
      COALESCE(cm.matches,0) matches
    FROM churned c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN profiles pr ON pr.user_id = c.user_id
    LEFT JOIN subscription_plans sp ON sp.id = c.plan_id
    LEFT JOIN ls ON ls.uid = c.user_id
    LEFT JOIN ds ON ds.uid = c.user_id
    LEFT JOIN ms ON ms.uid = c.user_id
    LEFT JOIN bs ON bs.uid = c.user_id
    LEFT JOIN cm ON cm.uid = c.user_id
    ORDER BY c.ended_at DESC NULLS LAST
    LIMIT 500`;

  const list = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string | null,
    email: r.email as string | null,
    gender: (r.gender as string | null) || "—",
    status: r.status as string,
    amount: num(r.amount),
    planName: (r.plan_name as string | null)?.trim() || "—",
    startedAt: r.started_at ? String(r.started_at) : null,
    endedAt: r.ended_at ? String(r.ended_at) : null,
    cancelReason: (r.cancel_reason as string | null)?.trim() || null,
    payments: num(r.paid),
    renewed: num(r.paid) >= 2,
    payMonths: (r.pay_months as string | null) || "—",
    lastActive: r.last_active_at ? String(r.last_active_at) : null,
    likesSent: num(r.likes_sent),
    superLikes: num(r.super_likes),
    dislikesSent: num(r.dislikes_sent),
    rosesSent: num(r.roses_sent),
    boosts: num(r.boosts),
    msgsSent: num(r.msgs_sent),
    matches: num(r.matches),
  }));

  const totals = {
    users: list.length,
    revenue: Math.round(list.reduce((a, r) => a + r.amount * Math.max(r.payments, 1), 0) * 100) / 100,
    renewed: list.filter((r) => r.renewed).length,
  };

  return { period: meta(p), scope, totals, rows: list };
}

/* ------------------------------------------------------------------ */
/* MATCHES — drill-down list behind the Engagement tiles               */
/* ------------------------------------------------------------------ */
export async function getMatches(params: PeriodInput, typeIn: unknown) {
  const p = resolvePeriod(params, [1, 7, 30, 90], 30);
  const allowed = ["all", "twoway", "oneside", "dead"];
  const type = allowed.includes(String(typeIn)) ? String(typeIn) : "all";

  const rows = await sql`
    WITH m AS (
      SELECT LEAST(liker_id, liked_id) AS a, GREATEST(liker_id, liked_id) AS b, MIN(created_at) AS matched_at
      FROM likes
      WHERE is_match = true AND created_at >= ${p.start}::timestamptz AND created_at < ${p.endEx}::timestamptz
      GROUP BY 1, 2
    ),
    msg AS (
      SELECT LEAST(sender_id, receiver_id) AS a, GREATEST(sender_id, receiver_id) AS b,
             COUNT(*) AS c, COUNT(DISTINCT sender_id) AS senders
      FROM messages WHERE message_type IN ('user','one_time_service') GROUP BY 1, 2
    )
    SELECT m.a, m.b, m.matched_at, COALESCE(msg.c,0) AS msgs, COALESCE(msg.senders,0) AS senders,
      NULLIF(TRIM(COALESCE(ua.first_name,'') || ' ' || COALESCE(ua.last_name,'')), '') AS a_name, ua.email AS a_email,
      NULLIF(TRIM(COALESCE(ub.first_name,'') || ' ' || COALESCE(ub.last_name,'')), '') AS b_name, ub.email AS b_email
    FROM m
    LEFT JOIN msg   ON msg.a = m.a AND msg.b = m.b
    JOIN users ua   ON ua.id = m.a
    JOIN users ub   ON ub.id = m.b
    WHERE (${type} = 'all'
        OR (${type} = 'twoway'  AND COALESCE(msg.senders,0) = 2)
        OR (${type} = 'oneside' AND COALESCE(msg.senders,0) = 1)
        OR (${type} = 'dead'    AND COALESCE(msg.senders,0) = 0))
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
      senders: num(r.senders),
      status: num(r.senders) === 2 ? "two-way" : num(r.senders) === 1 ? "one-sided" : "dead",
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
  const [retention, ttv, dead, push, ai] = await Promise.all([
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
    // Dead-match split: of all matches, how many had 0 / 1 / 2 people message (text or rose).
    sql`WITH matches AS (SELECT DISTINCT LEAST(liker_id,liked_id) a, GREATEST(liker_id,liked_id) b FROM likes WHERE is_match=true),
             pm AS (SELECT LEAST(sender_id,receiver_id) a, GREATEST(sender_id,receiver_id) b, COUNT(DISTINCT sender_id) senders FROM messages WHERE message_type IN ('user','one_time_service') GROUP BY 1,2)
        SELECT COALESCE(pm.senders,0) AS senders, COUNT(*) AS matches
        FROM matches m LEFT JOIN pm ON pm.a=m.a AND pm.b=m.b GROUP BY 1`,
    // Push reach: how many users could actually be re-engaged.
    sql`SELECT (SELECT COUNT(DISTINCT user_id) FROM push_notification_tokens) AS tokens,
               (SELECT COUNT(*) FROM users WHERE is_admin=false) AS users`,
    // AI Matchmaker intros: adoption + whether the receiver actually replied.
    sql`WITH ai AS (SELECT DISTINCT sender_id s, receiver_id r FROM messages WHERE message_type='AI')
        SELECT
          (SELECT COUNT(*) FROM messages WHERE message_type='AI') AS total_msgs,
          COUNT(*) AS pairs,
          COUNT(DISTINCT s) AS senders,
          COUNT(DISTINCT r) AS receivers,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM messages m2 WHERE m2.sender_id=ai.r AND m2.receiver_id=ai.s AND m2.message_type IN ('user','one_time_service'))) AS replied,
          (SELECT COUNT(*) FROM (SELECT DISTINCT LEAST(sender_id,receiver_id) a, GREATEST(sender_id,receiver_id) b FROM messages WHERE message_type='AI') aip
             WHERE EXISTS (SELECT 1 FROM likes l WHERE l.is_match AND LEAST(l.liker_id,l.liked_id)=aip.a AND GREATEST(l.liker_id,l.liked_id)=aip.b)) AS became_match
        FROM ai`,
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
    aiIntros: {
      totalMsgs: num(ai[0].total_msgs),
      pairs: num(ai[0].pairs),
      senders: num(ai[0].senders),
      receivers: num(ai[0].receivers),
      replied: num(ai[0].replied),
      becameMatch: num(ai[0].became_match),
      replyRate: num(ai[0].pairs) ? Math.round((1000 * num(ai[0].replied)) / num(ai[0].pairs)) / 10 : 0,
    },
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
