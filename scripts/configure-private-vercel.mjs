import { writeFileSync } from 'node:fs'
const backend = new URL(process.argv[2] ?? '')
if (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) throw new Error('Provide only the HTTPS backend origin')
writeFileSync(new URL('../web/vercel.personal.json', import.meta.url), JSON.stringify({
  framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist',
  rewrites: [{source: '/api/:path*', destination: `${backend.origin}/api/:path*`}, {source: '/((?!assets/).*)', destination: '/index.html'}],
}, null, 2) + '\n')
console.log('Wrote web/vercel.personal.json. Use only with the personal Vercel project.')
