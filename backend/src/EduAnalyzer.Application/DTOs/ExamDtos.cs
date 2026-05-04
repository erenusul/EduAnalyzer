using System.Text.Json;

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

/// <summary>Öğretmen panelinde sınav başlığı / hafta güncellemesi. Alan null ise değiştirilmez.</summary>
public record PatchExamRequest(string? Title = null, string? WeekLabel = null);

public record ScanExamRequest(Guid StudentId, IReadOnlyList<string> StudentAnswers);

/// <summary>Optik taramada &quot;Belirsiz veya boş okuma&quot; maddeleri için öğrenci elle cevap düzeltmesi.</summary>
public record ApplyOpticalReadingCorrectionsRequest(IReadOnlyList<OpticalReadingCorrectionItemDto> Corrections);

public record OpticalReadingCorrectionItemDto(int QuestionIndex, string? Answer);

/// <summary>ML optical-scan yanıtındaki tek soru satırı.</summary>
public record OpticalPerQuestionReadDto(string Answer, string Status, double Confidence);

/// <summary>ML optical-scan tam yanıtı (scan_metadata: Türkçe sütun hizalama vb.).</summary>
public record OpticalScanResultDto(
    IReadOnlyList<string> Answers,
    int QuestionCount,
    bool? MarkersDetected = null,
    bool? PerspectiveOk = null,
    IReadOnlyList<OpticalPerQuestionReadDto>? PerQuestion = null,
    JsonElement? ScanMetadata = null);

/// <param name="ExpectedAnswer">Yanlış sorularda cevap anahtarındaki doğru şık (optik karşılaştırma için).</param>
public record WrongQuestionDto(int QuestionIndex, string StudentAnswer, string Topic, string? ExpectedAnswer = null);

/// <summary>Optik okumada öğretmen incelemesi önerilen soru (düşük güven veya belirsiz durum).</summary>
public record SuspiciousQuestionHintDto(int QuestionIndex, double Confidence, string? Status, string? Reason);

public record ScanExamResponse(
    int CorrectCount,
    int WrongCount,
    int TotalCount,
    IReadOnlyList<WrongQuestionDto> CorrectQuestions,
    IReadOnlyList<WrongQuestionDto> WrongQuestions,
    IReadOnlyList<WrongTopicDto> WrongTopics,
    IReadOnlyList<SuspiciousQuestionHintDto> SuspiciousQuestions,
    Guid ExamResultId
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
    IReadOnlyList<WrongQuestionDto> CorrectQuestions,
    IReadOnlyList<WrongQuestionDto> WrongQuestions,
    string? Source,
    DateTime CreatedAt,
    IReadOnlyList<SuspiciousQuestionHintDto> SuspiciousQuestions,
    DateTime? SuspiciousReviewedAt
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
    int? CorrectCount = null,
    int? WrongCount = null,
    IReadOnlyList<WrongTopicDto>? WrongTopics = null,
    bool? AcknowledgeSuspiciousReview = null
);
