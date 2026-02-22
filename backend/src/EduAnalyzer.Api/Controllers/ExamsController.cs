using System.Security.Claims;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Teacher")]
public class ExamsController : ControllerBase
{
    private readonly IExamService _service;

    public ExamsController(IExamService service) => _service = service;

    private Guid TeacherId => Guid.Parse(User.FindFirstValue("TeacherId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExamDto>>> GetAll(CancellationToken ct)
    {
        var list = await _service.GetByTeacherAsync(TeacherId, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExamDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, TeacherId, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("{id:guid}/results")]
    public async Task<ActionResult<IReadOnlyList<ExamResultDto>>> GetResults(Guid id, CancellationToken ct)
    {
        var list = await _service.GetResultsByExamAsync(id, TeacherId, ct);
        return Ok(list);
    }

    [HttpPost("results")]
    public async Task<ActionResult<ExamResultDto>> AddResult([FromBody] CreateExamResultRequest request, CancellationToken ct)
    {
        var dto = await _service.AddExamResultAsync(TeacherId, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = request.ExamId }, dto);
    }
}
