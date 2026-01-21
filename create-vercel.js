const fs = require('fs');
const config = {
  version: 2,
  cleanUrls: true,
  trailingSlash: false,
  functions: {
    "api/index.js": {
      maxDuration: 10
    }
  },
  rewrites: [
    {
      source: "/api/:path*",
      destination: "/api/index.js"
    },
    {
      source: "/(.*)",
      destination: "/index.html"
    }
  ]
};

fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2), 'utf8');
console.log('✅ Created vercel.json');
console.log('Content:', JSON.stringify(config));
