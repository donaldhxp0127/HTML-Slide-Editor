"""Local-server regression tests; only Python's standard library is required."""
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest


spec = importlib.util.spec_from_file_location(
    'slide_server', Path(__file__).resolve().parents[1] / 'slide-editor/server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class DeckExtensionsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.original_root = server.ROOT
        server.ROOT = Path(self.directory.name).resolve()
        self.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
        server.ROOT = self.original_root
        self.directory.cleanup()

    def request(self, endpoint, body=None):
        connection = http.client.HTTPConnection(*self.httpd.server_address, timeout=5)
        try:
            connection.request('GET' if body is None else 'POST', endpoint,
                               body=None if body is None else json.dumps(body),
                               headers={'Content-Type': 'application/json'})
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            connection.close()

    def write(self, name, content='<section class="slide">Original</section>'):
        file = server.ROOT / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding='utf-8')
        return file

    def test_discovery_accepts_html_and_htm_case_insensitively(self):
        decks = ['slides/a.html', 'slides/b.htm', 'slides/c.HTML', 'slides/d.HTM']
        for name in decks + ['slides/readme.txt', 'slides/almost.xhtml',
                             'slide-editor/internal.HTML', 'web-dist/index.htm',
                             '.slide-editor-backups/old.HTML', 'dist/old.html',
                             'node_modules/demo.htm', 'Demo.app/contents.HTML']:
            self.write(name)
        status, result = self.request('/api/decks')
        self.assertEqual(status, 200)
        self.assertEqual(set(result), set(decks))

    def test_load_save_and_backup_preserve_each_supported_extension(self):
        for extension in ['.html', '.htm', '.HTML', '.HTM']:
            with self.subTest(extension=extension):
                name = 'slides/deck' + extension
                file = self.write(name)
                original = file.read_bytes()
                status, loaded = self.request('/api/load', {'path': name})
                self.assertEqual(status, 200)
                edited = '<section class="slide">Edited</section>'
                status, saved = self.request('/api/save', {
                    'path': name, 'version': loaded['version'], 'html': edited})
                self.assertEqual(status, 200)
                self.assertEqual(file.read_text(), edited)
                backup = server.ROOT / saved['backup']
                self.assertEqual(backup.name, file.name)
                self.assertEqual(backup.read_bytes(), original)
                status, _ = self.request('/api/save', {
                    'path': name, 'version': loaded['version'], 'html': 'stale'})
                self.assertEqual(status, 409)
                self.assertEqual(file.read_text(), edited)
        self.assertFalse(list(server.ROOT.rglob('*.editor-tmp')))

    def test_non_html_and_internal_files_remain_rejected(self):
        for name in ['slides/readme.txt', 'slides/almost.xhtml', 'slide-editor/internal.HTM']:
            with self.subTest(name=name):
                self.write(name)
                status, _ = self.request('/api/load', {'path': name})
                self.assertEqual(status, 400)


if __name__ == '__main__':
    unittest.main()
