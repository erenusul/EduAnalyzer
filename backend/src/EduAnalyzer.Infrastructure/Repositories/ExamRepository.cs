using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class ExamRepository : IExamRepository
{
    private readonly AppDbContext _context;

    public ExamRepository(AppDbContext context) => _context = context;

    public async Task<Exam?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.Exams
            .Include(e => e.Analysis)
            .FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<Exam?> GetByAnalysisIdAsync(Guid analysisId, CancellationToken ct = default) =>
        await _context.Exams
            .Include(e => e.Analysis)
            .FirstOrDefaultAsync(e => e.AnalysisId == analysisId, ct);

    public async Task<IReadOnlyList<Exam>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default) =>
        await _context.Exams
            .Include(e => e.Analysis)
            .Where(e => e.TeacherId == teacherId)
            .OrderByDescending(e => e.Date)
            .ToListAsync(ct);

    public async Task<Exam> AddAsync(Exam entity, CancellationToken ct = default)
    {
        _context.Exams.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }

    public async Task UpdateAsync(Exam entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _context.Exams.Update(entity);
        await _context.SaveChangesAsync(ct);
    }
}
