import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const PIP = 300 / 3;
const spots = [
  [0, 0],
  [2, 0],
  [1, 1],
  [0, 2],
  [2, 2],
];

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#d9512c",
        }}
      >
        <div style={{ position: "relative", width: 300 * 1.6, height: 300 * 1.6, display: "flex" }}>
          {spots.map(([x, y], i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x * PIP * 1.6 + 22,
                top: y * PIP * 1.6 + 22,
                width: PIP * 1.1,
                height: PIP * 1.1,
                borderRadius: 999,
                background: "#fffdf9",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
