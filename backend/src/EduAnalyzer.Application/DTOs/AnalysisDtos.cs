namespace EduAnalyzer.Application.DTOs;

public record PredictionItemDto(string Label, double Confidence);

public record QuestionAnalysisResultDto(
    string QuestionId,
    string QuestionText,
    IReadOnlyList<PredictionItemDto> Subject,
    IReadOnlyList<PredictionItemDto> Topic,
    bool HasVisual
);

public record PdfAnalysisResponseDto(
    int TotalQuestions,
    int AnalyzedQuestions,
    IReadOnlyList<QuestionAnalysisResultDto> Results,
    string? Warning
);

public record AnalysisRecordDto(
    Guid Id,
    string Type,
    string Title,
    DateTime Date,
    string? FileName,
    int TotalQuestions,
    int AnalyzedQuestions,
    object Results,
    Guid? ExamId,
    DateTime CreatedAt
);

public record CreateSingleAnalysisRequest(string Title, object Results);

public record CreateAnalysisRequest(
    string Type,
    string Title,
    string? FileName,
    int TotalQuestions,
    int AnalyzedQuestions,
    object Results
);
