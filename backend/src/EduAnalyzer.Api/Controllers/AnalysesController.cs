using System.Security.Claims;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Interfaces;
using EduAnalyzer.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduAnalyzer.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Teacher")]
public class AnalysesController : ControllerBase
{
    private readonly IAnalysisService _service;
    private readonly IMlServiceClient _mlClient;
    private readonly ITeacherRepository _teacherRepo;

    public AnalysesController(
        IAnalysisService service,
        IMlServiceClient mlClient,
        ITeacherRepository teacherRepo)
    {
        _service = service;
        _mlClient = mlClient;
        _teacherRepo = teacherRepo;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AnalysisRecordDto>>> GetAll(CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var list = await _service.GetByTeacherAsync(teacher.Id, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AnalysisRecordDto>> GetById(Guid id, CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var dto = await _service.GetByIdAsync(id, teacher.Id, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("pdf")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<AnalysisRecordDto>> AnalyzePdf(
        IFormFile file,
        [FromQuery] bool useOcr = false,
        [FromQuery] int topKSubject = 1,
        [FromQuery] int topKTopic = 3,
        CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "PDF dosyası gerekli." });
        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Sadece PDF dosyaları kabul edilir." });

        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();

        await using var stream = file.OpenReadStream();
        var mlResult = await _mlClient.AnalyzePdfAsync(stream, file.FileName, useOcr, topKSubject, topKTopic, ct);
        var dto = await _service.CreateFromPdfAsync(teacher.Id, file.FileName, file.FileName, mlResult, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}/results")]
    public async Task<ActionResult<AnalysisRecordDto>> UpdateResults(Guid id, [FromBody] object results, CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var dto = await _service.UpdateResultsAsync(id, teacher.Id, results, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("{id:guid}/exam")]
    public async Task<ActionResult<ExamDto>> CreateExam(Guid id, [FromBody] CreateExamRequest request, CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var dto = await _service.CreateExamFromAnalysisAsync(id, teacher.Id, request.WeekLabel, request.Date, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("exam/{examId:guid}/ready")]
    public async Task<ActionResult<ExamDto>> MarkExamReady(Guid examId, CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var dto = await _service.MarkExamReadyAsync(examId, teacher.Id, ct);
        if (dto == null) return NotFound();
        return Ok(dto);
    }
}

public record CreateExamRequest(string WeekLabel, DateTime Date);
