const sharp = require('sharp');
const path = require('path');

const orange = '#f97316';

async function generateIcon(size, filename) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${orange}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${size * 0.5}" font-family="Arial">M</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(__dirname, '../public', filename));

  console.log(`Generated ${filename}`);
}

async function main() {
  await generateIcon(192, 'icon-192.png');
  await generateIcon(512, 'icon-512.png');
  console.log('Done!');
}

main().catch(console.error);
