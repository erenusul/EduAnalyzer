using System.Text.Json;
using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Exceptions;
using EduAnalyzer.Application.Services;

namespace EduAnalyzer.Tests;

public class OpticalScanStrictValidatorTests
{
    [Fact]
    public void EnsureAcceptable_Allows_Ambiguous_Rows_Without_Throwing()
    {
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("", "ambiguous", 0.45),
            new("B", "ok", 0.88)
        };
        var ex = Record.Exception(() => OpticalScanStrictValidator.EnsureAcceptable(
            new OpticalScanResultDto(
                new[] { "", "B" },
                2,
                true,
                true,
                per)));
        Assert.Null(ex);
    }

    [Fact]
    public void EnsureAcceptable_Allows_Ok_At_MinConfidence()
    {
        var per = new List<OpticalPerQuestionReadDto>
        {
            new("A", "ok", OpticalScanStrictValidator.MinOkConfidence)
        };
        var ex = Record.Exception(() => OpticalScanStrictValidator.EnsureAcceptable(
            new OpticalScanResultDto(new[] { "A" }, 1, true, true, per)));
        Assert.Null(ex);
    }

    [Fact]
    public void EnsureAcceptable_Throws_When_Ok_Below_MinConfidence()
    {
        var per = new List<OpticalPerQuestionReadDto> { new("A", "ok", OpticalScanStrictValidator.MinOkConfidence - 0.01) };
        Assert.Throws<OpticalScanRejectedException>(() =>
            OpticalScanStrictValidator.EnsureAcceptable(
                new OpticalScanResultDto(new[] { "A" }, 1, true, true, per)));
    }

    [Fact]
    public void EnsureAcceptable_Throws_When_Metadata_AlignmentScore_TooLow()
    {
        var per = new List<OpticalPerQuestionReadDto> { new("A", "ok", 0.9) };
        var meta = JsonSerializer.Deserialize<JsonElement>(
            """{"turkish_column":{"alignment":{"alignment_score":0.05}}}""");
        Assert.Throws<OpticalScanRejectedException>(() =>
            OpticalScanStrictValidator.EnsureAcceptable(
                new OpticalScanResultDto(new[] { "A" }, 1, true, true, per, meta)));
    }

    [Fact]
    public void EnsureAcceptable_Allows_When_Metadata_AlignmentScore_Adequate()
    {
        var per = new List<OpticalPerQuestionReadDto> { new("A", "ok", 0.9) };
        var meta = JsonSerializer.Deserialize<JsonElement>(
            """{"turkish_column":{"alignment":{"alignment_score":0.5},"ambiguous_count":0,"confidence_mean":0.4}}""");
        var ex = Record.Exception(() => OpticalScanStrictValidator.EnsureAcceptable(
            new OpticalScanResultDto(new[] { "A" }, 1, true, true, per, meta)));
        Assert.Null(ex);
    }
}
