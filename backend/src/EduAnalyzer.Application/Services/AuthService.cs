using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EduAnalyzer.Application.Services;

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = "";
    public string Issuer { get; set; } = "EduAnalyzer";
    public string Audience { get; set; } = "EduAnalyzer";
    public int ExpirationMinutes { get; set; } = 60;
}

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
}

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepo;
    private readonly ITeacherRepository _teacherRepo;
    private readonly JwtOptions _jwtOptions;

    public AuthService(
        IUserRepository userRepo,
        ITeacherRepository teacherRepo,
        IOptions<JwtOptions> jwtOptions)
    {
        _userRepo = userRepo;
        _teacherRepo = teacherRepo;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByEmailAsync(request.Email, ct);
        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
            return null;

        var teacher = await _teacherRepo.GetByUserIdAsync(user.Id, ct);
        if (user.Role == UserRole.Teacher && teacher == null)
            return null;

        var token = await GenerateJwtAsync(user, ct);
        return new LoginResponse(
            token,
            "Bearer",
            DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes),
            new UserInfoDto(user.Id, user.Email, user.DisplayName, user.Role.ToString())
        );
    }

    public string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    public bool VerifyPassword(string password, string hash)
    {
        var computed = HashPassword(password);
        return string.Equals(computed, hash, StringComparison.Ordinal);
    }

    private async Task<string> GenerateJwtAsync(User user, CancellationToken ct)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.DisplayName),
            new(ClaimTypes.Role, user.Role.ToString())
        };
        if (user.Role == UserRole.Teacher)
        {
            var teacher = await _teacherRepo.GetByUserIdAsync(user.Id, ct);
            if (teacher != null)
                claims.Add(new Claim("TeacherId", teacher.Id.ToString()));
        }
        else if (user.Role == UserRole.Student && user.Student != null)
        {
            claims.Add(new Claim("StudentId", user.Student.Id.ToString()));
        }
        else if (user.Role == UserRole.Parent && user.Parent != null)
        {
            claims.Add(new Claim("ParentId", user.Parent.Id.ToString()));
        }
        var token = new JwtSecurityToken(
            _jwtOptions.Issuer,
            _jwtOptions.Audience,
            claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
