import AppKit
import CoreGraphics

let size: CGFloat = 1024
let image = NSImage(size: NSSize(width: size, height: size))

image.lockFocus()

let ctx = NSGraphicsContext.current!.cgContext

// Background rounded rect
let cornerRadius: CGFloat = size * 0.22
let rect = CGRect(x: 0, y: 0, width: size, height: size)
let path = NSBezierPath(roundedRect: rect, xRadius: cornerRadius, yRadius: cornerRadius)
path.addClip()

// Gradient background
let colorSpace = CGColorSpaceCreateDeviceRGB()
let gradient = CGGradient(
    colorsSpace: colorSpace,
    colors: [
        NSColor(red: 0.12, green: 0.18, blue: 0.45, alpha: 1.0).cgColor,
        NSColor(red: 0.35, green: 0.20, blue: 0.55, alpha: 1.0).cgColor,
        NSColor(red: 0.75, green: 0.25, blue: 0.50, alpha: 1.0).cgColor
    ] as CFArray,
    locations: [0.0, 0.5, 1.0]
)!
ctx.drawLinearGradient(
    gradient,
    start: CGPoint(x: 0, y: 0),
    end: CGPoint(x: size, y: size),
    options: []
)

// Inner subtle highlight
let highlight = NSBezierPath(roundedRect: CGRect(x: 8, y: size * 0.55, width: size - 16, height: size * 0.35), xRadius: cornerRadius * 0.8, yRadius: cornerRadius * 0.8)
NSColor.white.withAlphaComponent(0.08).setFill()
highlight.fill()

// Draw "C" shape using arc
let cSize = size * 0.45
let lineWidth = size * 0.10
let center = CGPoint(x: size / 2, y: size / 2)
let cRect = CGRect(x: center.x - cSize/2, y: center.y - cSize/2, width: cSize, height: cSize)

let cPath = NSBezierPath()
cPath.appendArc(withCenter: center, radius: cSize/2, startAngle: 45, endAngle: 315, clockwise: true)
cPath.lineWidth = lineWidth
cPath.lineCapStyle = .round
NSColor.white.setStroke()
cPath.stroke()

// Pop dot
let dotRadius = size * 0.055
let dotCenter = CGPoint(x: center.x + cSize * 0.45, y: center.y + cSize * 0.38)
let dotPath = NSBezierPath(ovalIn: CGRect(x: dotCenter.x - dotRadius, y: dotCenter.y - dotRadius, width: dotRadius * 2, height: dotRadius * 2))
NSColor(red: 1.0, green: 0.45, blue: 0.55, alpha: 1.0).setFill()
dotPath.fill()

// Small rings around dot
let ringPath = NSBezierPath(ovalIn: CGRect(x: dotCenter.x - dotRadius * 1.8, y: dotCenter.y - dotRadius * 1.8, width: dotRadius * 3.6, height: dotRadius * 3.6))
ringPath.lineWidth = size * 0.012
NSColor(red: 1.0, green: 0.45, blue: 0.55, alpha: 0.4).setStroke()
ringPath.stroke()

image.unlockFocus()

// Save as PNG
guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:])
else {
    print("Failed to generate PNG")
    exit(1)
}

let outputPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon_1024x1024.png"
let url = URL(fileURLWithPath: outputPath)
try pngData.write(to: url)
print("Icon saved to \(outputPath)")
