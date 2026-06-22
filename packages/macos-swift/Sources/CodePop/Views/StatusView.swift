import SwiftUI

struct StatusView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = StatusViewModel()

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("系统状态")
                    .font(PopArtTheme.titleFont)
                    .foregroundColor(.white)
                Spacer()
                Button(action: {
                    Task { await viewModel.load(api: appState.apiService) }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(PopArtTheme.accent)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(PopArtTheme.cardBackground)

            if viewModel.isLoading && viewModel.status == nil {
                Spacer()
                ProgressView()
                    .scaleEffect(1.2)
                    .tint(PopArtTheme.accent)
                Spacer()
            } else if let status = viewModel.status {
                statusContent(status)
            } else if let error = viewModel.errorMessage {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundColor(PopArtTheme.warning)
                    Text(error)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
                Spacer()
            }
        }
        .background(PopArtTheme.dark.ignoresSafeArea())
        .task {
            await viewModel.load(api: appState.apiService)
        }
    }

    private func statusContent(_ status: SystemStatus) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack(spacing: 20) {
                    StatusCard(title: "状态", value: status.status.uppercased(), color: PopArtTheme.statusColor(status.status))
                    StatusCard(title: "版本", value: status.version, color: PopArtTheme.secondary)
                }

                HStack(spacing: 20) {
                    StatusCard(title: "运行时间", value: formatUptime(status.uptime), color: PopArtTheme.accent)
                    StatusCard(title: "活跃请求", value: "\(status.activeRequests)", color: PopArtTheme.success)
                }

                HStack(spacing: 20) {
                    StatusCard(title: "索引任务", value: "\(status.indexingTasks)", color: PopArtTheme.warning)
                    StatusCard(title: "降级功能", value: "\(status.degradedFeatures.count)", color: status.degradedFeatures.isEmpty ? PopArtTheme.success : PopArtTheme.primary)
                }

                if !status.degradedFeatures.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("降级功能列表")
                            .font(PopArtTheme.headlineFont)
                            .foregroundColor(.white)
                        ForEach(status.degradedFeatures, id: \.self) { feature in
                            HStack {
                                Circle()
                                    .fill(PopArtTheme.warning)
                                    .frame(width: 6, height: 6)
                                Text(feature)
                                    .font(PopArtTheme.bodyFont)
                                    .foregroundColor(.white.opacity(0.85))
                                Spacer()
                            }
                        }
                    }
                    .padding()
                    .background(PopArtTheme.cardBackground)
                    .cornerRadius(12)
                }

                if !status.metrics.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("指标")
                            .font(PopArtTheme.headlineFont)
                            .foregroundColor(.white)
                        ForEach(Array(status.metrics.keys.sorted()), id: \.self) { key in
                            HStack {
                                Text(key)
                                    .font(PopArtTheme.bodyFont)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(String(format: "%.2f", status.metrics[key] ?? 0))
                                    .font(PopArtTheme.bodyFont)
                                    .foregroundColor(PopArtTheme.accent)
                            }
                        }
                    }
                    .padding()
                    .background(PopArtTheme.cardBackground)
                    .cornerRadius(12)
                }
            }
            .padding()
        }
    }

    private func formatUptime(_ seconds: Double) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) % 3600) / 60
        return "\(hours)h \(minutes)m"
    }
}

struct StatusCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(PopArtTheme.captionFont)
                .foregroundColor(.secondary)
            Text(value)
                .font(PopArtTheme.headlineFont)
                .foregroundColor(color)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(PopArtTheme.cardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.3), lineWidth: 2)
        )
        .cornerRadius(12)
    }
}
