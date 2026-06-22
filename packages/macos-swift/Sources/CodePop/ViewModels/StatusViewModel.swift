import Foundation

@MainActor
class StatusViewModel: ObservableObject {
    @Published var status: SystemStatus? = nil
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    func load(api: APIService) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            status = try await api.fetchHealth()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
