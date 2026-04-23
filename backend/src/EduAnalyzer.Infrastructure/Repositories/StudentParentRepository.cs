using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class StudentParentRepository : IStudentParentRepository
{
    private readonly AppDbContext _context;

    public StudentParentRepository(AppDbContext context) => _context = context;

    public async Task<IReadOnlyList<StudentParent>> GetLinksWithParentAndUserAsync(
        Guid studentId,
        CancellationToken ct = default) =>
        await _context.StudentParents
            .AsNoTracking()
            .Include(sp => sp.Parent)
            .ThenInclude(p => p.User)
            .Where(sp => sp.StudentId == studentId)
            .OrderBy(sp => sp.Parent.User.Email)
            .ToListAsync(ct);

    public async Task<bool> ExistsAsync(Guid studentId, Guid parentId, CancellationToken ct = default) =>
        await _context.StudentParents
            .AsNoTracking()
            .AnyAsync(sp => sp.StudentId == studentId && sp.ParentId == parentId, ct);

    public async Task AddAsync(StudentParent entity, CancellationToken ct = default)
    {
        _context.StudentParents.Add(entity);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteAsync(Guid studentId, Guid parentId, CancellationToken ct = default)
    {
        var n = await _context.StudentParents
            .Where(sp => sp.StudentId == studentId && sp.ParentId == parentId)
            .ExecuteDeleteAsync(ct);
        return n > 0;
    }
}
