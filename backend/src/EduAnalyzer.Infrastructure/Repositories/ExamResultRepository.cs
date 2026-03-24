using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class ExamResultRepository : IExamResultRepository
{
    private readonly AppDbContext _context;

    public ExamResultRepository(AppDbContext context) => _context = context;

    public async Task<ExamResult?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.ExamResults
            .Include(r => r.Student)
            .Include(r => r.Exam)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<IReadOnlyList<ExamResult>> GetByStudentIdAsync(Guid studentId, CancellationToken ct = default) =>
        await _context.ExamResults
            .Include(r => r.Exam)
            .Where(r => r.StudentId == studentId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ExamResult>> GetByExamIdAsync(Guid examId, CancellationToken ct = default) =>
        await _context.ExamResults
            .Include(r => r.Student)
            .Where(r => r.ExamId == examId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ExamResult>> GetByTeacherIdAsync(Guid teacherId, CancellationToken ct = default) =>
        await _context.ExamResults
            .Include(r => r.Student)
            .Include(r => r.Exam)
            .Where(r => r.Exam.TeacherId == teacherId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task<ExamResult> AddAsync(ExamResult entity, CancellationToken ct = default)
    {
        _context.ExamResults.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }

    public async Task UpdateAsync(ExamResult entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _context.ExamResults.Update(entity);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var deleted = await _context.ExamResults.Where(r => r.Id == id).ExecuteDeleteAsync(ct);
        return deleted > 0;
    }
}
