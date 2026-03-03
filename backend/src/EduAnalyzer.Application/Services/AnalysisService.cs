using System.Text.Json;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;

namespace EduAnalyzer.Application.Services;

public interface IAnalysisService
{
    Task<AnalysisRecordDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<AnalysisRecordDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<AnalysisRecordDto> CreateFromSingleAsync(Guid teacherId, CreateSingleAnalysisRequest request, CancellationToken ct = default);
    Task<AnalysisRecordDto> CreateFromPdfAsync(
        Guid teacherId,
        string title,
        string? fileName,
        PdfAnalysisResponseDto mlResult,
        CancellationToken ct = default);
    Task<AnalysisRecordDto?> UpdateResultsAsync(Guid id, Guid teacherId, object results, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<ExamDto?> CreateExamFromAnalysisAsync(Guid analysisId, Guid teacherId, string weekLabel, DateTime date, int[]? selectedIndices = null, IReadOnlyList<string>? answerKey = null, CancellationToken ct = default);
    Task<ExamDto?> MarkExamReadyAsync(Guid examId, Guid teacherId, CancellationToken ct = default);
}

public class AnalysisService : IAnalysisService
{
    private readonly IAnalysisRecordRepository _analysisRepo;
    private readonly IExamRepository _examRepo;

    public AnalysisService(
        IAnalysisRecordRepository analysisRepo,
        IExamRepository examRepo)
    {
        _analysisRepo = analysisRepo;
        _examRepo = examRepo;
    }

    public async Task<AnalysisRecordDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var a = await _analysisRepo.GetByIdAsync(id, ct);
        if (a == null || a.TeacherId != teacherId) return null;
        return MapToDto(a);
    }

