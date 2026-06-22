// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CodePop",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "CodePop", targets: ["CodePop"])
    ],
    targets: [
        .executableTarget(
            name: "CodePop",
            path: "Sources/CodePop"
        )
    ]
)
