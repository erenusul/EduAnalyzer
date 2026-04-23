using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
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
        // ByteArrayContent kullan - Stream bazı senaryolarda düzgün iletilmeyebilir
        await using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(bytes), "file", fileName);
        content.Add(new StringContent(useOcr ? "true" : "false"), "use_ocr");
        content.Add(new StringContent(topKSubject.ToString()), "top_k_subject");
        content.Add(new StringContent(topKTopic.ToString()), "top_k_topic");

        var response = await _httpClient.PostAsync("api/analyze-pdf", content, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var detail = json;
            try
            {
                var err = JsonSerializer.Deserialize<MlErrorResponse>(json, JsonOptions);
                detail = err?.Detail ?? json;
            }
            catch { /* use raw json */ }
            throw new HttpRequestException(detail);
        }

        var raw = JsonSerializer.Deserialize<MlPdfAnalysisResponse>(json, JsonOptions)
            ?? throw new InvalidOperationException("ML servisi geçersiz yanıt döndü.");

        return MapToDto(raw);
    }

    public async Task<OpticalScanResultDto> ScanOpticalFormAsync(
        Stream imageStream,
        int questionCount = 20,
        int? optionCount = null,
        string? imageContentType = null,
        string? opticalTemplate = null,
        CancellationToken ct = default)
    {
        await using var ms = new MemoryStream();
        await imageStream.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        var optCount = optionCount ?? 5;
        optCount = Math.Clamp(optCount, 4, 5);

        var partMedia = NormalizeOpticalImageMediaType(imageContentType);
        var fileName = partMedia.Contains("png", StringComparison.OrdinalIgnoreCase)
            ? "optical-form.png"
            : "optical-form.jpg";

        using var content = new MultipartFormDataContent();
        var imagePart = new ByteArrayContent(bytes);
        imagePart.Headers.ContentType = new MediaTypeHeaderValue(partMedia);
        content.Add(imagePart, "file", fileName);
        content.Add(new StringContent(questionCount.ToString()), "question_count");
        content.Add(new StringContent(optCount.ToString()), "option_count");
        if (!string.IsNullOrWhiteSpace(opticalTemplate))
            content.Add(new StringContent(opticalTemplate.Trim()), "template");

        var response = await _httpClient.PostAsync("api/optical-scan", content, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var detail = json;
            try
            {
                var err = JsonSerializer.Deserialize<MlErrorResponse>(json, JsonOptions);
                detail = err?.Detail ?? json;
            }
            catch { /* use raw json */ }
            throw new HttpRequestException(detail);
        }

        var raw = JsonSerializer.Deserialize<MlOpticalScanResponse>(json, JsonOptions)
            ?? throw new InvalidOperationException("ML servisi geçersiz yanıt döndü.");

        var perQuestion = (raw.PerQuestion ?? [])
            .Select(p => new OpticalPerQuestionReadDto(
                p.Answer ?? "",
                p.Status ?? "",
                p.Confidence))
            .ToList();

        return new OpticalScanResultDto(
            raw.Answers ?? [],
            raw.QuestionCount,
            raw.MarkersDetected,
            raw.PerspectiveOk,
            perQuestion,
            raw.ScanMetadata);
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

    /// <summary>
    /// ML API (FastAPI) multipart parçasında image/* Content-Type bekler; boş bırakılırsa istek reddedilir.
    /// </summary>
    private static string NormalizeOpticalImageMediaType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
            return "image/jpeg";

        var main = contentType.Split(';', 2)[0].Trim().ToLowerInvariant();
        if (main is "image/jpg" or "image/pjpeg")
            return "image/jpeg";
        if (main.StartsWith("image/", StringComparison.Ordinal) && main.Length > "image/".Length)
            return main;

        return "image/jpeg";
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

    private class MlErrorResponse
    {
        public string? Detail { get; set; }
    }

    private class MlOpticalScanResponse
    {
        public List<string>? Answers { get; set; }
        public int QuestionCount { get; set; }
        public bool? MarkersDetected { get; set; }
        public bool? PerspectiveOk { get; set; }
        public List<MlOpticalPerQuestion>? PerQuestion { get; set; }

        [JsonPropertyName("scan_metadata")]
        public JsonElement? ScanMetadata { get; set; }
    }

    private class MlOpticalPerQuestion
    {
        public string? Answer { get; set; }
        public string? Status { get; set; }
        public double Confidence { get; set; }
    }
}
