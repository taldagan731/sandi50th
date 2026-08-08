import type { ContributionReport } from "@/lib/studio/contribution-report";

export function ContributionReadinessReport({ report }: { report: ContributionReport }) {
  const thin = report.chapters.filter(chapter => chapter.thin);
  const totals = [
    ["Photographs", report.totals.photographs],
    ["Videos", report.totals.videos],
    ["Voice recordings", report.totals.voiceRecordings],
    ["Birthday messages", report.totals.birthdayMessages],
    ["Written memories", report.totals.writtenMemories],
    ["Q&A answers", report.totals.qaAnswers]
  ] as const;

  return (
    <section className="readinessReport" aria-labelledby="readiness-title">
      <header>
        <div>
          <span className="eyebrow">OWNER-ONLY READINESS REPORT</span>
          <h2 id="readiness-title">What has really arrived.</h2>
          <p>Automated records and anything marked excluded are omitted. A chapter is thin when it has two or fewer assigned story or media items.</p>
        </div>
        <p className={thin.length ? "readinessAlert" : "readinessReady"}>
          {thin.length ? `${thin.length} thin chapter${thin.length === 1 ? "" : "s"}` : "No chapter is thin"}
        </p>
      </header>
      <dl className="readinessTotals">
        {totals.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="chapterReadiness">
        {report.chapters.map(chapter => (
          <article className={chapter.thin ? "isThin" : ""} key={chapter.number}>
            <span>Chapter {chapter.number}</span>
            <h3>{chapter.title}</h3>
            <strong>{chapter.total} assigned item{chapter.total === 1 ? "" : "s"}</strong>
            <p>{chapter.photographs} photos · {chapter.videos} videos · {chapter.voiceRecordings} voices · {chapter.birthdayMessages} birthday · {chapter.writtenMemories} memories · {chapter.qaAnswers} Q&A</p>
          </article>
        ))}
      </div>
      <footer>
        <span>{report.excludedSubmissions} excluded/test contributions and {report.excludedFiles} files omitted</span>
        <span>{report.unassignedItems} real item{report.unassignedItems === 1 ? "" : "s"} still need a chapter</span>
      </footer>
    </section>
  );
}
