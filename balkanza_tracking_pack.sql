-- =====================================================================
-- BALKANZA TRACKING QUERY PACK  (runnable)
-- Run from a machine that can reach the Neon read replica:
--
--   PGPASSWORD='#3&DIIFQfa$sc*av' \
--   psql "host=ep-sweet-salad-aee19c0f-pooler.c-2.us-east-2.aws.neon.tech \
--         port=5432 user=readonly_user dbname=neondb sslmode=require" \
--         -f balkanza_tracking_pack.sql > balkanza_results.txt 2>&1
--
-- Then paste balkanza_results.txt back into the chat and I'll explain
-- each numbered result in a few lines.
--
-- Read-only. Safe to run against the read replica / readonly_user.
-- =====================================================================
\pset pager off
\timing off

\echo '===== 1.1 New registrations (today / yesterday / 7d / 30d) ====='
SELECT
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)                 AS signups_today,
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE - 1)             AS signups_yesterday,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')  AS signups_last_7d,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS signups_last_30d
FROM users
WHERE is_admin = false;

\echo ''
\echo '===== 1.2 Registration source mix (last 7 days) ====='
SELECT register_source, COUNT(*) AS signups
FROM users
WHERE is_admin = false
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY register_source
ORDER BY signups DESC;

\echo ''
\echo '===== 1.3 Active users DAU / WAU / MAU ====='
SELECT
  COUNT(*) FILTER (WHERE last_active_at::date = CURRENT_DATE)                 AS dau,
  COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '7 days')  AS wau,
  COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '30 days') AS mau
FROM users
WHERE is_admin = false AND is_disabled = false;

\echo ''
\echo '===== 1.4 New-user activation (last 7 completed days cohort) ====='
WITH cohort AS (
  SELECT u.id, u.created_at
  FROM users u
  WHERE u.is_admin = false
    AND u.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND u.created_at <  CURRENT_DATE
)
SELECT
  COUNT(*)                                                                              AS cohort_size,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.is_complete) / NULLIF(COUNT(*),0), 1)          AS pct_profile_complete,
  ROUND(AVG(first24.likes_sent), 2)                                                     AS avg_likes_first_24h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE first24.likes_sent > 0) / NULLIF(COUNT(*),0), 1) AS pct_who_liked_in_24h
FROM cohort c
LEFT JOIN profiles p ON p.user_id = c.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS likes_sent
  FROM likes l
  WHERE l.liker_id = c.id
    AND l.created_at <= c.created_at + INTERVAL '24 hours'
) first24 ON true;

\echo ''
\echo '===== 1.5 Revenue today / 7d / 30d (paid one-time purchases) ====='
SELECT
  COALESCE(SUM(amount) FILTER (WHERE created_at::date = CURRENT_DATE), 0)               AS revenue_today,
  COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),0) AS revenue_7d,
  COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),0) AS revenue_30d,
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND payment_status = 'paid')   AS paid_purchases_today
FROM purchases
WHERE payment_status = 'paid';

\echo ''
\echo '===== 1.6 Active subscribers + new subs / cancellations today ====='
SELECT
  COUNT(*) FILTER (WHERE status = 'active')                                    AS active_subscriptions,
  COUNT(*) FILTER (WHERE status = 'active' AND created_at::date = CURRENT_DATE) AS new_subs_today,
  COUNT(*) FILTER (WHERE canceled_at::date = CURRENT_DATE)                      AS cancellations_today
FROM user_subscriptions;

\echo ''
\echo '===== 1.7 New mutual matches today / 7d ====='
SELECT
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)                AS matches_today,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS matches_7d
FROM likes
WHERE is_match = true;

\echo ''
\echo '===== 2.1 Funnel by 30d cohort (distinct users per stage) ====='
WITH cohort AS (
  SELECT id FROM users
  WHERE is_admin = false AND created_at >= CURRENT_DATE - INTERVAL '30 days'
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
LEFT JOIN messages msg ON msg.sender_id = c.id AND msg.message_type = 'user';

\echo ''
\echo '===== 2.2 Match -> conversation rate (30d) ====='
WITH recent_matches AS (
  SELECT liker_id, liked_id FROM likes
  WHERE is_match = true AND created_at >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT
  COUNT(*)                                                                          AS matches_30d,
  COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM messages msg
      WHERE msg.message_type = 'user'
        AND ((msg.sender_id = rm.liker_id AND msg.receiver_id = rm.liked_id)
          OR (msg.sender_id = rm.liked_id AND msg.receiver_id = rm.liker_id))
  ))                                                                                AS matches_with_a_message,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM messages msg
      WHERE msg.message_type = 'user'
        AND ((msg.sender_id = rm.liker_id AND msg.receiver_id = rm.liked_id)
          OR (msg.sender_id = rm.liked_id AND msg.receiver_id = rm.liker_id))
  )) / NULLIF(COUNT(*),0), 1)                                                       AS pct_matches_that_talked
