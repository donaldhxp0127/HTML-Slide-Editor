import AppKit
import WebKit
import Network
import CryptoKit
import UniformTypeIdentifiers
import PDFKit

// The native host serves bundled editor assets and the user-selected deck folder.
// No Python, Node.js, or third-party runtime is required by the packaged app.
final class LocalServer {
    private let queue = DispatchQueue(label: "SlideStudio.HTTP")
    private let lock = NSLock()
    private var folder: URL?
    private let assets: URL
    private var listener: NWListener?
    private(set) var port: UInt16 = 0
    var origin: String { "http://127.0.0.1:\(port)" }

    init(assets: URL) { self.assets = assets }
    func setFolder(_ url: URL) { lock.lock(); folder = url.resolvingSymlinksInPath(); lock.unlock() }
    func currentFolder() -> URL? { lock.lock(); defer { lock.unlock() }; return folder }
    func start(_ ready: @escaping (Result<URL, Error>) -> Void) throws {
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        let listener = try NWListener(using: params)
        self.listener = listener
        listener.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                self.port = listener.port!.rawValue
                DispatchQueue.main.async { ready(.success(URL(string: self.origin)!)) }
            case .failed(let error): DispatchQueue.main.async { ready(.failure(error)) }
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { return }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
        }
        listener.start(queue: queue)
    }
    func stop() { listener?.cancel() }
    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, error in
            guard let self = self else { return }
            var bytes = buffer
            if let data = data { bytes.append(data) }
            if bytes.count > 21_000_000 { self.reply(connection, status: 413, data: Data()); return }
            if let split = bytes.range(of: Data("\r\n\r\n".utf8)), let header = String(data: bytes[..<split.lowerBound], encoding: .utf8) {
                let lines = header.components(separatedBy: "\r\n")
                let request = (lines.first ?? "").split(separator: " ").map(String.init)
                guard request.count >= 2 else { self.reply(connection, status: 400, data: Data()); return }
                var headers: [String:String] = [:]
                for line in lines.dropFirst() {
                    if let colon = line.firstIndex(of: ":") {
                        headers[String(line[..<colon]).lowercased()] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
                    }
                }
                let size = Int(headers["content-length"] ?? "0") ?? -1
                guard size >= 0 && size <= 20_000_000 else { self.reply(connection, status: 413, data: Data()); return }
                if bytes.count - split.upperBound >= size {
                    let body = bytes.subdata(in: split.upperBound..<(split.upperBound + size))
                    self.handle(connection, method: request[0], rawPath: request[1], headers: headers, body: body)
                    return
                }
            }
            if done || error != nil { connection.cancel() } else { self.receive(connection, buffer: bytes) }
        }
    }
    private func reply(_ connection: NWConnection, status: Int = 200, type: String = "application/json; charset=utf-8", data: Data) {
        let reason = status == 200 ? "OK" : "Error"
        var response = Data("HTTP/1.1 \(status) \(reason)\r\nContent-Type: \(type)\r\nContent-Length: \(data.count)\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n".utf8)
        response.append(data)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
    private func json(_ connection: NWConnection, _ object: Any, status: Int = 200) {
        let data = (try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .fragmentsAllowed])) ?? Data()
        reply(connection, status: status, data: data)
    }
    private func inside(_ path: String, root: URL) -> URL? {
        let file = root.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()
        let base = root.resolvingSymlinksInPath().path
        guard file.path.hasPrefix(base + "/"), !path.split(separator: "/").contains(where: { $0.hasPrefix(".") }) else { return nil }
        return file
    }
    private func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private func handle(_ connection: NWConnection, method: String, rawPath: String, headers: [String:String], body: Data) {
        let path = String(rawPath.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)[0]).removingPercentEncoding ?? rawPath
        // Requests remain local and same-origin; external webpages cannot use the save API.
        guard headers["host"] == "127.0.0.1:\(port)" || headers["host"] == "localhost:\(port)" else { json(connection, ["error":"Invalid host"], status:403); return }
        if method == "GET" {
            if path == "/api/decks" {
                guard let root = currentFolder() else { json(connection, []); return }
                let fm = FileManager.default
                let enumerator = fm.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles, .skipsPackageDescendants])
                var files: [String] = []
                while let file = enumerator?.nextObject() as? URL {
                    let normalized = file.resolvingSymlinksInPath()
                    let relative = String(normalized.path.dropFirst(root.path.count + 1))
                    if file.lastPathComponent == "slide-editor" || file.lastPathComponent == "node_modules" { enumerator?.skipDescendants(); continue }
                    if file.pathExtension.lowercased() == "html", inside(relative, root: root) != nil { files.append(relative) }
                }
                json(connection, files.sorted()); return
            }
            if path == "/api/config" { json(connection, ["desktop":true,"folder":currentFolder()?.path ?? ""]); return }
            let file: URL?
            if path == "/" { file = assets.appendingPathComponent("index.html") }
            else if path.hasPrefix("/slide-editor/") { file = inside(String(path.dropFirst(14)), root: assets) }
            else if let root = currentFolder() { file = inside(String(path.dropFirst()), root: root) }
            else { file = nil }
            guard let file = file, let data = try? Data(contentsOf: file) else { json(connection, ["error":"Not found"], status:404); return }
            let mime: [String:String] = ["html":"text/html; charset=utf-8","css":"text/css; charset=utf-8","js":"application/javascript; charset=utf-8","svg":"image/svg+xml","png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","gif":"image/gif","webp":"image/webp","woff":"font/woff","woff2":"font/woff2","ttf":"font/ttf","mp4":"video/mp4","pdf":"application/pdf"]
            reply(connection, type:mime[file.pathExtension.lowercased()] ?? "application/octet-stream", data:data); return
        }
        guard method == "POST", path == "/api/load" || path == "/api/save" else { json(connection, ["error":"Not found"], status:404); return }
        if let origin = headers["origin"], origin != self.origin { json(connection, ["error":"来源不允许"], status:403); return }
        guard let root = currentFolder(), let request = (try? JSONSerialization.jsonObject(with: body)) as? [String:Any], let relative = request["path"] as? String, let file = inside(relative, root: root), file.pathExtension.lowercased() == "html" else { json(connection, ["error":"无效路径"], status:400); return }
        do {
            let data = try Data(contentsOf: file)
            if path == "/api/load" {
                guard let html = String(data:data,encoding:.utf8) else { json(connection,["error":"HTML must use UTF-8"],status:400); return }
                json(connection,["html":html,"version":hash(data)]); return
            }
            guard request["version"] as? String == hash(data) else { json(connection,["error":"原文件已被外部修改。请先导出当前修改，再重新打开。"],status:409); return }
            guard let html = request["html"] as? String else { json(connection,["error":"Invalid HTML"],status:400); return }
            let stamp = ISO8601DateFormatter().string(from:Date()).replacingOccurrences(of:":",with:"-") + "-" + UUID().uuidString.prefix(8)
            let backup = root.appendingPathComponent(".slide-editor-backups/\(stamp)/\(relative)")
            try FileManager.default.createDirectory(at:backup.deletingLastPathComponent(),withIntermediateDirectories:true)
            try data.write(to:backup,options:.atomic)
            let updated = Data(html.utf8)
            try updated.write(to:file,options:.atomic)
            json(connection,["version":hash(updated),"backup":backup.path])
        } catch { json(connection,["error":error.localizedDescription],status:400) }
    }
}

