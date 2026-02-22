using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class AnalysisRecordRepository : IAnalysisRecordRepository
{
    private readonly AppDbContext _context;

    public AnalysisRecordRepository(AppDbContext context) => _context = context;

    public async Task<AnalysisRecord?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.AnalysisRecords
            .Include(a => a.Exam)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

    public async Task<IReadOnlyList<AnalysisRecord>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default) =>
        await _context.AnalysisRecords
            .Include(a => a.Exam)
            .Where(a => a.TeacherId == teacherId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

    public async Task<AnalysisRecord> AddAsync(AnalysisRecord entity, CancellationToken ct = default)
    {
        _context.AnalysisRecords.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }

    public async Task UpdateAsync(AnalysisRecord entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _context.AnalysisRecords.Update(entity);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _context.AnalysisRecords.FindAsync([id], ct);
        if (entity != null)
        {
            _context.AnalysisRecords.Remove(entity);
            await _context.SaveChangesAsync(ct);
        }
    }
}
