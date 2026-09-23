import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import { sql } from "../api/sql";

type RatingRow = {
  rating: number;
  time: string;
};

const ratingMeta: Record<number, { emoji: string; color: string; label: string }> = {
  1: { emoji: "😭", color: "#4C6FA5", label: "Velmi smutny" },
  2: { emoji: "🙁", color: "#6E93A0", label: "Smutny" },
  3: { emoji: "😐", color: "#9CA68C", label: "Neutralni" },
  4: { emoji: "🙂", color: "#D9AD5C", label: "Usmevavy" },
  5: { emoji: "😄", color: "#E38350", label: "Velmi stastny" },
};

// Rozvrh hodin - casy zvoneni. Uprav, pokud se u vas lisi.
const lessonPeriods = [
  { period: 1, start: "08:00", end: "08:45" },
  { period: 2, start: "08:50", end: "09:35" },
  { period: 3, start: "09:55", end: "10:40" },
  { period: 4, start: "10:50", end: "11:35" },
  { period: 5, start: "11:40", end: "12:25" },
  { period: 6, start: "12:35", end: "13:20" },
  { period: 7, start: "13:25", end: "14:10" },
  { period: 8, start: "14:15", end: "15:00" },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Najde hodinu, do ktere hodnoceni casove patri.
// Nejdriv zkusi, jestli cas spada primo dovnitr nejake hodiny (hodnoceni
// behem vyuky), pak teprve reseni pro prestavku (priradi k prave skoncene
// hodine).
function findLessonPeriod(time: string): number | null {
  const date = new Date(time);
  if (isNaN(date.getTime())) return null;

  const minutes = date.getHours() * 60 + date.getMinutes();

  for (const lesson of lessonPeriods) {
    if (minutes >= toMinutes(lesson.start) && minutes <= toMinutes(lesson.end)) {
      return lesson.period;
    }
  }

  let best: number | null = null;
  let bestEnd = -Infinity;
  for (const lesson of lessonPeriods) {
    const endMinutes = toMinutes(lesson.end);
    if (endMinutes <= minutes && endMinutes > bestEnd) {
      bestEnd = endMinutes;
      best = lesson.period;
    }
  }

  return best;
}

// Stály rozvrh: den (1=Po..5=Pa) -> hodina -> predmet na lichy/sudy tyden.
// Preneseno ze screenshotu "Staly" - zkontroluj prosim, jestli sedi,
// nez tomu zacnes verit naplno.
type ScheduleEntry = { L?: string; S?: string };
const schedule: Record<number, Record<number, ScheduleEntry>> = {
  1: {
    // Pondeli
    1: { L: "NEM", S: "NEM" },
    2: { L: "NEM", S: "NEM" },
    3: { L: "ANG", S: "CJL" },
    4: { L: "ANG", S: "MAT" },
    5: { S: "WAP" },
    6: { L: "EKA", S: "WAP" },
    7: { L: "TEV" },
    8: { L: "TEV" },
  },
  2: {
    // Utery
    1: { L: "POS", S: "CJL" },
    2: { L: "POS", S: "EKA" },
    3: { L: "POS", S: "CJL" },
    4: { L: "ANG", S: "CJL" },
    5: { L: "ANG", S: "MAM" },
    7: { L: "PRA", S: "PRA" },
    8: { L: "PRA", S: "PRA" },
  },
  3: {
    // Streda
    1: { L: "CJL", S: "ANG" },
    2: { L: "EKA", S: "ANG" },
    3: { L: "ANG", S: "TEV" },
    4: { L: "ANG", S: "TEV" },
    5: { L: "MAM", S: "POS" },
    7: { L: "WAP", S: "MAT" },
    8: { L: "WAP" },
  },
  4: {
    // Ctvrtek
    1: { L: "CJL", S: "KSW" },
    2: { L: "OBN", S: "KSW" },
    3: { L: "INS", S: "CJL" },
    4: { L: "MAT", S: "OBN" },
    5: { L: "KSW", S: "EKA" },
    6: { L: "KSW", S: "TH" },
  },
  5: {
    // Patek
    1: { L: "DGR", S: "MUL" },
    2: { L: "DGR", S: "MUL" },
    3: { L: "MUL", S: "CJL" },
    4: { L: "MUL", S: "NEM" },
    5: { L: "MAT", S: "NEM" },
    6: { L: "MAT", S: "POS" },
    7: { L: "POS", S: "INS" },
  },
};

// Pokud vychazi lichy/sudy tyden u vas obracene, preved na true.
const PARITY_INVERTED = false;

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function weekParity(date: Date): "L" | "S" {
  const isOdd = isoWeekNumber(date) % 2 === 1;
  const finalOdd = PARITY_INVERTED ? !isOdd : isOdd;
  return finalOdd ? "L" : "S";
}

// Najde predmet pro dany radek hodnoceni podle dne, hodiny a parity tydne.
function findSubject(row: RatingRow): string | null {
  const date = new Date(row.time);
  if (isNaN(date.getTime())) return null;

  const jsDay = date.getDay(); // 0=Ne, 1=Po ... 6=So
  if (jsDay < 1 || jsDay > 5) return null; // vikend - mimo rozvrh

  const period = findLessonPeriod(row.time);
  if (period === null) return null;

  const entry = schedule[jsDay]?.[period];
  if (!entry) return null;

  const parity = weekParity(date);
  return entry[parity] ?? null;
}

const allSubjects = Array.from(
  new Set(
    Object.values(schedule).flatMap((day) =>
      Object.values(day).flatMap((entry) => [entry.L, entry.S].filter(Boolean) as string[])
    )
  )
).sort();

function extractRows(result: any): RatingRow[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.result)) return result.result;
  return [];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function modes(values: number[]): number[] {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const max = Math.max(...Object.values(counts));
  return Object.keys(counts)
    .filter((k) => counts[Number(k)] === max)
    .map(Number)
    .sort((a, b) => a - b);
}

