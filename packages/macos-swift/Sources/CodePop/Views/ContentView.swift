import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedTab: SidebarItem = .search

    enum SidebarItem: String, CaseIterable, Identifiable {
        case search = "搜索"
        case repos = "仓库"
        case status = "状态"
        case settings = "设置"

        var id: String { rawValue }
        var icon: String {
            switch self {
            case .search: return "magnifyingglass"
            case .repos: return "folder.badge.gear"
            case .status: return "waveform.path.ecg"
            case .settings: return "gearshape.fill"
            }
        }
    }

    var body: some View {
        NavigationSplitView {
            List(SidebarItem.allCases, selection: $selectedTab) { item in
                Label(item.rawValue, systemImage: item.icon)
                    .font(PopArtTheme.bodyFont)
                    .tag(item)
                    .padding(.vertical, 4)
            }
            .navigationTitle("CodePop")
            .listStyle(.sidebar)
            .frame(minWidth: 160)
        } detail: {
            Group {
                switch selectedTab {
                case .search:
                    SearchView()
                case .repos:
                    ReposView()
                case .status:
                    StatusView()
                case .settings:
                    SettingsView()
                }
            }
            .environmentObject(appState)
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                ConnectionBadge()
                    .environmentObject(appState)
            }
        }
    }
}

struct ConnectionBadge: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(appState.apiService.isReachable ? PopArtTheme.success : PopArtTheme.warning)
                .frame(width: 8, height: 8)
            Text(appState.apiService.isReachable ? "已连接" : "未连接")
                .font(PopArtTheme.captionFont)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .task {
            await appState.apiService.checkHealth()
        }
    }
}
