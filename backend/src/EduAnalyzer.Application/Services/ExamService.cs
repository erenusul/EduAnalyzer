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
    Task<ExamResultDto> AddExamResultAsync(Guid teacherId, CreateExamResultRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByStudentAsync(Guid studentId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ExamResultDto>> GetResultsByExamAsync(Guid examId, Guid teacherId, CancellationToken ct = default);
}

public class ExamService : IExamService
{
    private readonly IExamRepository _examRepo;
    private readonly IExamResultRepository _resultRepo;
    private readonly IStudentRepository _studentRepo;

    public ExamService(
        IExamRepository examRepo,
        IExamResultRepository resultRepo,
        IStudentRepository studentRepo)
    {
        _examRepo = examRepo;
        _resultRepo = resultRepo;
        _studentRepo = studentRepo;
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

    private static ExamDto MapToDto(Exam e) => new(
        e.Id,
        e.AnalysisId,
        e.Title,
        e.WeekLabel,
        e.Date,
        e.Status.ToString().ToLowerInvariant(),
        e.CreatedAt
    );

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
