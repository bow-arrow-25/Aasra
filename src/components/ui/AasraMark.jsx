export default function AasraMark({ size = 96, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="aasra-shield" x1="18" y1="8" x2="78" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF8EC" />
          <stop offset="1" stopColor="#D7C7A3" />
        </linearGradient>
        <linearGradient id="aasra-inner" x1="30" y1="28" x2="66" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12857A" />
          <stop offset="1" stopColor="#0B5D57" />
        </linearGradient>
      </defs>
      <path
        d="M48 8.5L82 22.2V46.4C82 67.1 68.4 84.6 48 90.5C27.6 84.6 14 67.1 14 46.4V22.2L48 8.5Z"
        fill="url(#aasra-shield)"
      />
      <path
        d="M48 16.2L74.5 27V46.1C74.5 63.2 63.4 77.6 48 82.6C32.6 77.6 21.5 63.2 21.5 46.1V27L48 16.2Z"
        fill="url(#aasra-inner)"
      />
      <path
        d="M48 33L61 58H54.6L51.4 51.2H44.6L41.4 58H35L48 33Z"
        fill="#FFF8EC"
      />
      <path d="M46.2 46.4H49.8L48 42.4L46.2 46.4Z" fill="#C9A227" />
    </svg>
  );
}
