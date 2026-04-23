using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class ParentReadRepository : IParentReadRepository
{
    private readonly AppDbContext _context;

    public ParentReadRepository(AppDbContext context) => _context = context;

    public async Task<Parent?> GetByIdWithUserAsync(Guid parentId, CancellationToken ct = default) =>
        await _context.Parents
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == parentId, ct);

    public async Task<IReadOnlyList<Parent>> ListParentsWithUserAsync(CancellationToken ct = default) =>
        await _context.Parents
            .AsNoTracking()
            .Include(p => p.User)
            .Where(p => p.User.Role == UserRole.Parent)
            .OrderBy(p => p.User.Email)
            .ToListAsync(ct);
}