FROM recent_matches rm;

\echo ''
\echo '===== 2.3 Gender balance (complete profiles) ====='
SELECT
  p.gender,
  COUNT(*) AS users,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM profiles p
JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
WHERE p.is_complete = true
GROUP BY p.gender
ORDER BY users DESC;

\echo ''
\echo '===== 2.4 Liquidity by segment (heritage x residence, >=5) ====='
SELECT
  p.heritage_country,
  p.residence_country,
  COUNT(*)                                    AS users,
  COUNT(*) FILTER (WHERE p.gender = 'male')   AS men,
  COUNT(*) FILTER (WHERE p.gender = 'female') AS women
FROM profiles p
JOIN users u ON u.id = p.user_id AND u.is_admin = false AND u.is_disabled = false
WHERE p.is_complete = true
GROUP BY p.heritage_country, p.residence_country
HAVING COUNT(*) >= 5
ORDER BY users DESC;

\echo ''
\echo '===== 2.5 Retention (7 / 14 / 30d cohorts active in last 3d) ====='
SELECT
  '7d ago cohort'  AS cohort,
  COUNT(*)         AS size,
  ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1) AS pct_recently_active
FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 7
UNION ALL
SELECT '14d ago cohort', COUNT(*),
  ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1)
FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 14
UNION ALL
SELECT '30d ago cohort', COUNT(*),
  ROUND(100.0 * COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE - INTERVAL '3 days') / NULLIF(COUNT(*),0),1)
FROM users WHERE is_admin=false AND created_at::date = CURRENT_DATE - 30;

\echo ''
\echo '===== 2.6 Swipe behavior volume (last 7 days) ====='
SELECT
  SUM(swipes_count) AS total_swipes,
  SUM(likes_count)  AS total_likes,
  SUM(passes_count) AS total_passes,
  ROUND(100.0 * SUM(likes_count) / NULLIF(SUM(swipes_count),0), 1) AS like_rate_pct
FROM daily_actions
WHERE action_date >= CURRENT_DATE - INTERVAL '7 days';

\echo ''
\echo '===== 2.7 Profile completion trend (last 14 reg days) ====='
SELECT
  u.created_at::date AS reg_date,
  COUNT(*)           AS registered,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.is_complete) / NULLIF(COUNT(*),0), 1) AS pct_complete
FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.is_admin = false AND u.created_at >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY u.created_at::date
ORDER BY reg_date DESC;

\echo ''
\echo '===== 3.1 Free -> paid conversion rate ====='
SELECT
  COUNT(*) FILTER (WHERE u.is_admin=false)                                                        AS total_users,
  COUNT(DISTINCT s.user_id)                                                                       AS users_with_active_sub,
  ROUND(100.0 * COUNT(DISTINCT s.user_id) / NULLIF(COUNT(*) FILTER (WHERE u.is_admin=false),0),2) AS conversion_pct
FROM users u
LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active';

\echo ''
\echo '===== 3.2 Revenue by one-time service type (30d) ====='
SELECT
  ots.name         AS service,
  ots.service_type,
  COUNT(*)         AS purchases,
  SUM(pu.amount)   AS revenue,
  SUM(pu.quantity) AS units_sold
FROM purchases pu
JOIN one_time_services ots ON ots.id = pu.service_id
WHERE pu.payment_status = 'paid'
  AND pu.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ots.name, ots.service_type
ORDER BY revenue DESC NULLS LAST;

\echo ''
\echo '===== 3.3 Subscription plan distribution ====='
SELECT
  sp.display_name,
  sp.price,
  sp.duration,
  COUNT(*) FILTER (WHERE us.status = 'active') AS active_subs
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
GROUP BY sp.display_name, sp.price, sp.duration
ORDER BY active_subs DESC;

\echo ''
\echo '===== 3.4 Failed payments / churn risk (30d) ====='
SELECT
  COUNT(*)                                                                     AS total_sub_payments,
  COUNT(*) FILTER (WHERE status = 'paid')                                      AS succeeded,
  COUNT(*) FILTER (WHERE status <> 'paid')                                     AS failed_or_other,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status<>'paid') / NULLIF(COUNT(*),0),1) AS fail_rate_pct
FROM subscription_payments
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

\echo ''
\echo '===== 3.5 Cancellation reasons (90d) ====='
SELECT cancel_reason, COUNT(*) AS cancellations
FROM user_subscriptions
WHERE canceled_at >= CURRENT_DATE - INTERVAL '90 days'
  AND cancel_reason IS NOT NULL
GROUP BY cancel_reason
ORDER BY cancellations DESC;

\echo ''
\echo '===== 3.6 Offer performance (impressions -> claims) ====='
SELECT
  o.name,
  COUNT(*)                                                                          AS impressions,
  COUNT(*) FILTER (WHERE uoi.status = 'claimed')                                    AS claimed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE uoi.status='claimed') / NULLIF(COUNT(*),0),1) AS claim_rate_pct
