"""Run python3 slide-editor/server.py, then open http://127.0.0.1:8765."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, hashlib, datetime, shutil
ROOT = Path(__file__).resolve().parent.parent
def digest(data): return hashlib.sha256(data).hexdigest()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def reply(self,data,status=200):
        raw=json.dumps(data,ensure_ascii=False).encode(); self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/api/decks': return self.reply([str(p.relative_to(ROOT)) for p in ROOT.rglob('*.html') if not any(part in ('slide-editor', '.slide-editor-backups', 'dist', 'web-dist', 'node_modules', '.git') or part.endswith('.app') for part in p.relative_to(ROOT).parts)])
        if self.path=='/': self.path='/slide-editor/index.html'
        super().do_GET()
    def do_POST(self):
        if self.headers.get('Origin') not in (None,'http://127.0.0.1:8765','http://localhost:8765'): return self.reply({'error':'来源不允许'},403)
        try:
            size=int(self.headers.get('Content-Length',0))
            if size>20000000: raise ValueError('文件过大')
            req=json.loads(self.rfile.read(size)); p=(ROOT/req['path']).resolve()
            if not p.is_relative_to(ROOT) or p.suffix!='.html' or 'slide-editor' in p.relative_to(ROOT).parts: raise ValueError('无效路径')
            raw=p.read_bytes()
            if self.path=='/api/load': return self.reply({'html':raw.decode('utf-8'),'version':digest(raw)})
            if self.path!='/api/save': return self.reply({'error':'不存在'},404)
            if req['version']!=digest(raw): return self.reply({'error':'原文件已被外部修改。请先导出当前修改，再重新打开。'},409)
            backup=ROOT/'.slide-editor-backups'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')/p.relative_to(ROOT)
            backup.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,backup)
            data=req['html'].encode('utf-8'); tmp=p.with_suffix('.html.editor-tmp'); tmp.write_bytes(data); tmp.replace(p)
            self.reply({'version':digest(data),'backup':str(backup.relative_to(ROOT))})
        except Exception as e: self.reply({'error':str(e)},400)
if __name__=='__main__':
    print('Slide Studio: http://127.0.0.1:8765',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
