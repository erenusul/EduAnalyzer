using EduAnalyzer.Application.DTOs;
using EduAnalyzer.Application.Exceptions;
using EduAnalyzer.Application.Interfaces;
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
}
