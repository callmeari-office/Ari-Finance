// Sinh bộ icon PWA từ public/logo.png. Chạy 1 lần: node scripts/gen-pwa-icons.cjs
// Yêu cầu: sharp (đã có sẵn trong dependencies của Next).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PUBLIC = path.join(__dirname, '..', 'public');
const OUT = path.join(PUBLIC, 'icons');
const SRC = path.join(PUBLIC, 'logo.png');
const BG = '#ffffff'; // nền sáng đồng bộ theme cream/sáng của app

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  // Icon "any" — nền trong suốt, đúng kích thước.
  await sharp(SRC).resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(OUT, 'icon-192.png'));
  await sharp(SRC).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(OUT, 'icon-512.png'));

  // Maskable — logo nằm trong vùng an toàn (~62%) trên nền trắng đầy khung.
  const logoMask = await sharp(SRC).resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
    .composite([{ input: logoMask, gravity: 'center' }])
    .png().toFile(path.join(OUT, 'maskable-512.png'));

  // Apple touch icon — 180x180 nền trắng (iOS không hỗ trợ nền trong suốt đẹp).
  const logoApple = await sharp(SRC).resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: BG } })
    .composite([{ input: logoApple, gravity: 'center' }])
    .png().toFile(path.join(OUT, 'apple-touch-icon.png'));

  console.log('✓ Đã sinh icon PWA vào public/icons/ (icon-192, icon-512, maskable-512, apple-touch-icon).');
}

main().catch((e) => { console.error('Lỗi sinh icon:', e); process.exit(1); });
