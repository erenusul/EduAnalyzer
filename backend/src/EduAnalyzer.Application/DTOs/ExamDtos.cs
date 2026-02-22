namespace EduAnalyzer.Application.DTOs;

public record ExamDto(
    Guid Id,
    Guid AnalysisId,
    string Title,
    string WeekLabel,
    DateTime Date,
    string Status,
    DateTime CreatedAt
);

public record ExamResultDto(
    Guid Id,
    Guid StudentId,
    string? StudentName,
    string? StudentNo,
    Guid ExamId,
    string? ExamTitle,
    int CorrectCount,
    int WrongCount,
    IReadOnlyList<WrongTopicDto> WrongTopics,
    string? Source,
    DateTime CreatedAt
);

public record CreateExamResultRequest(
    Guid StudentId,
    Guid ExamId,
    int CorrectCount,
    int WrongCount,
    IReadOnlyList<WrongTopicDto> WrongTopics,
    string? Source = "manual"
);
