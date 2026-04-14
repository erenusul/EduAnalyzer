using System.Net.Http;
using System.Security.Claims;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Exceptions;
using EduAnalyzer.Application.Interfaces;
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
    private readonly IMlServiceClient _mlClient;

    public ExamsController(IExamService service, IMlServiceClient mlClient)
    {
        _service = service;
        _mlClient = mlClient;
    }

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

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteExam(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.DeleteExamAsync(id, TeacherId, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/results/scan")]
    public async Task<ActionResult<ScanExamResponse>> ScanResult(Guid id, [FromBody] ScanExamRequest request, CancellationToken ct)
    {
        var response = await _service.ScanAndSaveResultAsync(id, TeacherId, request, ct);
        return Ok(response);
    }

    [HttpPost("{id:guid}/results/scan-image")]
    public async Task<ActionResult<ScanExamResponse>> ScanImage(
        Guid id,
        [FromForm] Guid studentId,
        [FromForm] IFormFile file,
        [FromForm] int? questionCount,
        [FromForm] int? optionCount,
        [FromForm] string? opticalTemplate,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Görsel dosyası gerekli.");

        var exam = await _service.GetByIdAsync(id, TeacherId, ct);
        if (exam == null) return NotFound();
        var count = questionCount ?? exam.AnswerKey?.Count ?? 20;

        try
        {
            await using var stream = file.OpenReadStream();
            var ocrResult = await _mlClient.ScanOpticalFormAsync(
                stream,
                count,
                optionCount,
                file.ContentType,
                opticalTemplate,
                ct);

            OpticalScanStrictValidator.EnsureAcceptable(ocrResult);

            var keyList = exam.AnswerKey?.ToList() ?? new List<string>();
            var normalizedAnswers = OpticalReadGradingNormalizer.NormalizeAgainstAnswerKey(
                ocrResult.Answers,
                keyList);
            var request = new ScanExamRequest(studentId, normalizedAnswers);
            var response = await _service.ScanAndSaveResultAsync(id, TeacherId, request, ct);
            return Ok(response);
        }
        catch (HttpRequestException ex) when (!string.IsNullOrEmpty(ex.Message))
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (OpticalScanRejectedException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("results")]
    public async Task<ActionResult<ExamResultDto>> AddResult([FromBody] CreateExamResultRequest request, CancellationToken ct)
    {
        var dto = await _service.AddExamResultAsync(TeacherId, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = request.ExamId }, dto);
    }

    [HttpPut("results/{id:guid}")]
    public async Task<ActionResult<ExamResultDto>> UpdateResult(Guid id, [FromBody] UpdateExamResultRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _service.UpdateExamResultAsync(id, TeacherId, request, ct);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("results/{id:guid}")]
    public async Task<IActionResult> DeleteResult(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.DeleteExamResultAsync(id, TeacherId, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }
}
