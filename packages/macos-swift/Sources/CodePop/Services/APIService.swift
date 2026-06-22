import Foundation
import Combine

@MainActor
class APIService: ObservableObject {
    @Published var baseURL: String
    @Published var isReachable: Bool = false

    init(baseURL: String) {
        self.baseURL = baseURL
    }

    func updateBaseURL(_ url: String) {
        self.baseURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func makeRequest(path: String, method: String = "GET", body: Data? = nil) async throws -> (Data, URLResponse) {
        guard let url = URL(string: baseURL + path) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        if let body = body {
            request.httpBody = body
        }

        return try await URLSession.shared.data(for: request)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data, response: URLResponse) throws -> T {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if httpResponse.statusCode >= 400 {
            if let apiError = try? JSONDecoder().decode(APIError.self, from: data) {
                throw apiError
            }
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    func fetchHealth() async throws -> SystemStatus {
        let (data, response) = try await makeRequest(path: "/health")
        return try decode(SystemStatus.self, from: data, response: response)
    }

    func checkHealth() async {
        do {
            _ = try await fetchHealth()
            isReachable = true
        } catch {
            isReachable = false
        }
    }

    func fetchRepos() async throws -> [Repo] {
        let (data, response) = try await makeRequest(path: "/repos")
        return try decode([Repo].self, from: data, response: response)
    }

    func addRepo(name: String, path: String, gitUrl: String?) async throws -> Repo {
        let request = AddRepoRequest(name: name, path: path, gitUrl: gitUrl)
        let body = try JSONEncoder().encode(request)
        let (data, response) = try await makeRequest(path: "/repos", method: "POST", body: body)
        return try decode(Repo.self, from: data, response: response)
    }

    func deleteRepo(id: String) async throws {
        let (_, response) = try await makeRequest(path: "/repos/\(id)", method: "DELETE")
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode < 400 else {
            throw URLError(.badServerResponse)
        }
    }

    func reindexRepo(id: String) async throws {
        let (_, response) = try await makeRequest(path: "/repos/\(id)/index", method: "POST")
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode < 400 else {
            throw URLError(.badServerResponse)
        }
    }

    func search(query: String, repoId: String? = nil, limit: Int = 20) async throws -> [SearchResult] {
        let request = SearchRequest(query: query, repoId: repoId, limit: limit)
        let body = try JSONEncoder().encode(request)
        let (data, response) = try await makeRequest(path: "/search", method: "POST", body: body)
        return try decode([SearchResult].self, from: data, response: response)
    }
}
