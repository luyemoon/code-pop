import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var endpointInput: String = ""
    @State private var saveSuccess: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("设置")
                    .font(PopArtTheme.titleFont)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding()
            .background(PopArtTheme.cardBackground)

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    settingsGroup(title: "API 端点") {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("CodePop 后端服务地址")
                                .font(PopArtTheme.bodyFont)
                                .foregroundColor(.secondary)
                            TextField("http://localhost:3000/api", text: $endpointInput)
                                .textFieldStyle(.roundedBorder)
                                .frame(maxWidth: 400)

                            HStack(spacing: 12) {
                                Button("保存") {
                                    appState.apiEndpoint = endpointInput
                                    appState.apiService.updateBaseURL(endpointInput)
                                    Task { await appState.apiService.checkHealth() }
                                    withAnimation {
                                        saveSuccess = true
                                    }
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                        withAnimation { saveSuccess = false }
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(PopArtTheme.secondary)

                                if saveSuccess {
                                    Label("已保存", systemImage: "checkmark.circle.fill")
                                        .font(PopArtTheme.bodyFont)
                                        .foregroundColor(PopArtTheme.success)
                                }
                            }
                        }
                    }

                    settingsGroup(title: "连接测试") {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 10) {
                                Circle()
                                    .fill(appState.apiService.isReachable ? PopArtTheme.success : PopArtTheme.primary)
                                    .frame(width: 10, height: 10)
                                Text(appState.apiService.isReachable ? "后端服务可连接" : "无法连接后端服务")
                                    .font(PopArtTheme.bodyFont)
                                    .foregroundColor(.white)
                            }

                            Button("测试连接") {
                                Task { await appState.apiService.checkHealth() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(PopArtTheme.accent)
                        }
                    }

                    settingsGroup(title: "关于") {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("CodePop")
                                    .font(PopArtTheme.headlineFont)
                                    .foregroundColor(PopArtTheme.primary)
                                Text("代码波普")
                                    .font(PopArtTheme.bodyFont)
                                    .foregroundColor(.secondary)
                            }
                            Text("面向 AI Agent 的代码专用检索基础设施")
                                .font(PopArtTheme.bodyFont)
                                .foregroundColor(.secondary)
                            Text("SwiftUI macOS 客户端")
                                .font(PopArtTheme.captionFont)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
            }
        }
        .background(PopArtTheme.dark.ignoresSafeArea())
        .onAppear {
            endpointInput = appState.apiEndpoint
        }
    }

    private func settingsGroup<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(PopArtTheme.headlineFont)
                .foregroundColor(.white)
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PopArtTheme.cardBackground)
        .cornerRadius(12)
    }
}
