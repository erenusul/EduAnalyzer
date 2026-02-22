using System.Net.Http.Json;
using System.Text.Json;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EduAnalyzer.Infrastructure.Services;

public class MlServiceOptions
{
    public const string SectionName = "MlService";
    public string BaseUrl { get; set; } = "http://localhost:8000";
    public int TimeoutSeconds { get; set; } = 600;
}

public class MlServiceClient : IMlServiceClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MlServiceClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public MlServiceClient(HttpClient httpClient, IOptions<MlServiceOptions> options, ILogger<MlServiceClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        var baseUrl = options.Value.BaseUrl.TrimEnd('/');
        _httpClient.BaseAddress = new Uri(baseUrl + "/");
        _httpClient.Timeout = TimeSpan.FromSeconds(options.Value.TimeoutSeconds);
    }

    public async Task<PdfAnalysisResponseDto> AnalyzePdfAsync(
        Stream fileStream,
        string fileName,
        bool useOcr = false,
        int topKSubject = 1,
        int topKTopic = 3,
        CancellationToken ct = default)
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StreamContent(fileStream), "file", fileName);
        content.Add(new StringContent(useOcr.ToString()), "use_ocr");
        content.Add(new StringContent(topKSubject.ToString()), "top_k_subject");
        content.Add(new StringContent(topKTopic.ToString()), "top_k_topic");

        var response = await _httpClient.PostAsync("api/analyze-pdf", content, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);
        var raw = JsonSerializer.Deserialize<MlPdfAnalysisResponse>(json, JsonOptions)
            ?? throw new InvalidOperationException("ML servisi geçersiz yanıt döndü.");

        return MapToDto(raw);
    }

    public async Task<HealthCheckDto> CheckHealthAsync(CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync("health", ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        var raw = JsonSerializer.Deserialize<MlHealthResponse>(json, JsonOptions)
            ?? throw new InvalidOperationException("ML servisi geçersiz yanıt döndü.");
        return new HealthCheckDto(raw.Status, raw.ModelLoaded, raw.Message);
    }

    private static PdfAnalysisResponseDto MapToDto(MlPdfAnalysisResponse raw)
    {
        var results = raw.Results?.Select(r => new QuestionAnalysisResultDto(
            r.QuestionId,
            r.QuestionText,
            r.Subject?.Select(s => new PredictionItemDto(s.Label, s.Confidence)).ToList() ?? [],
            r.Topic?.Select(t => new PredictionItemDto(t.Label, t.Confidence)).ToList() ?? [],
            r.HasVisual
        )).ToList() ?? [];
        return new PdfAnalysisResponseDto(
            raw.TotalQuestions,
            raw.AnalyzedQuestions,
            results,
            raw.Warning
        );
    }

    private class MlPdfAnalysisResponse
    {
        public int TotalQuestions { get; set; }
        public int AnalyzedQuestions { get; set; }
        public List<MlQuestionResult>? Results { get; set; }
        public string? Warning { get; set; }
    }

    private class MlQuestionResult
    {
        public string QuestionId { get; set; } = "";
        public string QuestionText { get; set; } = "";
        public List<MlPredictionItem>? Subject { get; set; }
        public List<MlPredictionItem>? Topic { get; set; }
        public bool HasVisual { get; set; }
    }

    private class MlPredictionItem
    {
        public string Label { get; set; } = "";
        public double Confidence { get; set; }
    }

    private class MlHealthResponse
    {
        public string Status { get; set; } = "";
        public bool ModelLoaded { get; set; }
        public string? Message { get; set; }
    }
}
