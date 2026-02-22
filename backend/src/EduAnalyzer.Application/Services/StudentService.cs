using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;

namespace EduAnalyzer.Application.Services;

public interface IStudentService
{
    Task<StudentDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentDto>> GetByClassAsync(Guid classId, Guid teacherId, CancellationToken ct = default);
    Task<StudentDto> CreateAsync(Guid teacherId, CreateStudentRequest request, CancellationToken ct = default);
    Task<StudentDto?> UpdateAsync(Guid id, Guid teacherId, UpdateStudentRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<bool> AssignToClassAsync(Guid studentId, Guid? classId, Guid teacherId, CancellationToken ct = default);
}

public class StudentService : IStudentService
{
    private readonly IStudentRepository _repo;
    private readonly IClassRepository _classRepo;

    public StudentService(IStudentRepository repo, IClassRepository classRepo)
    {
        _repo = repo;
        _classRepo = classRepo;
    }

    public async Task<StudentDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(id, ct);
        if (s == null || s.TeacherId != teacherId) return null;
        return MapToDto(s);
    }

    public async Task<IReadOnlyList<StudentDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _repo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<StudentDto>> GetByClassAsync(Guid classId, Guid teacherId, CancellationToken ct = default)
    {
        var cls = await _classRepo.GetByIdAsync(classId, ct);
        if (cls == null || cls.TeacherId != teacherId) return [];
        var list = await _repo.GetByClassIdAsync(classId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<StudentDto> CreateAsync(Guid teacherId, CreateStudentRequest request, CancellationToken ct = default)
    {
        var entity = new Student
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            StudentNo = request.StudentNo,
            FirstName = request.FirstName,
            LastName = request.LastName,
            ClassId = request.ClassId,
            Email = request.Email,
            Phone = request.Phone,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };
        var added = await _repo.AddAsync(entity, ct);
        return MapToDto(added);
    }

    public async Task<StudentDto?> UpdateAsync(Guid id, Guid teacherId, UpdateStudentRequest request, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(id, ct);
        if (s == null || s.TeacherId != teacherId) return null;
        if (request.StudentNo != null) s.StudentNo = request.StudentNo;
        if (request.FirstName != null) s.FirstName = request.FirstName;
        if (request.LastName != null) s.LastName = request.LastName;
        if (request.ClassId != null) s.ClassId = request.ClassId;
        if (request.Email != null) s.Email = request.Email;
        if (request.Phone != null) s.Phone = request.Phone;
        if (request.Notes != null) s.Notes = request.Notes;
        await _repo.UpdateAsync(s, ct);
        return MapToDto(s);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(id, ct);
        if (s == null || s.TeacherId != teacherId) return false;
        await _repo.DeleteAsync(id, ct);
        return true;
    }

    public async Task<bool> AssignToClassAsync(Guid studentId, Guid? classId, Guid teacherId, CancellationToken ct = default)
    {
        var s = await _repo.GetByIdAsync(studentId, ct);
        if (s == null || s.TeacherId != teacherId) return false;
        if (classId.HasValue)
        {
            var cls = await _classRepo.GetByIdAsync(classId.Value, ct);
            if (cls == null || cls.TeacherId != teacherId) return false;
        }
        s.ClassId = classId;
        await _repo.UpdateAsync(s, ct);
        return true;
    }

    private static StudentDto MapToDto(Student s) => new(
        s.Id,
        s.StudentNo,
        s.FirstName,
        s.LastName,
        s.ClassId,
        s.Class?.Name,
        s.Email,
        s.Phone,
        s.Notes,
        s.CreatedAt
    );
}
