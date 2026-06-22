import Foundation

struct Repo: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let path: String
    let gitUrl: String?
    let status: String
    let fileCount: Int
    let symbolCount: Int
    let embeddingCount: Int
    let createdAt: String?
    let updatedAt: String?
    let indexingProgress: Int

    enum CodingKeys: String, CodingKey {
        case id, name, path
        case gitUrl = "git_url"
        case status
        case fileCount = "file_count"
        case symbolCount = "symbol_count"
        case embeddingCount = "embedding_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case indexingProgress = "indexing_progress"
    }
}

struct SearchResult: Identifiable, Codable, Equatable {
    let id: String
    let fileId: String
    let filePath: String
    let content: String
    let similarity: Double
    let language: String
    let symbols: [String]
    let line: Int
    let score: Double
    let scoreBreakdown: [String: Double]?

    enum CodingKeys: String, CodingKey {
        case id
        case fileId = "file_id"
        case filePath = "file_path"
        case content, similarity, language, symbols, line, score
        case scoreBreakdown = "score_breakdown"
    }
}

struct SystemStatus: Codable, Equatable {
    let status: String
    let version: String
    let uptime: Double
    let activeRequests: Int
    let indexingTasks: Int
    let degradedFeatures: [String]
    let metrics: [String: Double]

    enum CodingKeys: String, CodingKey {
        case status, version, uptime
        case activeRequests = "active_requests"
        case indexingTasks = "indexing_tasks"
        case degradedFeatures = "degraded_features"
        case metrics
    }
}

struct AddRepoRequest: Codable {
    let name: String
    let path: String
    let gitUrl: String?

    enum CodingKeys: String, CodingKey {
        case name, path
        case gitUrl = "git_url"
    }
}

struct SearchRequest: Codable {
    let query: String
    let repoId: String?
    let limit: Int

    enum CodingKeys: String, CodingKey {
        case query
        case repoId = "repo_id"
        case limit
    }
}

struct APIError: LocalizedError, Codable {
    let detail: String
    var errorDescription: String? { detail }
}
