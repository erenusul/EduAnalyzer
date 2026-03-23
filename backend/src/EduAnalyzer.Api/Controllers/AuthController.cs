using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IUserRepository _userRepo;
    private readonly IStudentRepository _studentRepo;

    public AuthController(IAuthService authService, IUserRepository userRepo, IStudentRepository studentRepo)
    {
        _authService = authService;
        _userRepo = userRepo;
        _studentRepo = studentRepo;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request, ct);
        if (result != null)
            return Ok(result);

        var email = request.Email?.Trim();
        if (string.IsNullOrEmpty(email))
            return Unauthorized(new { message = "E-posta veya şifre hatalı." });

        var existingUser = await _userRepo.GetByEmailAsync(email, ct);
        if (existingUser != null)
            return Unauthorized(new { message = "E-posta veya şifre hatalı." });

        var studentWithoutAccount = await _studentRepo.GetByEmailWithoutUserAsync(email, ct);
        if (studentWithoutAccount != null)
        {
            return Unauthorized(new
            {
                message =
                    "Bu öğrenci kaydı için henüz mobil giriş şifresi tanımlanmadı. Öğretmen panelinde Öğrenci detayına girip «Şifreyi kaydet» ile şifre oluşturun."
            });
        }

        return Unauthorized(new { message = "E-posta veya şifre hatalı." });
    }
}