// WebKit's native PDF renderer avoids canvas-clone stalls in hidden subframes.
final class SlideCaptureRenderer: NSObject, WKNavigationDelegate {
    private var view: WKWebView!
    private var completion: ((Result<String,Error>)->Void)?
    private var timer: Timer?
    func capture(html:String, completion:@escaping(Result<String,Error>)->Void) {
        self.completion=completion
        let config=WKWebViewConfiguration()
        view=WKWebView(frame:NSRect(x:0,y:0,width:1280,height:720),configuration:config)
        view.navigationDelegate=self
        timer=Timer.scheduledTimer(withTimeInterval:45,repeats:false) { [weak self] _ in self?.finish(.failure(NSError(domain:"SlideStudio",code:1,userInfo:[NSLocalizedDescriptionKey:"Page rendering timed out."]))) }
        view.loadHTMLString(html,baseURL:nil)
    }
    private func finish(_ result:Result<String,Error>) {
        guard let completion=completion else { return };self.completion=nil;timer?.invalidate();view?.stopLoading();completion(result);view=nil
    }
    func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error) { finish(.failure(error)) }
    func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error) { finish(.failure(error)) }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) {
        let wait="await document.fonts.ready;await Promise.all(Array.from(document.images).filter(img=>!img.closest('[hidden]')).map(img=>img.decode()));return true;"
        webView.callAsyncJavaScript(wait,arguments:[:],in:nil,in:.page) { [weak self] result in
            guard let self=self,self.completion != nil else { return }
            if case .failure(let error)=result { self.finish(.failure(error));return }
            let config=WKPDFConfiguration();config.rect=CGRect(x:0,y:0,width:1280,height:720)
            webView.createPDF(configuration:config) { [weak self] result in
                guard let self=self,self.completion != nil else { return }
                do {
                    let data=try result.get()
                    guard let page=PDFDocument(data:data)?.page(at:0) else { throw NSError(domain:"SlideStudio",code:2,userInfo:[NSLocalizedDescriptionKey:"Unable to render slide."]) }
                    let thumbnail=page.thumbnail(of:NSSize(width:2560,height:1440),for:.mediaBox)
                    let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:2560,pixelsHigh:1440,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
                    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep)
                    NSColor.white.setFill();NSRect(x:0,y:0,width:2560,height:1440).fill();thumbnail.draw(in:NSRect(x:0,y:0,width:2560,height:1440))
                    NSGraphicsContext.restoreGraphicsState()
                    guard let png=rep.representation(using:.png,properties:[:]) else { throw NSError(domain:"SlideStudio",code:3) }
                    self.finish(.success("data:image/png;base64,"+png.base64EncodedString()))
                }catch { self.finish(.failure(error)) }
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var server: LocalServer!
    var home: URL!
    var allowedClose = false
    var presentationWindows: [NSWindow] = []
    var initialFile: String?
    var captureRenderers:[String:SlideCaptureRenderer]=[:]
    let title = "Slide Studio"
    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        let config = WKWebViewConfiguration()
        config.userContentController.add(self,name:"desktop")
        let language=UserDefaults.standard.string(forKey:"language") ?? "zh-CN"
        config.userContentController.addUserScript(WKUserScript(source:"window.slideStudioDesktop = true;try{localStorage.setItem('slide-studio-language','\(language)')}catch{}",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        webView = WKWebView(frame:.zero,configuration:config)
        webView.navigationDelegate = self; webView.uiDelegate = self
        window = NSWindow(contentRect:NSRect(x:0,y:0,width:1440,height:940),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = title; window.minSize = NSSize(width:900,height:650); window.contentView = webView; window.delegate = self
        window.center();window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true)
        guard let resource = Bundle.main.resourceURL?.appendingPathComponent("editor") else { return }
        server = LocalServer(assets:resource)
        if let last = UserDefaults.standard.string(forKey:"workspace"), FileManager.default.fileExists(atPath:last) { server.setFolder(URL(fileURLWithPath:last)) }
        do { try server.start { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let url):
                self.home=url;self.webView.load(URLRequest(url:url));self.updateTitle()
                // First launch opens the bundled tutorial. File / Folder remains available.
            case .failure(let error): self.showError(error.localizedDescription)
            }
        }} catch { showError(error.localizedDescription) }
    }
    func buildMenu() {
        let menu=NSMenu(), appItem=NSMenuItem(), appMenu=NSMenu()
        appMenu.addItem(withTitle:"About Slide Studio",action:#selector(about),keyEquivalent:"")
        appMenu.addItem(.separator());appMenu.addItem(withTitle:"Quit Slide Studio",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        appItem.submenu=appMenu;menu.addItem(appItem)
        let file=NSMenuItem(),fileMenu=NSMenu(title:"File")
        fileMenu.addItem(withTitle:"Open HTML or Folder…",action:#selector(chooseFolder(_:)),keyEquivalent:"o")
        fileMenu.addItem(withTitle:"Save…",action:#selector(save),keyEquivalent:"s")
        fileMenu.addItem(.separator());fileMenu.addItem(withTitle:"Close Window",action:#selector(NSWindow.performClose(_:)),keyEquivalent:"w")
        file.submenu=fileMenu;menu.addItem(file)
        let edit=NSMenuItem(),editMenu=NSMenu(title:"Edit")
        editMenu.addItem(withTitle:"Undo",action:#selector(editorUndo),keyEquivalent:"z")
        editMenu.addItem(withTitle:"Redo",action:#selector(editorRedo),keyEquivalent:"Z")
        for (name,selector,key) in [("Cut","cut:","x"),("Copy","copy:","c"),("Paste","paste:","v"),("Select All","selectAll:","a")] { editMenu.addItem(withTitle:name,action:Selector(selector),keyEquivalent:key) }
        edit.submenu=editMenu;menu.addItem(edit)
        let view=NSMenuItem(),viewMenu=NSMenu(title:"View")
        viewMenu.addItem(withTitle:"Reload Editor",action:#selector(reload),keyEquivalent:"r")
        view.submenu=viewMenu;menu.addItem(view);NSApp.mainMenu=menu
    }
    @objc func about() { NSApp.orderFrontStandardAboutPanel(options:[.applicationName:title,.applicationVersion:Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "1.1.0",.credits:NSAttributedString(string:"Local visual HTML slide editor\nEnglish · 日本語 · 中文")]) }
    @objc func editorUndo() { historyAction("undo") }
    @objc func editorRedo() { historyAction("redo") }
    func historyAction(_ action:String) {
        webView.evaluateJavaScript("(()=>{const root=document.activeElement?.tagName==='IFRAME'?document.activeElement.contentDocument:document;const el=root.activeElement;if(el?.isContentEditable||['INPUT','TEXTAREA'].includes(el?.tagName)){root.execCommand('\(action)')}else{document.getElementById('\(action)')?.click()}})()")
    }
    @objc func save() { webView.evaluateJavaScript("document.getElementById('save')?.click()") }
    @objc func reload() { confirmDiscard { self.webView.reload() } }
    func updateTitle() { window.title=server.currentFolder().map { "Slide Studio — \($0.lastPathComponent)" } ?? title }
    @objc func chooseFolder(_ sender: Any?) {
        confirmDiscard {
            let panel=NSOpenPanel();panel.canChooseDirectories=true;panel.canChooseFiles=true;panel.allowsMultipleSelection=false
            panel.allowedContentTypes=[.html];panel.message="Choose an HTML slide deck or a folder containing your decks."
            panel.beginSheetModal(for:self.window) { response in
                guard response == .OK, let url=panel.url else { return }
                var isDirectory: ObjCBool=false;FileManager.default.fileExists(atPath:url.path,isDirectory:&isDirectory)
                let root=isDirectory.boolValue ? url : url.deletingLastPathComponent()
                self.initialFile=isDirectory.boolValue ? nil : url.lastPathComponent
                self.server.setFolder(root);UserDefaults.standard.set(root.path,forKey:"workspace");self.updateTitle()
                self.webView.load(URLRequest(url:self.home))
            }
        }
    }
    func confirmDiscard(cancelled:(()->Void)? = nil, _ proceed:@escaping ()->Void) {
        webView.evaluateJavaScript("(typeof dirty !== 'undefined' && dirty) || (typeof sourceDraft !== 'undefined' && sourceDraft)") { value,_ in
            guard (value as? Bool) == true else { proceed();return }
            let alert=NSAlert();alert.messageText="Discard unsaved changes?";alert.informativeText="Save or export your slide changes before leaving this workspace.";alert.addButton(withTitle:"Cancel");alert.addButton(withTitle:"Discard Changes")
            alert.beginSheetModal(for:self.window) { if $0 == .alertSecondButtonReturn { proceed() } else { cancelled?() } }
        }
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if allowedClose { return true }
        confirmDiscard { self.allowedClose=true;self.window.close() };return false
    }
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply {
        if allowedClose { return .terminateNow }
        confirmDiscard(cancelled:{ NSApp.reply(toApplicationShouldTerminate:false) }) { self.allowedClose=true;NSApp.reply(toApplicationShouldTerminate:true) };return .terminateLater
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool { true }
    func applicationWillTerminate(_ notification:Notification) { server?.stop() }
    func showError(_ message:String) { let alert=NSAlert();alert.messageText="Slide Studio";alert.informativeText=message;alert.runModal() }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.webView === webView, let url=message.frameInfo.request.url, url.host=="127.0.0.1", url.port==Int(server.port) else { return }
        guard let payload=message.body as? [String:String] else { return }
        if payload["action"]=="openFolder" { chooseFolder(nil) }
        if payload["action"]=="captureSlide",let html=payload["html"],let id=payload["id"],html.utf8.count<=20_000_000,captureRenderers.count<2 {
            let renderer=SlideCaptureRenderer();captureRenderers[id]=renderer
            renderer.capture(html:html) { [weak self] result in
                guard let self=self else { return };self.captureRenderers.removeValue(forKey:id)
                let response:[String:String]
                switch result { case .success(let data):response=["id":id,"data":data];case .failure(let error):response=["id":id,"error":error.localizedDescription] }
                if let json=try? JSONSerialization.data(withJSONObject:response),let text=String(data:json,encoding:.utf8) { self.webView.evaluateJavaScript("window.slideStudioCaptureResult?.(\(text));") }
            }
        }
        if payload["action"]=="setLanguage", let language=payload["language"], ["zh-CN","en","ja"].contains(language) { UserDefaults.standard.set(language,forKey:"language") }
    }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) {
        guard webView === self.webView, let file=initialFile else { return };initialFile=nil
        let escaped=(try? JSONSerialization.data(withJSONObject:[file])).flatMap { String(data:$0,encoding:.utf8) } ?? "[]"
        webView.evaluateJavaScript("window.slideStudioOpenFile = \(escaped)[0]; window.dispatchEvent(new Event('desktop-file-ready'));")
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        if navigationAction.shouldPerformDownload { decisionHandler(.download);return }
        if let url=navigationAction.request.url, navigationAction.targetFrame?.isMainFrame != false, ["http","https"].contains(url.scheme ?? ""), !(url.host=="127.0.0.1"&&url.port==Int(server.port)) { NSWorkspace.shared.open(url);decisionHandler(.cancel);return }
        decisionHandler(.allow)
    }
    func webView(_ webView:WKWebView,navigationAction:WKNavigationAction,didBecome download:WKDownload) { download.delegate=self }
    func download(_ download:WKDownload,decideDestinationUsing response:URLResponse,suggestedFilename:String,completionHandler:@escaping(URL?)->Void) {
        let panel=NSSavePanel();panel.nameFieldStringValue=suggestedFilename;panel.beginSheetModal(for:window) { completionHandler($0 == .OK ? panel.url : nil) }
    }
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for navigationAction:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? {
        let view=WKWebView(frame:.zero,configuration:configuration);view.navigationDelegate=self;view.uiDelegate=self
        let popup=NSWindow(contentRect:NSRect(x:0,y:0,width:1280,height:780),styleMask:[.titled,.closable,.resizable,.miniaturizable],backing:.buffered,defer:false)
        popup.title="Slide Studio — Presentation";popup.contentView=view;popup.isReleasedWhenClosed=false;popup.center();popup.makeKeyAndOrderFront(nil);presentationWindows.append(popup);return view
    }
    func webView(_ webView:WKWebView,runJavaScriptAlertPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping()->Void) { let alert=NSAlert();alert.messageText=message;alert.beginSheetModal(for:webView.window ?? window) { _ in completionHandler() } }
    func webView(_ webView:WKWebView,runJavaScriptConfirmPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping(Bool)->Void) { let alert=NSAlert();alert.messageText=message;alert.addButton(withTitle:"OK");alert.addButton(withTitle:"Cancel");alert.beginSheetModal(for:webView.window ?? window) { completionHandler($0 == .alertFirstButtonReturn) } }
    func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void) { let panel=NSOpenPanel();panel.allowsMultipleSelection=parameters.allowsMultipleSelection;panel.allowedContentTypes=[.image];panel.beginSheetModal(for:webView.window ?? window) { completionHandler($0 == .OK ? panel.urls : nil) } }
}
let app=NSApplication.shared
let delegate=AppDelegate()
app.setActivationPolicy(.regular);app.delegate=delegate;app.run()
