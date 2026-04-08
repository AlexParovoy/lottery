import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#ff4fa3",
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          borderRadius: 36,
          border: "4px solid rgba(255,255,255,0.06)",
        }}
      >
        PL
      </div>
    ),
    {
      ...size,
    }
  );
}