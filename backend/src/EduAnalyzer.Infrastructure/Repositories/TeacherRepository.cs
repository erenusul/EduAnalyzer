using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class TeacherRepository : ITeacherRepository
{
    private readonly AppDbContext _context;

    public TeacherRepository(AppDbContext context) => _context = context;

    public async Task<Teacher?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.Teachers
            .Include(t => t.User)
            .Include(t => t.Classes)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<Teacher?> GetByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await _context.Teachers
            .Include(t => t.User)
            .Include(t => t.Classes)
            .FirstOrDefaultAsync(t => t.UserId == userId, ct);

    public async Task<Teacher> AddAsync(Teacher entity, CancellationToken ct = default)
    {
        _context.Teachers.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }
}
