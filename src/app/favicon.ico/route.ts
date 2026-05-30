const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="18" fill="#12a7ec"/>
  <circle cx="24" cy="29" r="6" fill="#ffffff"/>
  <circle cx="41" cy="26" r="5" fill="#ffffff" opacity="0.92"/>
  <path d="M20 43c8 5 19 4 25-3" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
</svg>`;

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/svg+xml"
    }
  });
}
