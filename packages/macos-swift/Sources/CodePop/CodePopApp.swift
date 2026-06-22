import SwiftUI

@main
struct CodePopApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup("CodePop") {
            ContentView()
                .environmentObject(appState)
                .frame(minWidth: 960, minHeight: 640)
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1200, height: 800)
    }
}

@MainActor
class AppState: ObservableObject {
    @AppStorage("codepop.apiEndpoint") var apiEndpoint: String = "http://localhost:3000/api"
    @Published var apiService: APIService = APIService(baseURL: "http://localhost:3000/api")

    init() {
        self.apiService = APIService(baseURL: apiEndpoint)
    }
}
