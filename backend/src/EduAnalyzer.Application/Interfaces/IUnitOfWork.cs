namespace EduAnalyzer.Application.Interfaces;

/// <summary>
/// Unit of Work - Tüm repository işlemlerini tek transaction altında toplar.
/// </summary>
public interface IUnitOfWork : IDisposable
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
