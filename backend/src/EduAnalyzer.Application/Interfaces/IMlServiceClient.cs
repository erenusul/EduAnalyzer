using EduAnalyzer.Application.DTOs;

namespace EduAnalyzer.Application.Interfaces;

/// <summary>
/// ML servisi (Python FastAPI) ile iletişim - PDF analizi ve soru tahmini.
/// </summary>
public interface IMlServiceClient
{
    Task<PdfAnalysisResponseDto> AnalyzePdfAsync(
        Stream fileStream,
        string fileName,
        bool useOcr = false,
        int topKSubject = 1,
        int topKTopic = 3,
        CancellationToken ct = default);

    Task<HealthCheckDto> CheckHealthAsync(CancellationToken ct = default);
}

public record HealthCheckDto(string Status, bool ModelLoaded, string? Message);
