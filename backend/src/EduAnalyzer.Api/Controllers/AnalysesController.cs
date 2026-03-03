using System.Net.Http;
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

    [HttpPost("pdf-result")]
    public async Task<ActionResult<AnalysisRecordDto>> CreateFromPdfResult(
        [FromBody] CreatePdfResultRequest request,
        CancellationToken ct = default)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();

        var mlResult = MapToPdfResponseDto(request);
        var dto = await _service.CreateFromPdfAsync(teacher.Id, request.Title, request.FileName, mlResult, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    private static PdfAnalysisResponseDto MapToPdfResponseDto(CreatePdfResultRequest r)
    {
        var results = new List<QuestionAnalysisResultDto>();
        if (r.Results is System.Text.Json.JsonElement arr && arr.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var item in arr.EnumerateArray())
            {
                var subject = ParsePredictions(item.TryGetProperty("subject", out var s) ? s : default);
                var topic = ParsePredictions(item.TryGetProperty("topic", out var t) ? t : default);
                results.Add(new QuestionAnalysisResultDto(
                    item.TryGetProperty("question_id", out var qi) ? qi.GetString() ?? "" : "",
                    item.TryGetProperty("question_text", out var qt) ? qt.GetString() ?? "" : "",
                    subject,
                    topic,
                    item.TryGetProperty("has_visual", out var hv) && hv.GetBoolean()
                ));
            }
        }
        return new PdfAnalysisResponseDto(r.TotalQuestions, r.AnalyzedQuestions, results, r.Warning);
    }

    private static IReadOnlyList<PredictionItemDto> ParsePredictions(System.Text.Json.JsonElement el)
    {
        if (el.ValueKind != System.Text.Json.JsonValueKind.Array) return Array.Empty<PredictionItemDto>();
        var list = new List<PredictionItemDto>();
        foreach (var item in el.EnumerateArray())
        {
            var label = item.TryGetProperty("label", out var l) ? l.GetString() ?? "" : "";
            var conf = item.TryGetProperty("confidence", out var c) ? c.GetDouble() : 0;
            list.Add(new PredictionItemDto(label, conf));
        }
        return list;
    }

    [HttpPost("single")]
    public async Task<ActionResult<AnalysisRecordDto>> CreateSingle([FromBody] CreateSingleAnalysisRequest request, CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var dto = await _service.CreateFromSingleAsync(teacher.Id, request, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
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

        try
        {
            await using var stream = file.OpenReadStream();
            var mlResult = await _mlClient.AnalyzePdfAsync(stream, file.FileName, useOcr, topKSubject, topKTopic, ct);
            var dto = await _service.CreateFromPdfAsync(teacher.Id, file.FileName, file.FileName, mlResult, ct);
            return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
        }
        catch (HttpRequestException ex) when (!string.IsNullOrEmpty(ex.Message))
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var teacher = await _teacherRepo.GetByUserIdAsync(UserId, ct);
        if (teacher == null) return Forbid();
        var ok = await _service.DeleteAsync(id, teacher.Id, ct);
        if (!ok) return NotFound();
        return NoContent();
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
        var dto = await _service.CreateExamFromAnalysisAsync(id, teacher.Id, request.WeekLabel, request.Date, request.SelectedIndices, request.AnswerKey, ct);
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

public record CreateExamRequest(string WeekLabel, DateTime Date, int[]? SelectedIndices = null, string[]? AnswerKey = null);
