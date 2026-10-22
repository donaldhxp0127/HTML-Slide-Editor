# Bundled export dependencies

Runtime files are vendored from official npm packages so export works offline:

- `html2canvas` 1.4.1: `dist/html2canvas.min.js`
- `jspdf` 4.2.1: `dist/jspdf.umd.min.js`
- `pptxgenjs` 4.0.1: `dist/pptxgen.bundle.js` (includes its browser ZIP dependency)

See `LICENSES.txt` and license headers in the distributed scripts. These files are loaded on demand only when a PDF or PPTX export starts. There is no CDN dependency.
