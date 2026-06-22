import Foundation
import SwiftUI

@MainActor
class ReposViewModel: ObservableObject {
    @Published var repos: [Repo] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    @Published var showAddSheet: Bool = false

    @Published var newRepoName: String = ""
    @Published var newRepoPath: String = ""
    @Published var newRepoGitUrl: String = ""

    func load(api: APIService) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            repos = try await api.fetchRepos()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addRepo(api: APIService) async {
        let name = newRepoName.trimmingCharacters(in: .whitespacesAndNewlines)
        let path = newRepoPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !path.isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            let repo = try await api.addRepo(
                name: name,
                path: path,
                gitUrl: newRepoGitUrl.isEmpty ? nil : newRepoGitUrl
            )
            repos.append(repo)
            resetForm()
            showAddSheet = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteRepo(api: APIService, id: String) async {
        do {
            try await api.deleteRepo(id: id)
            repos.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reindexRepo(api: APIService, id: String) async {
        do {
            try await api.reindexRepo(id: id)
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func resetForm() {
        newRepoName = ""
        newRepoPath = ""
        newRepoGitUrl = ""
    }
}
