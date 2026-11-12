const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  moon: 'M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z',
  food: 'M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 22V2c-2.2 1.3-3.5 4-3.5 7.5S14.8 14 17 14',
  habits: 'M9 11.5l2.2 2.2L16 9M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 4v6M10 14v6',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  close: 'M18 6 6 18M6 6l12 12',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  drop: 'M12 3s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3z',
  steps: 'M8 3c1.7 0 2.5 2 2.5 4.5S9.5 12 8 12s-2.5-2-2.5-4.5S6.3 3 8 3zM5.5 15h5v1.5a2.5 2.5 0 0 1-5 0zM16 6c1.7 0 2.5 2 2.5 4.5S17.5 15 16 15s-2.5-2-2.5-4.5S14.3 6 16 6zM13.5 18h5v.5a2.5 2.5 0 0 1-5 0z',
  flame: 'M12 22c4 0 7-2.8 7-6.8 0-3.5-2.5-5.7-4-8.2-.5 2-1.5 3-2.6 3.5C12.8 7.5 11.5 4.5 9 2.5 9 6 5 9 5 15.2 5 19.2 8 22 12 22z',
  scale: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 10a5 5 0 0 1 7 0M12 10l1.5-2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  sparkle: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  bed: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4M10 2h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
  wallet: 'M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zm0 0a2 2 0 0 1 2-2h12v4M16 14h.01',
};

export function Icon({ name, size = 22, stroke = 2, className, style }: { name: keyof typeof P | string; size?: number; stroke?: number; className?: string; style?: React.CSSProperties }) {
  const fill = name === 'star-fill';
  const d = P[fill ? 'star' : name] ?? P.more;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
