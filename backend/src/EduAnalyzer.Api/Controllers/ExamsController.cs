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

    [HttpGet("results")]
    public async Task<ActionResult<IReadOnlyList<ExamResultDto>>> GetAllResults(CancellationToken ct)
    {
        var list = await _service.GetResultsByTeacherAsync(TeacherId, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}/results")]
    public async Task<ActionResult<IReadOnlyList<ExamResultDto>>> GetResults(Guid id, CancellationToken ct)
    {
        var list = await _service.GetResultsByExamAsync(id, TeacherId, ct);
        return Ok(list);
    }

    [HttpPut("{id:guid}/answer-key")]
    public async Task<ActionResult<ExamDto>> UpdateAnswerKey(Guid id, [FromBody] IReadOnlyList<string> answerKey, CancellationToken ct)
    {
        var dto = await _service.UpdateAnswerKeyAsync(id, TeacherId, answerKey, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("{id:guid}/results/scan")]
    public async Task<ActionResult<ScanExamResponse>> ScanResult(Guid id, [FromBody] ScanExamRequest request, CancellationToken ct)
    {
        var response = await _service.ScanAndSaveResultAsync(id, TeacherId, request, ct);
        return Ok(response);
    }

    [HttpPost("results")]
    public async Task<ActionResult<ExamResultDto>> AddResult([FromBody] CreateExamResultRequest request, CancellationToken ct)
    {
        var dto = await _service.AddExamResultAsync(TeacherId, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = request.ExamId }, dto);
    }
}
