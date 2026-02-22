using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Infrastructure.Data;

namespace EduAnalyzer.Infrastructure.Repositories;

/// <summary>
/// Unit of Work implementasyonu - DbContext üzerinden transaction yönetimi.
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    public void Dispose() => _context.Dispose();
}
