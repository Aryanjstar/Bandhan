const paths = {
  paw: "M8 13c-2 2-3 4-1 5 2 2 3-1 5-1s3 3 5 1c2-1 1-3-1-5-2-3-6-3-8 0 M6 10c-2 0-3-5-1-5s3 5 1 5 M10 8c-2 0-3-6-1-6s3 6 1 6 M14 8c-2 0-1-6 1-6s1 6-1 6 M18 10c-2 0-1-5 1-5s1 5-1 5",
  cube: "m12 3 9 5v9l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v9 M7 5l10 6",
  pulse: "M2 12h5l3-7 4 14 3-7h5",
  sliders: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  target:
    "M12 2v4 M12 18v4 M2 12h4 M18 12h4 M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  reset: "M4 10a8 8 0 1 1 0 5 M4 4v6h6",
  moon: "M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z",
  walk: "M14 4h.01 M12 8l-3 5H5 M12 8l3 5h4 M12 8l-1 7-4 6 M11 15l5 5",
  run: "M16 3h.01 M13 7l-4 3-4-1 M13 7l3 5h5 M13 7l-3 8-6 4 M10 15l6 1-1 5",
  tiltLeft: "m16 5-9 8 8 7 M7 13h13",
  tiltRight: "m8 5 9 8-8 7 M17 13H4",
  up: "m6 12 6-6 6 6 M12 6v15",
  down: "m6 12 6 6 6-6 M12 18V3",
  shake: "M3 8v8 M21 8v8 M7 6l10 12 M17 6 7 18",
  jump: "M4 19h16 M12 16V4 M7 9l5-5 5 5",
  bowl: "M3 11h18c0 11-18 11-18 0Z M8 7V4 M12 7V2 M16 7V4",
  drop: "M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z",
  scratch: "m7 4-3 16 M13 4l-3 16 M19 4l-3 16",
  sniff: "M3 10c4-6 14-6 18 0 M7 13c3-3 7-3 10 0 M10 17h4 M12 17v3",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  record: "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  info: "M12 11v6 M12 7h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  orbit: "M20 7c4 6-12 15-16 10S16 1 20 7 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 4v16 M16 4v16",
};
export default function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.pulse} />
    </svg>
  );
}
