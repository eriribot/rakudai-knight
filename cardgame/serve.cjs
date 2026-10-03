const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.CARDGAME_PORT || 4177);
const mime = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg',
  '.webm':'video/webm', '.mp4':'video/mp4', '.ico':'image/x-icon'
};
http.createServer((req,res)=>{
  try {
    if(req.method !== 'GET' && req.method !== 'HEAD'){
      res.writeHead(405, {'Allow':'GET, HEAD'});res.end();return;
    }
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname === '/favicon.ico'){res.writeHead(204);res.end();return;}
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if(file !== root && !file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    fs.stat(file,(error,stat)=>{
      if(error || !stat.isFile()){res.writeHead(404);res.end();return;}
      const headers = {
        'Content-Type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control':'no-cache', 'Accept-Ranges':'bytes', 'Content-Length':stat.size
      };
      let start = 0;
      let end = stat.size - 1;
      let status = 200;
      // A single byte range lets media elements seek without loading the whole file.
      // Range applies to GET only; HEAD reports the complete representation.
      if(req.method === 'GET' && req.headers.range){
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let valid = Boolean(range && (range[1] || range[2]) && stat.size > 0);
        if(valid){
          if(range[1]){
            start = Number(range[1]);
            end = range[2] ? Number(range[2]) : end;
            valid = Number.isSafeInteger(start) && Number.isSafeInteger(end) && start < stat.size && end >= start;
            end = Math.min(end, stat.size - 1);
          } else {
            const count = Number(range[2]);
            valid = Number.isSafeInteger(count) && count > 0;
            start = Math.max(0, stat.size - count);
          }
        }
        if(!valid){
          res.writeHead(416, {...headers, 'Content-Range':'bytes */'+stat.size, 'Content-Length':0});
          res.end();return;
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        headers['Content-Length'] = end - start + 1;
      }
      if(req.method === 'HEAD' || stat.size === 0){res.writeHead(status,headers);res.end();return;}
      const stream = fs.createReadStream(file, {start,end});
      stream.once('open',()=>{res.writeHead(status,headers);stream.pipe(res);});
      stream.once('error',()=>{
        if(!res.headersSent){res.writeHead(500);res.end();} else {res.destroy();}
      });
      res.once('close',()=>stream.destroy());
    });
  } catch {res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log('Cardgame ready: http://127.0.0.1:'+port));
