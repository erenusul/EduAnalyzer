namespace EduAnalyzer.Application.DTOs;

public record ExamDto(
    Guid Id,
    Guid AnalysisId,
    string Title,
    string WeekLabel,
    DateTime Date,
    string Status,
    IReadOnlyList<string>? AnswerKey,
    IReadOnlyList<QuestionAnalysisResultDto>? SelectedResults,
    DateTime CreatedAt
);

public record ScanExamRequest(Guid StudentId, IReadOnlyList<string> StudentAnswers);

public record WrongQuestionDto(int QuestionIndex, string StudentAnswer, string Topic);

public record ScanExamResponse(
    int CorrectCount,
    int WrongCount,
    int TotalCount,
    IReadOnlyList<WrongQuestionDto> WrongQuestions,
    IReadOnlyList<WrongTopicDto> WrongTopics
);

public record StudentWithResultsDto(StudentDto Student, IReadOnlyList<ExamResultDto> Results);

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
    IReadOnlyList<WrongQuestionDto> WrongQuestions,
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

/// <summary>Öğretmenin manuel düzeltmesi (hatalı optik okuma vb.).</summary>
public record UpdateExamResultRequest(
    int CorrectCount,
    int WrongCount,
    IReadOnlyList<WrongTopicDto>? WrongTopics = null
);
