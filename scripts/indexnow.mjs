// Avisa a Bing (y a los buscadores que usan IndexNow) de URLs nuevas o cambiadas.
// Uso:  node scripts/indexnow.mjs src/content/blog/es/mi-articulo.md [otros.md | https://...]
// Cada .md se convierte en su URL según lang/slug del frontmatter; una URL se envía tal cual.
// Hay que lanzarlo DESPUÉS de que Vercel haya desplegado (Bing comprueba que la URL y el
// archivo de la clave existen). Solo se envían URLs nuevas o modificadas, nunca todo el sitio.
import { readFileSync } from 'node:fs';

const HOST = 'asesoriamadal.es';
const KEY = '5f9855067ac2381c94cd0f606d469ed6'; // no es secreto: es el contenido público de /<clave>.txt

function urlDe(arg) {
  if (/^https?:\/\//.test(arg)) return arg;
  const fm = readFileSync(arg, 'utf8').split('---')[1] ?? '';
  const campo = (n) => fm.match(new RegExp('^' + n + ':\\s*(.+)$', 'm'))?.[1].trim().replace(/^['"]|['"]$/g, '');
  const lang = campo('lang');
  const slug = campo('slug');
  if (!lang || !slug) throw new Error('Sin lang/slug en ' + arg);
  return 'https://' + HOST + (lang === 'es' ? '' : '/' + lang) + '/blog/' + slug;
}

const dry = process.argv.includes('--dry');
const urlList = process.argv.slice(2).filter((a) => a !== '--dry').map(urlDe);
if (!urlList.length) { console.error('Indica al menos un .md o una URL.'); process.exit(1); }

// --dry: solo muestra las URLs que se enviarían, sin llamar a la API.
if (dry) { console.log(urlList.join('\n')); process.exit(0); }

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList }),
});
console.log(res.status, res.statusText, '\n' + urlList.join('\n'));
// 200/202 = aceptado. 403 = clave no encontrada (¿desplegado el .txt?). 422 = URL fuera del host.
