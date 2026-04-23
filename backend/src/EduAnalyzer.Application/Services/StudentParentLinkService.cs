using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;

namespace EduAnalyzer.Application.Services;

public interface IStudentParentLinkService
{
    Task<IReadOnlyList<ParentCandidateDto>> GetParentCandidatesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<StudentParentLinkDto>?> GetLinkedParentsAsync(Guid studentId, Guid teacherId, CancellationToken ct = default);
    Task<IReadOnlyList<StudentParentLinkDto>?> LinkParentAsync(Guid studentId, Guid parentId, Guid teacherId, CancellationToken ct = default);
    Task<bool> UnlinkParentAsync(Guid studentId, Guid parentId, Guid teacherId, CancellationToken ct = default);
}

public class StudentParentLinkService : IStudentParentLinkService
{
    private readonly IStudentRepository _studentRepo;
    private readonly IStudentParentRepository _linkRepo;
    private readonly IParentReadRepository _parentRepo;

    public StudentParentLinkService(
        IStudentRepository studentRepo,
        IStudentParentRepository linkRepo,
        IParentReadRepository parentRepo)
    {
        _studentRepo = studentRepo;
        _linkRepo = linkRepo;
        _parentRepo = parentRepo;
    }

    public async Task<IReadOnlyList<ParentCandidateDto>> GetParentCandidatesAsync(CancellationToken ct = default)
    {
        var parents = await _parentRepo.ListParentsWithUserAsync(ct);
        return parents
            .Select(p => new ParentCandidateDto(p.Id, p.User.Email, p.User.DisplayName))
            .ToList();
    }

    public async Task<IReadOnlyList<StudentParentLinkDto>?> GetLinkedParentsAsync(
        Guid studentId,
        Guid teacherId,
        CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null || student.TeacherId != teacherId)
            return null;

        var links = await _linkRepo.GetLinksWithParentAndUserAsync(studentId, ct);
        return links
            .Select(sp => new StudentParentLinkDto(
                sp.ParentId,
                sp.Parent.User.Email,
                sp.Parent.User.DisplayName,
                sp.IsPrimary))
            .ToList();
    }

    public async Task<IReadOnlyList<StudentParentLinkDto>?> LinkParentAsync(
        Guid studentId,
        Guid parentId,
        Guid teacherId,
        CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null || student.TeacherId != teacherId)
            return null;

        var parent = await _parentRepo.GetByIdWithUserAsync(parentId, ct);
        if (parent == null || parent.User.Role != UserRole.Parent)
            throw new InvalidOperationException("Geçersiz veli kaydı.");

        if (await _linkRepo.ExistsAsync(studentId, parentId, ct))
            return await GetLinkedParentsAsync(studentId, teacherId, ct);

        await _linkRepo.AddAsync(new StudentParent
        {
            StudentId = studentId,
            ParentId = parentId,
            IsPrimary = false,
            CreatedAt = DateTime.UtcNow
        }, ct);

        return await GetLinkedParentsAsync(studentId, teacherId, ct);
    }

    public async Task<bool> UnlinkParentAsync(
        Guid studentId,
        Guid parentId,
        Guid teacherId,
        CancellationToken ct = default)
    {
        var student = await _studentRepo.GetByIdAsync(studentId, ct);
        if (student == null || student.TeacherId != teacherId)
            return false;

        // İlişki yoksa bile 204 (idempotent silme); yetki öğrenci sahipliği ile sınırlı.
        await _linkRepo.DeleteAsync(studentId, parentId, ct);
        return true;
    }
}
