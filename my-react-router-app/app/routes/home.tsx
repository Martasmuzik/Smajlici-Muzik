import { Link } from "react-router";
import { sql } from "../api/sql";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Jak se dnes citis?" },
    { name: "description", content: "Rychla nalada tridy - jedno kliknuti." },
  ];
}

const ratings = [
  { emoji: "😭", label: "Velmi smutny", color: "#4C6FA5" },
  { emoji: "🙁", label: "Smutny", color: "#6E93A0" },
  { emoji: "😐", label: "Neutralni", color: "#9CA68C" },
  { emoji: "🙂", label: "Usmevavy", color: "#D9AD5C" },
  { emoji: "😄", label: "Velmi stastny", color: "#E38350" },
];

export default function Home() {
  const handleClick = async (index: number) => {
    const rating = index + 1; // 1 az 5

    const result = await sql(
      `INSERT INTO \`1_Opakování\` (rating) VALUES (${rating})`
    );

    if (!result) {
      alert("Neco se nepovedlo, zkus to prosim znovu.");
    }
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap"
      />
      <style>{`
        .mood-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(28px, 6vh, 56px);
          background: #EEF2ED;
          padding: 40px 24px;
          text-align: center;
        }
        .mood-heading {
          font-family: "Fraunces", Georgia, serif;
          font-weight: 600;
          font-size: clamp(28px, 5.5vw, 52px);
          line-height: 1.15;
          color: #1F2D22;
          max-width: 14ch;
          margin: 0;
        }
        .mood-sub {
          font-family: system-ui, sans-serif;
          font-size: clamp(14px, 1.6vw, 17px);
          color: #5C6B60;
          margin-top: 4px;
        }
        .mood-row {
          display: flex;
          gap: clamp(12px, 3vw, 28px);
          flex-wrap: wrap;
          justify-content: center;
        }
        .mood-btn {
          --accent: #ccc;
          position: relative;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 14px;
          border-radius: 50%;
          font-size: clamp(44px, 7vw, 76px);
          line-height: 1;
          transition: transform 0.18s ease, background-color 0.18s ease;
        }
        .mood-btn:hover,
        .mood-btn:focus-visible {
          background-color: color-mix(in srgb, var(--accent) 18%, transparent);
          transform: translateY(-6px);
        }
        .mood-btn:active {
          transform: translateY(-2px) scale(0.96);
        }
        .mood-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 4px;
        }
        .mood-label {
          font-family: system-ui, sans-serif;
          font-size: 12px;
          color: #5C6B60;
          display: block;
          margin-top: 6px;
        }
        .mood-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stats-link {
          font-family: system-ui, sans-serif;
          font-size: 14px;
          color: #5C6B60;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .stats-link:hover {
          color: #1F2D22;
          border-color: #1F2D22;
        }
        @media (prefers-reduced-motion: reduce) {
          .mood-btn { transition: none; }
        }
      `}</style>

      <div className="mood-page">
        <div>
          <h1 className="mood-heading">Jak se dnes ve třídě cítíš?</h1>
          <p className="mood-sub">Klikni na obličej, který to dnes vystihuje nejlíp.</p>
        </div>

        <div className="mood-row">
          {ratings.map((item, index) => (
            <div className="mood-item" key={index}>
              <button
                className="mood-btn"
                style={{ ["--accent" as any]: item.color }}
                onClick={() => handleClick(index)}
                aria-label={item.label}
              >
                {item.emoji}
              </button>
              <span className="mood-label">{item.label}</span>
            </div>
          ))}
        </div>

        <Link to="/statistika" className="stats-link">
          Zobrazit statistiku
        </Link>
      </div>
    </>
  );
}
