import SwiftUI

struct ReposView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = ReposViewModel()

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("仓库管理")
                    .font(PopArtTheme.titleFont)
                    .foregroundColor(.white)
                Spacer()
                Button(action: { viewModel.showAddSheet = true }) {
                    Label("添加仓库", systemImage: "plus")
                        .font(PopArtTheme.bodyFont)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(PopArtTheme.secondary)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(PopArtTheme.cardBackground)

            if viewModel.isLoading && viewModel.repos.isEmpty {
                Spacer()
                ProgressView()
                    .scaleEffect(1.2)
                    .tint(PopArtTheme.accent)
                Spacer()
            } else {
                reposList
            }
        }
        .background(PopArtTheme.dark.ignoresSafeArea())
        .task {
            await viewModel.load(api: appState.apiService)
        }
        .sheet(isPresented: $viewModel.showAddSheet) {
            AddRepoSheet(viewModel: viewModel)
                .frame(minWidth: 420, minHeight: 260)
        }
    }

    private var reposList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundColor(PopArtTheme.primary)
                        .padding()
                }

                ForEach(viewModel.repos) { repo in
                    RepoCard(repo: repo, viewModel: viewModel)
                }

                if viewModel.repos.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "folder.badge.questionmark")
                            .font(.system(size: 48))
                            .foregroundColor(PopArtTheme.secondary.opacity(0.5))
                        Text("还没有仓库，点击右上角添加")
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 80)
                }
            }
            .padding()
        }
    }
}

struct RepoCard: View {
    let repo: Repo
    @ObservedObject var viewModel: ReposViewModel
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(repo.name)
                    .font(PopArtTheme.headlineFont)
                    .foregroundColor(.white)
                Spacer()
                StatusBadge(status: repo.status)
            }

            Text(repo.path)
                .font(PopArtTheme.captionFont)
                .foregroundColor(.secondary)
                .lineLimit(1)

            HStack(spacing: 16) {
                StatItem(label: "文件", value: repo.fileCount)
                StatItem(label: "符号", value: repo.symbolCount)
                StatItem(label: "向量", value: repo.embeddingCount)
                Spacer()
            }

            if repo.status == "indexing" {
                ProgressView(value: Double(repo.indexingProgress), total: 100)
                    .tint(PopArtTheme.accent)
            }

            HStack {
                Spacer()
                Button(action: {
                    Task { await viewModel.reindexRepo(api: appState.apiService, id: repo.id) }
                }) {
                    Label("重建索引", systemImage: "arrow.clockwise")
                        .font(PopArtTheme.captionFont)
                }
                .buttonStyle(.borderedProminent)
                .tint(PopArtTheme.secondary)

                Button(action: {
                    Task { await viewModel.deleteRepo(api: appState.apiService, id: repo.id) }
                }) {
                    Label("删除", systemImage: "trash")
                        .font(PopArtTheme.captionFont)
                }
                .buttonStyle(.borderedProminent)
                .tint(PopArtTheme.primary)
            }
        }
        .padding()
        .background(PopArtTheme.cardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(PopArtTheme.surface, lineWidth: 1)
        )
        .cornerRadius(12)
    }
}

struct StatItem: View {
    let label: String
    let value: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(PopArtTheme.headlineFont)
                .foregroundColor(PopArtTheme.accent)
            Text(label)
                .font(PopArtTheme.captionFont)
                .foregroundColor(.secondary)
        }
    }
}

struct StatusBadge: View {
    let status: String

    var body: some View {
        Text(status.uppercased())
            .font(PopArtTheme.captionFont)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(PopArtTheme.statusColor(status).opacity(0.15))
            .foregroundColor(PopArtTheme.statusColor(status))
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

struct AddRepoSheet: View {
    @ObservedObject var viewModel: ReposViewModel
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("添加代码仓库")
                .font(PopArtTheme.headlineFont)
                .foregroundColor(.white)

            VStack(alignment: .leading, spacing: 8) {
                Text("名称")
                    .font(PopArtTheme.captionFont)
                    .foregroundColor(.secondary)
                TextField("例如: my-project", text: $viewModel.newRepoName)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("本地路径")
                    .font(PopArtTheme.captionFont)
                    .foregroundColor(.secondary)
                TextField("/Users/xxx/project", text: $viewModel.newRepoPath)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Git URL（可选）")
                    .font(PopArtTheme.captionFont)
                    .foregroundColor(.secondary)
                TextField("https://github.com/...", text: $viewModel.newRepoGitUrl)
                    .textFieldStyle(.roundedBorder)
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .foregroundColor(PopArtTheme.primary)
                    .font(.caption)
            }

            HStack {
                Button("取消") {
                    viewModel.resetForm()
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                Button("添加") {
                    Task {
                        await viewModel.addRepo(api: appState.apiService)
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(viewModel.newRepoName.isEmpty || viewModel.newRepoPath.isEmpty)
            }
        }
        .padding()
        .frame(width: 400)
        .background(PopArtTheme.dark)
    }
}