FROM user_offer_impressions uoi
JOIN offers o ON o.id = uoi.offer_id
GROUP BY o.name
ORDER BY impressions DESC;

\echo ''
\echo '===== 4.1 Fake/spam signal: bios with contact info (limit 100) ====='
SELECT u.id, u.email, u.created_at, p.bio
FROM profiles p
JOIN users u ON u.id = p.user_id AND u.is_disabled = false
WHERE p.bio ~* '(whats\s?app|telegram|viber|instagram|snapchat|@[a-z0-9_]+|\+?\d[\d \-]{7,}\d)'
ORDER BY u.created_at DESC
LIMIT 100;

\echo ''
\echo '===== 4.2 Duplicate bios (bot/farm signal, limit 50) ====='
SELECT p.bio, COUNT(*) AS num_profiles, ARRAY_AGG(u.email) AS accounts
FROM profiles p
JOIN users u ON u.id = p.user_id AND u.is_disabled = false
WHERE p.bio IS NOT NULL AND LENGTH(TRIM(p.bio)) > 15
GROUP BY p.bio
HAVING COUNT(*) > 1
ORDER BY num_profiles DESC
LIMIT 50;

\echo ''
\echo '===== 4.3 Multiple accounts per IP (>=3, limit 50) ====='
SELECT il.ip_address, COUNT(DISTINCT il.user_id) AS num_accounts
FROM ip_logs il
GROUP BY il.ip_address
HAVING COUNT(DISTINCT il.user_id) >= 3
ORDER BY num_accounts DESC
LIMIT 50;

\echo ''
\echo '===== 4.4 Open moderation queue (pending reports by category) ====='
SELECT category, COUNT(*) AS pending_reports
FROM profile_reports
WHERE status = 'pending'
GROUP BY category
ORDER BY pending_reports DESC;

\echo ''
\echo '===== 4.5 Report volume trend (last 14 days) ====='
SELECT created_at::date AS day, COUNT(*) AS reports
FROM profile_reports
WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY created_at::date
ORDER BY day DESC;

\echo ''
\echo '===== 4.6 Data quality: missing critical fields on complete profiles ====='
SELECT
  COUNT(*)                                              AS complete_profiles,
  COUNT(*) FILTER (WHERE gender IS NULL OR gender = '') AS missing_gender,
  COUNT(*) FILTER (WHERE heritage_country IS NULL)      AS missing_heritage,
  COUNT(*) FILTER (WHERE residence_country IS NULL)     AS missing_residence,
  COUNT(*) FILTER (WHERE birthdate IS NULL)             AS missing_birthdate
FROM profiles
WHERE is_complete = true;

\echo ''
\echo '===== 4.7 Complete profiles with zero photos ====='
SELECT COUNT(*) AS complete_profiles_with_no_photo
FROM profiles p
WHERE p.is_complete = true
  AND NOT EXISTS (SELECT 1 FROM profile_photos pp WHERE pp.profile_id = p.id);

\echo ''
\echo '===== 4.8 Verification funnel ====='
SELECT verification_status, COUNT(*) AS users
FROM users
WHERE is_admin = false
GROUP BY verification_status
ORDER BY users DESC;

\echo ''
\echo '===== 5.1 AI Tetka: AI matches -> chats (30d) ====='
SELECT
  COUNT(*)                                                                     AS ai_matches_30d,
  COUNT(*) FILTER (WHERE chat_initiated)                                       AS led_to_chat,
  ROUND(100.0 * COUNT(*) FILTER (WHERE chat_initiated) / NULLIF(COUNT(*),0),1) AS pct_chat_initiated,
  ROUND(AVG(compatibility_score),1)                                           AS avg_compat_score
FROM ai_match_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

\echo ''
\echo '===== 5.2 Boost effectiveness (30d) ====='
SELECT
  COUNT(DISTINCT pb.id)                        AS boosts_used_30d,
  COUNT(l.id) FILTER (WHERE l.is_match)        AS matches_during_boosts
FROM profile_boosts pb
LEFT JOIN likes l ON l.boost_id = pb.id
WHERE pb.started_at >= CURRENT_DATE - INTERVAL '30 days';

\echo ''
\echo '===== 5.3 Super like effectiveness (30d) ====='
SELECT
  is_super_like,
  COUNT(*)                                                              AS total,
  COUNT(*) FILTER (WHERE is_match)                                      AS became_match,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_match) / NULLIF(COUNT(*),0),1) AS match_rate_pct
FROM likes
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY is_super_like;

\echo ''
\echo '===== 5.4 Free consumable inventory sitting unused ====='
SELECT
  ots.name,
  SUM(ui.remaining_free_amount)      AS total_free_remaining,
  SUM(ui.remaining_purchased_amount) AS total_purchased_remaining
FROM users_inventory ui
JOIN one_time_services ots ON ots.id = ui.service_id
GROUP BY ots.name
ORDER BY total_free_remaining DESC;

\echo ''
\echo '===== END OF PACK ====='