export default function Statistika() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await sql(
        "SELECT rating, `time` FROM `1_Opakování` ORDER BY `time` ASC"
      );
      const data = extractRows(result);

      if (data.length === 0 && result == null) {
        setError("Nepodarilo se nacist data z databaze.");
      }

      setRows(data);
      setLoading(false);
    };

    load();
  }, []);

  const values = rows.map((r) => Number(r.rating));
  const count = values.length;
  const average = count > 0 ? values.reduce((s, v) => s + v, 0) / count : null;
  const med = count > 0 ? median(values) : null;
  const mods = count > 0 ? modes(values) : [];

  const histogram = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    total: values.filter((v) => v === r).length,
  }));
  const maxCount = Math.max(1, ...histogram.map((h) => h.total));

  // L3: rozdeleni podle konce hodiny
  const byPeriod: Record<number, number[]> = {};
  rows.forEach((row) => {
    const period = findLessonPeriod(row.time);
    if (period === null) return;
    if (!byPeriod[period]) byPeriod[period] = [];
    byPeriod[period].push(Number(row.rating));
  });

  const periodStats = lessonPeriods
    .map((lesson) => {
      const periodValues = byPeriod[lesson.period] ?? [];
      const periodAverage =
        periodValues.length > 0
          ? periodValues.reduce((s, v) => s + v, 0) / periodValues.length
          : null;
      return { ...lesson, values: periodValues, average: periodAverage };
    })
    .filter((p) => p.values.length > 0);

  // L4: filtr podle predmetu
  const subjectRows = selectedSubject
    ? rows.filter((row) => findSubject(row) === selectedSubject)
    : [];
  const subjectValues = subjectRows.map((r) => Number(r.rating));
  const subjectAverage =
    subjectValues.length > 0
      ? subjectValues.reduce((s, v) => s + v, 0) / subjectValues.length
      : null;

  // Virtualni rozvrh: prumer hodnoceni pro kazdy konkretni blok (den+hodina+parita)
  const slotValues: Record<string, number[]> = {};
  rows.forEach((row) => {
    const date = new Date(row.time);
    if (isNaN(date.getTime())) return;
    const jsDay = date.getDay();
    if (jsDay < 1 || jsDay > 5) return;
    const period = findLessonPeriod(row.time);
    if (period === null) return;
    const parity = weekParity(date);
    const key = `${jsDay}-${period}-${parity}`;
    if (!slotValues[key]) slotValues[key] = [];
    slotValues[key].push(Number(row.rating));
  });

  function getSlotAverage(day: number, period: number, parity: "L" | "S") {
    const vals = slotValues[`${day}-${period}-${parity}`] ?? [];
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  const dayNames: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá" };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap"
      />
      <style>{`
        .stat-page {
          min-height: 100vh;
          background: #EEF2ED;
          padding: 48px 24px 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(32px, 6vh, 56px);
        }
        .stat-back {
          align-self: flex-start;
          max-width: 720px;
          width: 100%;
          margin: 0 auto;
          font-family: system-ui, sans-serif;
          font-size: 14px;
          color: #5C6B60;
          text-decoration: none;
          border-bottom: 1px solid transparent;
        }
        .stat-back:hover { color: #1F2D22; border-color: #1F2D22; }
        .stat-heading {
          font-family: "Fraunces", Georgia, serif;
          font-weight: 600;
          font-size: clamp(26px, 4.5vw, 42px);
          color: #1F2D22;
          margin: 0;
          text-align: center;
        }
        .stat-section {
          width: 100%;
          max-width: 720px;
        }
        .stat-section h2 {
          font-family: system-ui, sans-serif;
          font-size: 13px;
          letter-spacing: 0.02em;
          color: #5C6B60;
          margin: 0 0 16px;
          font-weight: 600;
        }
        .stat-tiles {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .stat-tile {
          flex: 1;
          min-width: 140px;
          background: #FFFFFF;
          border-radius: 16px;
          padding: 22px 20px;
          text-align: center;
        }
        .stat-tile .value {
          font-family: "Fraunces", Georgia, serif;
          font-size: 34px;
          color: #1F2D22;
          font-weight: 600;
        }
        .stat-tile .label {
          font-family: system-ui, sans-serif;
          font-size: 13px;
          color: #5C6B60;
          margin-top: 4px;
        }
        .stat-histogram {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          height: 180px;
          padding: 20px 0 0;
        }
        .stat-bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
        }
        .stat-bar {
          width: 100%;
          border-radius: 8px 8px 0 0;
          transition: height 0.25s ease;
        }
        .stat-bar-count {
          font-family: system-ui, sans-serif;
          font-size: 13px;
          color: #1F2D22;
          margin-bottom: 4px;
        }
        .stat-bar-emoji {
          font-size: 22px;
          margin-top: 8px;
        }
        .stat-empty, .stat-loading, .stat-error {
          font-family: system-ui, sans-serif;
          color: #5C6B60;
          text-align: center;
        }
        .stat-error { color: #B5533F; }
        .stat-period-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .stat-period-row {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #FFFFFF;
          border-radius: 12px;
          padding: 12px 18px;
        }
        .stat-period-num {
          font-family: "Fraunces", Georgia, serif;
          font-weight: 600;
          font-size: 18px;
          color: #1F2D22;
          min-width: 26px;
        }
        .stat-period-time {
          font-family: system-ui, sans-serif;
          font-size: 13px;
          color: #5C6B60;
          min-width: 100px;
        }
        .stat-period-bar-track {
          flex: 1;
          height: 8px;
          background: #E3E9E0;
          border-radius: 999px;
          overflow: hidden;
        }
        .stat-period-bar-fill {
          height: 100%;
          border-radius: 999px;
        }
        .stat-period-avg {
          font-family: system-ui, sans-serif;
          font-size: 14px;
          color: #1F2D22;
          min-width: 70px;
          text-align: right;
        }
        .stat-select {
          font-family: system-ui, sans-serif;
          font-size: 15px;
          color: #1F2D22;
          background: #FFFFFF;
          border: 1px solid #DDE3DA;
          border-radius: 10px;
          padding: 10px 14px;
          width: 100%;
        }
        .stat-note {
          font-family: system-ui, sans-serif;
          font-size: 12px;
          color: #8B968D;
          margin-top: 8px;
        }
        .stat-section-wide {
          width: 100%;
          max-width: 900px;
        }
        .stat-timetable-scroll {
          overflow-x: auto;
        }
        .stat-timetable {
          display: grid;
          grid-template-columns: 44px repeat(8, minmax(76px, 1fr));
          gap: 6px;
          min-width: 700px;
        }
        .stat-tt-head {
          font-family: system-ui, sans-serif;
          font-size: 11px;
          color: #8B968D;
          text-align: center;
          padding-bottom: 4px;
        }
        .stat-tt-day {
          font-family: "Fraunces", Georgia, serif;
          font-weight: 600;
          font-size: 15px;
          color: #1F2D22;
          display: flex;
          align-items: center;
        }
        .stat-tt-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-height: 44px;
          justify-content: center;
        }
        .stat-tt-block {
          border-radius: 8px;
          padding: 4px 6px;
          text-align: center;
          background: #E3E9E0;
        }
        .stat-tt-subject {
          font-family: system-ui, sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #1F2D22;
        }
        .stat-tt-avg {
          font-family: system-ui, sans-serif;
          font-size: 11px;
          color: #3A473C;
        }
        .stat-pending {
          font-family: system-ui, sans-serif;
          font-size: 14px;
          color: #8B968D;
          text-align: center;
          border-top: 1px solid #DDE3DA;
          padding-top: 24px;
        }
      `}</style>

      <div className="stat-page">
        <Link to="/" className="stat-back">
          ← Zpet
        </Link>

        <h1 className="stat-heading">Statistika nalady tridy</h1>

        {loading && <p className="stat-loading">Nacitam data...</p>}
        {error && <p className="stat-error">{error}</p>}
        {!loading && !error && count === 0 && (
          <p className="stat-empty">Zatim zadna hodnoceni.</p>
        )}

        {!loading && !error && count > 0 && (
          <>
            <section className="stat-section">
              <h2>Zakladni prehled</h2>
              <div className="stat-tiles">
                <div className="stat-tile">
                  <div className="value">{average!.toFixed(2)}</div>
                  <div className="label">Prumer (z 5)</div>
                </div>
                <div className="stat-tile">
                  <div className="value">{count}</div>
                  <div className="label">Pocet hodnoceni</div>
                </div>
              </div>
            </section>

            <section className="stat-section">
              <h2>Rozlozeni hodnoceni</h2>
              <div className="stat-histogram">
                {histogram.map((h) => {
                  const meta = ratingMeta[h.rating];
                  const heightPercent = (h.total / maxCount) * 100;
                  return (
                    <div className="stat-bar-col" key={h.rating}>
                      <div className="stat-bar-count">{h.total}</div>
                      <div
                        className="stat-bar"
                        style={{
                          height: `${Math.max(heightPercent, h.total > 0 ? 6 : 2)}%`,
                          background: meta.color,
                        }}
                      />
                      <div className="stat-bar-emoji">{meta.emoji}</div>
                    </div>
                  );
                })}
              </div>

              <div className="stat-tiles" style={{ marginTop: "24px" }}>
                <div className="stat-tile">
                  <div className="value">{med}</div>
                  <div className="label">Median</div>
                </div>
                <div className="stat-tile">
                  <div className="value">
                    {mods.map((m) => ratingMeta[m].emoji).join(" ")}
                  </div>
                  <div className="label">
                    Modus ({mods.join(", ")})
                  </div>
                </div>
              </div>
            </section>

            {periodStats.length > 0 && (
              <section className="stat-section">
                <h2>Podle konce hodiny</h2>
                <div className="stat-period-list">
                  {periodStats.map((p) => (
                    <div className="stat-period-row" key={p.period}>
                      <div className="stat-period-num">{p.period}.</div>
                      <div className="stat-period-time">
                        do {p.end} ({p.values.length}x)
                      </div>
                      <div className="stat-period-bar-track">
                        <div
                          className="stat-period-bar-fill"
                          style={{
                            width: `${(p.average! / 5) * 100}%`,
                            background: ratingMeta[Math.round(p.average!)].color,
                          }}
                        />
                      </div>
                      <div className="stat-period-avg">
                        {ratingMeta[Math.round(p.average!)].emoji}{" "}
                        {p.average!.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="stat-section-wide">
              <h2 style={{ textAlign: "center", fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#5C6B60", marginBottom: "16px" }}>
                Virtuální rozvrh
              </h2>
              <div className="stat-timetable-scroll">
                <div className="stat-timetable">
                  <div className="stat-tt-head"></div>
                  {lessonPeriods.map((p) => (
                    <div className="stat-tt-head" key={p.period}>
                      {p.period}. <br /> {p.start}–{p.end}
                    </div>
                  ))}

                  {[1, 2, 3, 4, 5].map((day) => (
                    <Fragment key={day}>
                      <div className="stat-tt-day">
                        {dayNames[day]}
                      </div>
                      {lessonPeriods.map((p) => {
                        const entry = schedule[day]?.[p.period];
                        return (
                          <div className="stat-tt-cell" key={`${day}-${p.period}`}>
                            {entry?.L &&
                              (() => {
                                const avg = getSlotAverage(day, p.period, "L");
                                return (
                                  <div
                                    className="stat-tt-block"
                                    style={{
                                      background: avg
                                        ? ratingMeta[Math.round(avg)].color
                                        : "#E3E9E0",
                                    }}
                                  >
                                    <div className="stat-tt-subject">{entry.L}</div>
                                    <div className="stat-tt-avg">
                                      {avg ? avg.toFixed(1) : "–"}
                                    </div>
                                  </div>
                                );
                              })()}
                            {entry?.S &&
                              (() => {
                                const avg = getSlotAverage(day, p.period, "S");
                                return (
                                  <div
                                    className="stat-tt-block"
                                    style={{
                                      background: avg
                                        ? ratingMeta[Math.round(avg)].color
                                        : "#E3E9E0",
                                    }}
                                  >
                                    <div className="stat-tt-subject">{entry.S}</div>
                                    <div className="stat-tt-avg">
                                      {avg ? avg.toFixed(1) : "–"}
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
              <p className="stat-note" style={{ textAlign: "center" }}>
                Horní blok = lichý týden, spodní = sudý (pokud se pro dané
                okenko lisi). Cislo pod predmetem je prumer hodnoceni.
              </p>
            </section>

            <section className="stat-section">
              <h2>Podle predmetu</h2>
              <select
                className="stat-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">Vyber predmet...</option>
                {allSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>

              {selectedSubject && (
                <>
                  {subjectValues.length === 0 ? (
                    <p className="stat-empty" style={{ marginTop: "16px" }}>
                      Pro {selectedSubject} zatim zadna hodnoceni.
                    </p>
                  ) : (
                    <div className="stat-tiles" style={{ marginTop: "16px" }}>
                      <div className="stat-tile">
                        <div className="value">
                          {ratingMeta[Math.round(subjectAverage!)].emoji}{" "}
                          {subjectAverage!.toFixed(2)}
                        </div>
                        <div className="label">Prumer pro {selectedSubject}</div>
                      </div>
                      <div className="stat-tile">
                        <div className="value">{subjectValues.length}</div>
                        <div className="label">Pocet hodnoceni</div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <p className="stat-note">
                Rozliseni lichy/sudy tyden je odhad podle cisla tydne v roce
                — pokud neodpovida realite, dej vedet a preklopi se.
              </p>
            </section>
          </>
        )}
      </div>
    </>
  );
}
