using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class ClassRepository : IClassRepository
{
    private readonly AppDbContext _context;

    public ClassRepository(AppDbContext context) => _context = context;

    public async Task<Class?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.Classes
            .Include(c => c.Students)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<IReadOnlyList<Class>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default) =>
        await _context.Classes
            .Include(c => c.Students)
            .Where(c => c.TeacherId == teacherId)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

    public async Task<Class> AddAsync(Class entity, CancellationToken ct = default)
    {
        _context.Classes.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }

    public async Task UpdateAsync(Class entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _context.Classes.Update(entity);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _context.Classes.FindAsync([id], ct);
        if (entity != null)
        {
            _context.Classes.Remove(entity);
            await _context.SaveChangesAsync(ct);
        }
    }
}
