using System.Text.Json;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Domain.ValueObjects;

namespace EduAnalyzer.Application.Services;

public interface IExamService
{
    Task<ExamDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<ExamDto?> GetByAnalysisIdAsync(Guid analysisId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamDto>> GetExamsAvailableForStudentAsync(Guid studentId, CancellationToken ct = default);
    Task<ExamDto?> UpdateAnswerKeyAsync(Guid examId, Guid teacherId, IReadOnlyList<string> answerKey, CancellationToken ct = default);
    Task<ScanExamResponse> ScanAndSaveResultAsync(Guid examId, Guid teacherId, ScanExamRequest request, CancellationToken ct = default);
    Task<ScanExamResponse> SubmitScanForStudentAsync(Guid examId, Guid studentId, Stream imageStream, int? questionCount, CancellationToken ct = default);
    Task<ExamResultDto> AddExamResultAsync(Guid teacherId, CreateExamResultRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentAsync(Guid studentId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentForSelfAsync(Guid studentId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentWithResultsDto>> GetStudentsWithResultsForParentAsync(Guid parentId, CancellationToken ct = default);
}

public class ExamService : IExamService
{
    private readonly IExamRepository _examRepo;
    private readonly IExamResultRepository _resultRepo;
    private readonly IStudentRepository _studentRepo;
    private readonly IMlServiceClient _mlClient;

    public ExamService(
        IExamRepository examRepo,
        IExamResultRepository resultRepo,
        IStudentRepository studentRepo,
        IMlServiceClient mlClient)
    {
        _examRepo = examRepo;
        _resultRepo = resultRepo;
        _studentRepo = studentRepo;
        _mlClient = mlClient;
    }

    public async Task<ExamDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var e = await _examRepo.GetByIdAsync(id, ct);
        if (e == null || e.TeacherId != teacherId) return null;
        return MapToDto(e);
    }

    public async Task<ExamDto?> GetByAnalysisIdAsync(Guid analysisId, Guid teacherId, CancellationToken ct = default)
    {
        var e = await _examRepo.GetByAnalysisIdAsync(analysisId, ct);
        if (e == null || e.TeacherId != teacherId) return null;
        return MapToDto(e);
    }

    public async Task<IReadOnlyList<ExamDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _examRepo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<ExamDto>> GetExamsAvailableForStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null) return [];

        var exams = await _examRepo.GetByTeacherIdAsync(student.TeacherId, ct);
        var results = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        var submittedExamIds = results.Select(r => r.ExamId).ToHashSet();

        return exams
            .Where(e =>
                e.Status == ExamStatus.Ready &&
                !submittedExamIds.Contains(e.Id) &&
                (e.Analysis.ClassId == null || e.Analysis.ClassId == student.ClassId))
            .Select(MapToDto)
            .ToList();
    }

    public async Task<ExamResultDto> AddExamResultAsync(Guid teacherId, CreateExamResultRequest request, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(request.ExamId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Sınav bulunamadı veya yetkiniz yok.");

        var student = await _studentRepo.GetByIdAsync(request.StudentId, ct);
        if (student == null || student.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Öğrenci bulunamadı veya yetkiniz yok.");

        var wrongTopicsJson = JsonSerializer.Serialize(request.WrongTopics.Select(w => new { w.Topic, w.Count }));
        var entity = new ExamResult
        {
            Id = Guid.NewGuid(),
            StudentId = request.StudentId,
            ExamId = request.ExamId,
            CorrectCount = request.CorrectCount,
            WrongCount = request.WrongCount,
            WrongTopicsJson = wrongTopicsJson,
            Source = request.Source ?? "manual",
            CreatedAt = DateTime.UtcNow
        };
        var added = await _resultRepo.AddAsync(entity, ct);
        return MapResultToDto(added, student, exam);
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentAsync(Guid studentId, Guid teacherId, CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null || student.TeacherId != teacherId) return [];
        var list = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        return list.Select(r => MapResultToDto(r, student, r.Exam)).ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId) return [];
        var list = await _resultRepo.GetByExamIdAsync(examId, ct);
        return list.Select(r => MapResultToDto(r, r.Student, exam)).ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _resultRepo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(r => MapResultToDto(r, r.Student, r.Exam)).ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentForSelfAsync(Guid studentId, CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null) return [];
        var list = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        return list.Select(r => MapResultToDto(r, student, r.Exam)).ToList();
    }

    public async Task<IReadOnlyList<StudentWithResultsDto>> GetStudentsWithResultsForParentAsync(Guid parentId, CancellationToken ct = default)
    {
        var students = await _studentRepo.GetByParentIdAsync(parentId, ct);
        var result = new List<StudentWithResultsDto>();
        foreach (var student in students)
        {
            var results = await _resultRepo.GetByStudentIdAsync(student.Id, ct);
            var dtos = results.Select(r => MapResultToDto(r, student, r.Exam)).ToList();
            result.Add(new StudentWithResultsDto(StudentService.MapToDto(student), dtos));
        }
        return result;
    }

    public async Task<ExamDto?> UpdateAnswerKeyAsync(Guid examId, Guid teacherId, IReadOnlyList<string> answerKey, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId) return null;

        var validAnswers = new[] { "A", "B", "C", "D", "E" };
        var normalized = answerKey
            .Select(a =>
            {
                var s = (a?.Trim().ToUpperInvariant() ?? "");
                var c = s.Length > 0 ? s[0].ToString() : "";
                return validAnswers.Contains(c) ? c : "";
            })
            .ToList();

        exam.AnswerKeyJson = JsonSerializer.Serialize(normalized);
        await _examRepo.UpdateAsync(exam, ct);
        return MapToDto(exam);
    }

    public async Task<ScanExamResponse> ScanAndSaveResultAsync(Guid examId, Guid teacherId, ScanExamRequest request, CancellationToken ct = default)
    {
        var exam = await _examRepo.GetByIdAsync(examId, ct);
        if (exam == null || exam.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Sınav bulunamadı veya yetkiniz yok.");

        var answerKey = string.IsNullOrEmpty(exam.AnswerKeyJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(exam.AnswerKeyJson) ?? new List<string>();

        if (answerKey.Count == 0)
            throw new InvalidOperationException("Bu sınav için cevap anahtarı tanımlanmamış.");

        var student = await _studentRepo.GetByIdAsync(request.StudentId, ct);
        if (student == null || student.TeacherId != teacherId)
            throw new UnauthorizedAccessException("Öğrenci bulunamadı veya yetkiniz yok.");

        List<QuestionAnalysisResultDto> results;
        if (!string.IsNullOrEmpty(exam.SelectedResultsJson))
        {
            results = JsonSerializer.Deserialize<List<QuestionAnalysisResultDto>>(exam.SelectedResultsJson) ?? new List<QuestionAnalysisResultDto>();
        }
        else
        {
            var analysis = exam.Analysis;
            var pdfResponse = JsonSerializer.Deserialize<PdfAnalysisResponseDto>(analysis.ResultsJson);
            results = (pdfResponse?.Results ?? new List<QuestionAnalysisResultDto>()).ToList();
        }

        var wrongQuestions = new List<WrongQuestionDto>();
        var topicCounts = new Dictionary<string, int>();
        var correctCount = 0;
        var wrongCount = 0;

        for (var i = 0; i < Math.Max(answerKey.Count, request.StudentAnswers.Count); i++)
        {
            var correctAnswer = i < answerKey.Count ? (answerKey[i]?.Trim().ToUpperInvariant() ?? "") : "";
            var studentAnswer = i < request.StudentAnswers.Count ? (request.StudentAnswers[i]?.Trim().ToUpperInvariant() ?? "") : "";

            if (string.IsNullOrEmpty(correctAnswer)) continue;

            var studentChar = studentAnswer.Length > 0 ? studentAnswer[0].ToString() : "";
            var isCorrect = correctAnswer.Length > 0 && string.Equals(correctAnswer, studentChar, StringComparison.OrdinalIgnoreCase);

            if (isCorrect)
                correctCount++;
            else
            {
                wrongCount++;
                var topic = i < results.Count && results[i].Topic.Count > 0 ? results[i].Topic[0].Label : "Bilinmiyor";
                wrongQuestions.Add(new WrongQuestionDto(i + 1, studentAnswer, topic));
                topicCounts[topic] = topicCounts.GetValueOrDefault(topic, 0) + 1;
            }
        }

        var wrongTopics = topicCounts.Select(kv => new WrongTopicDto(kv.Key, kv.Value)).ToList();
        var wrongTopicsJson = JsonSerializer.Serialize(wrongTopics.Select(w => new { w.Topic, w.Count }));

        var entity = new ExamResult
        {
            Id = Guid.NewGuid(),
            StudentId = request.StudentId,
            ExamId = examId,
            CorrectCount = correctCount,
            WrongCount = wrongCount,
            WrongTopicsJson = wrongTopicsJson,
            Source = "optical",
            CreatedAt = DateTime.UtcNow
        };
        await _resultRepo.AddAsync(entity, ct);

        return new ScanExamResponse(
            correctCount,
            wrongCount,
            answerKey.Count,
            wrongQuestions,
            wrongTopics
        );
    }

    public async Task<ScanExamResponse> SubmitScanForStudentAsync(
        Guid examId,
        Guid studentId,
        Stream imageStream,
        int? questionCount,
        CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct)
            ?? throw new UnauthorizedAccessException("Öğrenci bulunamadı.");

        var exam = await _examRepo.GetByIdAsync(examId, ct)
            ?? throw new KeyNotFoundException("Sınav bulunamadı.");

        if (exam.TeacherId != student.TeacherId)
            throw new UnauthorizedAccessException("Bu sınava erişim yetkiniz yok.");

        if (exam.Status != ExamStatus.Ready)
            throw new InvalidOperationException("Bu sınav henüz cevap gönderimine açık değil.");

        if (exam.Analysis.ClassId != null && exam.Analysis.ClassId != student.ClassId)
            throw new UnauthorizedAccessException("Bu sınav sizin sınıfınıza ait değil.");

        var existingResults = await _resultRepo.GetByStudentIdAsync(studentId, ct);
        if (existingResults.Any(r => r.ExamId == examId))
            throw new InvalidOperationException("Bu sınav için sonucunuz zaten kaydedilmiş.");

        var answerKey = string.IsNullOrEmpty(exam.AnswerKeyJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(exam.AnswerKeyJson) ?? new List<string>();

        var count = questionCount ?? answerKey.Count;
        if (count <= 0)
            count = 20;

        var ocrResult = await _mlClient.ScanOpticalFormAsync(imageStream, count, ct);
        return await ScanAndSaveResultAsync(
            examId,
            exam.TeacherId,
            new ScanExamRequest(studentId, ocrResult.Answers),
            ct
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

    private static ExamResultDto MapResultToDto(ExamResult r, Student s, Exam e)
    {
        var topics = JsonSerializer.Deserialize<List<WrongTopicDto>>(r.WrongTopicsJson)
            ?? new List<WrongTopicDto>();
        return new ExamResultDto(
            r.Id,
            r.StudentId,
            $"{s.FirstName} {s.LastName}",
            s.StudentNo,
            r.ExamId,
            e.Title,
            r.CorrectCount,
            r.WrongCount,
            topics,
            r.Source,
            r.CreatedAt
        );
    }
}
