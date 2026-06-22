import Foundation
import SwiftUI

@MainActor
class SearchViewModel: ObservableObject {
    @Published var query: String = ""
    @Published var results: [SearchResult] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    @Published var selectedRepoId: String? = nil

    func search(api: APIService) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            results = try await api.search(query: trimmed, repoId: selectedRepoId, limit: 20)
        } catch {
            errorMessage = error.localizedDescription
            results = []
        }
    }

    func clear() {
        query = ""
        results = []
        errorMessage = nil
    }
}
