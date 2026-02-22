using System.Text.Json.Serialization;

namespace EduAnalyzer.Application.DTOs;

public record WrongTopicDto(
    [property: JsonPropertyName("topic")] string Topic,
    [property: JsonPropertyName("count")] int Count
);

public record PagedResultDto<T>(IReadOnlyList<T> Items, int TotalCount);
