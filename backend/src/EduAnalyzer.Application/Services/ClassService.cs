using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;

namespace EduAnalyzer.Application.Services;

public interface IClassService
{
    Task<ClassDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<ClassDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default);
    Task<ClassDto> CreateAsync(Guid teacherId, CreateClassRequest request, CancellationToken ct = default);
    Task<ClassDto?> UpdateAsync(Guid id, Guid teacherId, UpdateClassRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default);
}

public class ClassService : IClassService
{
    private readonly IClassRepository _repo;

    public ClassService(IClassRepository repo) => _repo = repo;

    public async Task<ClassDto?> GetByIdAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var c = await _repo.GetByIdAsync(id, ct);
        if (c == null || c.TeacherId != teacherId) return null;
        return MapToDto(c);
    }

    public async Task<IReadOnlyList<ClassDto>> GetByTeacherAsync(Guid teacherId, CancellationToken ct = default)
    {
        var list = await _repo.GetByTeacherIdAsync(teacherId, ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<ClassDto> CreateAsync(Guid teacherId, CreateClassRequest request, CancellationToken ct = default)
    {
        var entity = new Class
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            Name = request.Name,
            Grade = request.Grade,
            AcademicYear = request.AcademicYear,
            CreatedAt = DateTime.UtcNow
        };
        var added = await _repo.AddAsync(entity, ct);
        return MapToDto(added);
    }

    public async Task<ClassDto?> UpdateAsync(Guid id, Guid teacherId, UpdateClassRequest request, CancellationToken ct = default)
    {
        var c = await _repo.GetByIdAsync(id, ct);
        if (c == null || c.TeacherId != teacherId) return null;
        if (request.Name != null) c.Name = request.Name;
        if (request.Grade != null) c.Grade = request.Grade;
        if (request.AcademicYear != null) c.AcademicYear = request.AcademicYear;
        await _repo.UpdateAsync(c, ct);
        return MapToDto(c);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid teacherId, CancellationToken ct = default)
    {
        var c = await _repo.GetByIdAsync(id, ct);
        if (c == null || c.TeacherId != teacherId) return false;
        await _repo.DeleteAsync(id, ct);
        return true;
    }

    private static ClassDto MapToDto(Class c) => new(
        c.Id,
        c.Name,
        c.Grade,
        c.AcademicYear,
        c.Students?.Count ?? 0,
        c.CreatedAt
    );
}
