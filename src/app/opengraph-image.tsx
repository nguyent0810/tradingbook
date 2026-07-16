import { ImageResponse } from "next/og";

export const alt = "TradeLog — Setup Intelligence Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(150deg, #0c1428 0%, #060a14 55%, #04060c 100%)",
          color: "#e8eaef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "rgba(0, 229, 255, 0.12)",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              // Must stay in sync with tokens.css's --accent (#6366f1) — this file
              // runs outside the CSS cascade and can't reference var(--token).
              color: "#6366f1",
              fontSize: "26px",
              fontWeight: 700,
            }}
          >
            ▲
          </div>
          <div style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            TradeLog
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "22px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8c94a8",
              marginBottom: "20px",
            }}
          >
            Setup Intelligence Platform
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: "62px",
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: "1000px",
            }}
          >
            Know which opportunities&nbsp;
            {/* Must stay in sync with tokens.css's --accent (#6366f1) — this file
                runs outside the CSS cascade and can't reference var(--token). */}
            <span style={{ color: "#6366f1" }}>deserve your capital.</span>
          </div>
        </div>

        <div style={{ fontSize: "26px", color: "#b4bccd" }}>
          Scan · Validate · Pressure-test — before you commit capital.
        </div>
      </div>
    ),
    size
  );
}
