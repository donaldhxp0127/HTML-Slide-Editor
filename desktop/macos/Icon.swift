import AppKit
let folder=URL(fileURLWithPath:CommandLine.arguments[1])
try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
for size in [16,32,128,256,512] {
    for retina in [1,2] {
        let px=size*retina
        let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:px,pixelsHigh:px,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep)
        let p=CGFloat(px),inset=p*0.07
        let background=NSBezierPath(roundedRect:NSRect(x:inset,y:inset,width:p-2*inset,height:p-2*inset),xRadius:p*0.2,yRadius:p*0.2)
        NSColor(calibratedRed:0.20,green:0.34,blue:0.83,alpha:1).setFill();background.fill()
        let card=NSBezierPath(roundedRect:NSRect(x:p*0.22,y:p*0.30,width:p*0.56,height:p*0.40),xRadius:p*0.04,yRadius:p*0.04)
        NSColor.white.setFill();card.fill()
        NSColor(calibratedRed:0.20,green:0.34,blue:0.83,alpha:1).setFill()
        NSBezierPath(rect:NSRect(x:p*0.29,y:p*0.55,width:p*0.30,height:p*0.045)).fill()
        NSBezierPath(rect:NSRect(x:p*0.29,y:p*0.44,width:p*0.42,height:p*0.025)).fill()
        NSBezierPath(rect:NSRect(x:p*0.29,y:p*0.38,width:p*0.34,height:p*0.025)).fill()
        NSGraphicsContext.restoreGraphicsState()
        let name="icon_\(size)x\(size)"+(retina==2 ? "@2x" : "")+".png"
        try rep.representation(using:.png,properties:[:])!.write(to:folder.appendingPathComponent(name))
    }
}
// Write the standard ICNS container directly so builds do not depend on iconutil.
func word(_ value: Int) -> Data { var big=UInt32(value).bigEndian;return withUnsafeBytes(of:&big) { Data($0) } }
var entries=Data()
for (kind,name) in [("icp4","icon_16x16.png"),("icp5","icon_32x32.png"),("icp6","icon_32x32@2x.png"),("ic07","icon_128x128.png"),("ic08","icon_256x256.png"),("ic09","icon_512x512.png"),("ic10","icon_512x512@2x.png")] {
    let png=try Data(contentsOf:folder.appendingPathComponent(name))
    entries.append(Data(kind.utf8));entries.append(word(png.count+8));entries.append(png)
}
var container=Data("icns".utf8);container.append(word(entries.count+8));container.append(entries)
try container.write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