    public async Task<IReadOnlyList<AnalysisRecordDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _analysisRepo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<AnalysisRecordDto> CreateFromSingleAsync(Guid teacherId, CreateSingleAnalysisRequest request, CancellationToken ct = default)
    {
        var resultsJson = JsonSerializer.Serialize(request.Results);
        var entity = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            Type = AnalysisType.Single,
            Title = request.Title,
            Date = DateTime.UtcNow,
            TotalQuestions = 1,
            AnalyzedQuestions = 1,
            ResultsJson = resultsJson,
            CreatedAt = DateTime.UtcNow
        };
        var added = await _analysisRepo.AddAsync(entity, ct);
        return MapToDto(added);
    }

    public async Task<AnalysisRecordDto> CreateFromPdfAsync(
        Guid teacherId,
        string title,
        string? fileName,
        PdfAnalysisResponseDto mlResult,
        CancellationToken ct = default)
    {
        var resultsJson = JsonSerializer.Serialize(new
        {
            mlResult.TotalQuestions,
            mlResult.AnalyzedQuestions,
            mlResult.Results,
            mlResult.Warning
        });
        var entity = new AnalysisRecord
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            Type = AnalysisType.Pdf,
            Title = title,
            Date = DateTime.UtcNow,
            FileName = fileName,
            TotalQuestions = mlResult.TotalQuestions,
            AnalyzedQuestions = mlResult.AnalyzedQuestions,
            ResultsJson = resultsJson,
            CreatedAt = DateTime.UtcNow
        };
        var added = await _analysisRepo.AddAsync(entity, ct);
        return MapToDto(added);
    }

    public async Task<AnalysisRecordDto?> UpdateResultsAsync(Guid id, Guid teacherId, object results, CancellationToken ct = default)
    {
        var a = await _analysisRepo.GetByIdAsync(id, ct);
        if (a == null || a.TeacherId != teacherId) return null;
        a.ResultsJson = JsonSerializer.Serialize(results);
        await _analysisRepo.UpdateAsync(a, ct);
        return MapToDto(a);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var a = await _analysisRepo.GetByIdAsync(id, ct);
        if (a == null || a.TeacherId != teacherId) return false;
        await _analysisRepo.DeleteAsync(id, ct);
        return true;
    }

    public async Task<ExamDto?> CreateExamFromAnalysisAsync(Guid analysisId, Guid teacherId, string weekLabel, DateTime date, int[]? selectedIndices = null, IReadOnlyList<string>? answerKey = null, CancellationToken ct = default)
    {
        var a = await _analysisRepo.GetByIdAsync(analysisId, ct);
        if (a == null || a.TeacherId != teacherId) return null;
        var existing = await _examRepo.GetByAnalysisIdAsync(analysisId, ct);
        if (existing != null) return MapToDto(existing);

        string? selectedResultsJson = null;
        if (selectedIndices is { Length: > 0 })
        {
            var pdfResponse = JsonSerializer.Deserialize<PdfAnalysisResponseDto>(a.ResultsJson);
            var allResults = pdfResponse?.Results ?? new List<QuestionAnalysisResultDto>();
            var selected = selectedIndices
                .Where(i => i >= 0 && i < allResults.Count)
                .Select(i => allResults[i])
                .ToList();
            if (selected.Count > 0)
                selectedResultsJson = JsonSerializer.Serialize(selected);
        }

        var status = ExamStatus.Draft;
        string? answerKeyJson = null;
        if (answerKey is { Count: 20 })
        {
            var valid = new[] { "A", "B", "C", "D", "E" };
            var normalized = answerKey
                .Select(x => (x?.Trim().ToUpperInvariant() ?? "").FirstOrDefault().ToString())
                .Select(x => valid.Contains(x) ? x : "")
                .ToList();
            if (normalized.Count == 20)
            {
                answerKeyJson = JsonSerializer.Serialize(normalized);
                status = ExamStatus.Ready;
            }
        }

        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            AnalysisId = analysisId,
            TeacherId = teacherId,
            Title = a.Title,
            WeekLabel = weekLabel,
            Date = date,
            Status = status,
            SelectedResultsJson = selectedResultsJson,
            AnswerKeyJson = answerKeyJson,
            CreatedAt = DateTime.UtcNow
        };
        var added = await _examRepo.AddAsync(exam, ct);
        return MapToDto(added);
    }

    public async Task<ExamDto?> MarkExamReadyAsync(Guid examId, Guid teacherId, CancellationToken ct = default)
    {
        var e = await _examRepo.GetByIdAsync(examId, ct);
        if (e == null || e.TeacherId != teacherId) return null;
        e.Status = ExamStatus.Ready;
        await _examRepo.UpdateAsync(e, ct);
        return MapToDto(e);
    }

    private static AnalysisRecordDto MapToDto(AnalysisRecord a)
    {
        var results = JsonSerializer.Deserialize<object>(a.ResultsJson) ?? new object();
        var exam = a.Exam;
        return new AnalysisRecordDto(
            a.Id,
            a.Type.ToString().ToLowerInvariant(),
            a.Title,
            a.Date,
            a.FileName,
            a.TotalQuestions,
            a.AnalyzedQuestions,
            results,
            exam?.Id,
            a.CreatedAt
        );
    }

    private static ExamDto MapToDto(Exam e)
    {
        var answerKey = string.IsNullOrEmpty(e.AnswerKeyJson)
            ? null
            : JsonSerializer.Deserialize<List<string>>(e.AnswerKeyJson) as IReadOnlyList<string>;
        var selectedResults = string.IsNullOrEmpty(e.SelectedResultsJson)
            ? null
            : JsonSerializer.Deserialize<List<QuestionAnalysisResultDto>>(e.SelectedResultsJson) as IReadOnlyList<QuestionAnalysisResultDto>;
        return new ExamDto(
            e.Id,
            e.AnalysisId,
            e.Title,
            e.WeekLabel,
            e.Date,
            e.Status.ToString().ToLowerInvariant(),
            answerKey,
            selectedResults,
            e.CreatedAt
        );
    }
}
