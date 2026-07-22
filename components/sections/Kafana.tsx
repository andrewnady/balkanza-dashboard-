"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt } from "../ui/primitives";
import { GroupedBars } from "../ui/charts";

const REACTION_EMOJI: Record<string, string> = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", sad: "😢", angry: "😠" };

function weekLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function Kafana() {
  const { data, error, loading } = useMetrics<any>("kafana", {});

  return (
    <section className="section" id="kafana">
      <SectionHead id="kafana-h" title="Kafana — community feed" desc="Adoption and health of the Kafana social feed: posts, comments, reactions and moderation. Live snapshot." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={110} />)}</div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Posts" value={data.totals.posts} sub={`${fmtInt(data.totals.posters)} unique posters${data.totals.postsDeleted ? ` · ${fmtInt(data.totals.postsDeleted)} deleted` : ""}`} format="int" />
            <StatTile label="Comments" value={data.totals.comments} sub={`${fmtInt(data.totals.commenters)} commenters · ${data.engagement.commentsPerPost}/post`} format="int" />
            <StatTile label="Reactions" value={data.totals.reactions} sub={`${fmtInt(data.totals.reactors)} reactors · ${data.engagement.reactionsPerPost}/post`} format="int" />
            <StatTile label="Reports" value={data.totals.postReports + data.totals.commentReports} sub={`${fmtInt(data.totals.postReports)} posts · ${fmtInt(data.totals.commentReports)} comments`} format="int" goodDirection="down" />
          </div>

          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">Daily activity · last 14 days</p>
              <p className="card-note">New posts and comments per day.</p>
              {data.daily.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No posts or comments yet.</p>
              ) : (
                <>
                  <GroupedBars
                    data={data.daily.map((d: any) => ({ label: weekLabel(d.date), posts: d.posts, comments: d.comments }))}
                    labelKey="label"
                    series={[
                      { key: "posts", name: "Posts", color: "#2563eb" },
                      { key: "comments", name: "Comments", color: "#7c4dff" },
                    ]}
                    height={240}
                  />
                  <div className="legend">
                    <span><span className="dot" style={{ background: "#2563eb" }} />Posts</span>
                    <span><span className="dot" style={{ background: "#7c4dff" }} />Comments</span>
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <p className="card-title">Reactions by type</p>
              <p className="card-note">Which reactions people use on posts &amp; comments.</p>
              {data.reactionBreakdown.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No reactions yet.</p>
              ) : (
                <div className="signal-chips">
                  {data.reactionBreakdown.map((r: any) => (
                    <div key={r.type} className="signal-chip">
                      <span className="signal-chip-n on">{fmtInt(r.n)}</span>
                      <span className="signal-chip-label">{REACTION_EMOJI[r.type] || ""} {r.type}</span>
                    </div>
                  ))}
                </div>
              )}
              {(data.totals.postsDeleted > 0 || data.totals.commentsDeleted > 0) && (
                <p className="card-note" style={{ marginTop: 12 }}>
                  Moderation: {fmtInt(data.totals.postsDeleted)} posts and {fmtInt(data.totals.commentsDeleted)} comments deleted.
                </p>
              )}
            </div>
          </div>

        </>
      )}
    </section>
  );
}
