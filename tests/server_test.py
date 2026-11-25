"""Local-server regression tests; only Python's standard library is required."""
import http.client
import importlib.util
import json
import os
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


class LocalServerTest(unittest.TestCase):
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

    def request(self, endpoint, body=None, headers=None):
        connection = http.client.HTTPConnection(*self.httpd.server_address, timeout=5)
        try:
            connection.request('GET' if body is None else 'POST', endpoint,
                               body=None if body is None else json.dumps(body),
                               headers={'Content-Type': 'application/json', **(headers or {})})
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

    def test_invalid_save_content_does_not_create_backups(self):
        name = 'slides/deck.html'
        file = self.write(name)
        original = file.read_bytes()
        for label, content in [
            ('missing HTML', {}),
            ('null HTML', {'html': None}),
            ('numeric HTML', {'html': 42}),
            ('array HTML', {'html': []}),
            ('object HTML', {'html': {}}),
            ('unencodable HTML', {'html': '\ud800'}),
        ]:
            with self.subTest(content=label):
                status, result = self.request('/api/save', {
                    'path': name, 'version': server.digest(original), **content,
                })
                self.assertEqual(status, 400)
                self.assertIn('error', result)
                self.assertEqual(file.read_bytes(), original)
                self.assertFalse((server.ROOT / '.slide-editor-backups').exists())
                self.assertFalse(list(server.ROOT.rglob('*.editor-tmp')))

    def test_non_html_and_internal_files_remain_rejected(self):
        for name in ['slides/readme.txt', 'slides/almost.xhtml', 'slide-editor/internal.HTM']:
            with self.subTest(name=name):
                self.write(name)
                status, _ = self.request('/api/load', {'path': name})
                self.assertEqual(status, 400)

    def test_allowed_origins_can_load_and_save(self):
        for index, origin in enumerate([None, 'http://127.0.0.1:8765', 'http://localhost:8765']):
            with self.subTest(origin=origin):
                headers = {} if origin is None else {'Origin': origin}
                name = f'slides/origin-{index}.html'
                file = self.write(name)
                original = file.read_bytes()
                status, loaded = self.request('/api/load', {'path': name}, headers)
                self.assertEqual(status, 200)
                self.assertEqual(loaded['html'].encode('utf-8'), original)
                edited = '<section class="slide">Allowed origin edit</section>'
                status, saved = self.request('/api/save', {
                    'path': name, 'version': loaded['version'], 'html': edited,
                }, headers)
                self.assertEqual(status, 200)
                self.assertEqual(file.read_text(), edited)
                self.assertEqual((server.ROOT / saved['backup']).read_bytes(), original)
        self.assertFalse(list(server.ROOT.rglob('*.editor-tmp')))

    def test_other_origins_cannot_load_or_save(self):
        name = 'slides/private.html'
        file = self.write(name)
        original = file.read_bytes()
        for origin in ['https://example.com', 'null', 'http://localhost:8766',
                       'https://localhost:8765', 'http://localhost.example.com:8765',
                       'http://127.0.0.1.example.com:8765']:
            for endpoint in ['/api/load', '/api/save']:
                with self.subTest(origin=origin, endpoint=endpoint):
                    status, result = self.request(endpoint, {
                        'path': name, 'version': server.digest(original),
                        'html': '<section class="slide">Must not be written</section>',
                    }, {'Origin': origin})
                    self.assertEqual(status, 403)
                    self.assertEqual(result, {'error': '来源不允许'})
                    self.assertEqual(file.read_bytes(), original)
                    self.assertFalse((server.ROOT / '.slide-editor-backups').exists())
                    self.assertFalse(list(server.ROOT.rglob('*.editor-tmp')))

    def assert_file_access_rejected(self, requested_path, file):
        original = file.read_bytes()
        for endpoint in ['/api/load', '/api/save']:
            with self.subTest(endpoint=endpoint, path=requested_path):
                status, result = self.request(endpoint, {
                    'path': requested_path,
                    'version': server.digest(original),
                    'html': '<section class="slide">Must not be written</section>',
                })
                self.assertEqual(status, 400)
                self.assertEqual(result, {'error': '无效路径'})
                self.assertEqual(file.read_bytes(), original)
        self.assertFalse((server.ROOT / '.slide-editor-backups').exists())
        self.assertFalse(list(file.parent.glob('*.editor-tmp')))

    def test_traversal_and_absolute_paths_cannot_access_outside_files(self):
        with tempfile.TemporaryDirectory() as directory:
            outside = Path(directory).resolve() / 'private.html'
            outside.write_text('<section class="slide">Outside document</section>')
            self.assert_file_access_rejected(str(outside), outside)
            relative = os.path.relpath(outside, server.ROOT)
            self.assertTrue(relative.startswith('..'))
            self.assert_file_access_rejected(relative, outside)

    def test_symlinks_cannot_bypass_file_access_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            outside = Path(directory).resolve() / 'private.html'
            outside.write_text('<section class="slide">Outside document</section>')
            internal = self.write('slide-editor/internal.html')
            for name, target in [('outside.html', outside), ('internal.html', internal)]:
                alias = server.ROOT / name
                try:
                    alias.symlink_to(target)
                except (OSError, NotImplementedError) as error:
                    self.skipTest('Symbolic links unavailable: ' + str(error))
                self.assert_file_access_rejected(name, target)


if __name__ == '__main__':
    unittest.main()
