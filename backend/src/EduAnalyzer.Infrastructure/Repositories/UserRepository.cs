using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using EduAnalyzer.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context) => _context = context;

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _context.Users
            .Include(u => u.Teacher)
            .Include(u => u.Student)
            .Include(u => u.Parent)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        await _context.Users
            .Include(u => u.Teacher)
            .Include(u => u.Student)
            .Include(u => u.Parent)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task<User> AddAsync(User entity, CancellationToken ct = default)
    {
        _context.Users.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity;
    }
}
