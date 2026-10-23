import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

// One branded 1200x630 OG card template, reused for run pages, head-to-head
// pages and the monthly report (Phase 6) — same aurora visual language as
// the site's hero (green bottom-left, purple top-right, per the HLD's UI
// spec), just drawn as static SVG shapes instead of the 3D scene.
function cardSvg({ eyebrow, title, big, subtitle }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="green" cx="0%" cy="100%" r="75%">
      <stop offset="0%" stop-color="#064E3B" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#064E3B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="purple" cx="100%" cy="0%" r="75%">
      <stop offset="0%" stop-color="#4C1D95" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#4C1D95" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#05080A"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#green)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#purple)"/>

  <text x="64" y="90" font-family="Georgia, serif" font-size="30" fill="#34D399">Agent वन</text>
  <text x="64" y="260" font-family="Arial, sans-serif" font-size="30" fill="#A78BFA" letter-spacing="2">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="64" y="340" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#E8F1EE">${escapeXml(title)}</text>
  <text x="64" y="470" font-family="monospace" font-size="110" font-weight="700" fill="#34D399">${escapeXml(big)}</text>
  <text x="64" y="540" font-family="Arial, sans-serif" font-size="28" fill="#8FA39B">${escapeXml(subtitle)}</text>
</svg>`;
}

export async function renderCardPng(opts) {
  return sharp(Buffer.from(cardSvg(opts))).png().toBuffer();
}
