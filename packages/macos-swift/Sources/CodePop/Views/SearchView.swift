import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = SearchViewModel()
    @State private var repos: [Repo] = []

    var body: some View {
        VStack(spacing: 0) {
            header
            searchBar
            repoFilter
            resultsList
        }
        .background(PopArtTheme.dark.ignoresSafeArea())
        .task {
            await loadRepos()
        }
    }

    private var header: some View {
        HStack {
            Text("代码搜索")
                .font(PopArtTheme.titleFont)
                .foregroundColor(.white)
            Spacer()
            Text("CodePop")
                .font(PopArtTheme.headlineFont)
                .foregroundColor(PopArtTheme.primary)
        }
        .padding()
        .background(PopArtTheme.cardBackground)
    }

    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(PopArtTheme.secondary)
            TextField("搜索代码、函数、符号...", text: $viewModel.query)
                .font(PopArtTheme.bodyFont)
                .textFieldStyle(.plain)
                .onSubmit {
                    Task { await viewModel.search(api: appState.apiService) }
                }
            if viewModel.isLoading {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(PopArtTheme.accent)
            }
            Button(action: {
                Task { await viewModel.search(api: appState.apiService) }
            }) {
                Text("搜索")
                    .font(PopArtTheme.bodyFont)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(PopArtTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(viewModel.query.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding()
        .background(PopArtTheme.surface)
        .cornerRadius(12)
        .padding()
    }

    private var repoFilter: some View {
        HStack {
            Text("仓库筛选:")
                .font(PopArtTheme.bodyFont)
                .foregroundColor(.secondary)
            Picker("", selection: $viewModel.selectedRepoId) {
                Text("全部仓库").tag(nil as String?)
                ForEach(repos) { repo in
                    Text(repo.name).tag(repo.id as String?)
                }
            }
            .pickerStyle(.menu)
            .frame(width: 200)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    private var resultsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundColor(PopArtTheme.primary)
                        .padding()
                }

                if viewModel.results.isEmpty && !viewModel.isLoading && viewModel.errorMessage == nil && !viewModel.query.isEmpty {
                    Text("暂无结果")
                        .foregroundColor(.secondary)
                        .padding(.top, 40)
                }

                ForEach(viewModel.results) { result in
                    SearchResultCard(result: result)
                }
            }
            .padding()
        }
    }

    private func loadRepos() async {
        do {
            repos = try await appState.apiService.fetchRepos()
        } catch {
            repos = []
        }
    }
}

struct SearchResultCard: View {
    let result: SearchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(result.filePath)
                    .font(PopArtTheme.captionFont)
                    .foregroundColor(PopArtTheme.accent)
                Spacer()
                Text(result.language.uppercased())
                    .font(PopArtTheme.captionFont)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(PopArtTheme.secondary.opacity(0.2))
                    .foregroundColor(PopArtTheme.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Text(String(format: "%.2f", result.score))
                    .font(PopArtTheme.captionFont)
                    .foregroundColor(PopArtTheme.success)
            }

            Text(result.content)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(.white.opacity(0.9))
                .lineLimit(6)

            if !result.symbols.isEmpty {
                HStack(spacing: 6) {
                    ForEach(result.symbols.prefix(4), id: \.self) { symbol in
                        Text(symbol)
                            .font(PopArtTheme.captionFont)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(PopArtTheme.primary.opacity(0.15))
                            .foregroundColor(PopArtTheme.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }
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
