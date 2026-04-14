namespace EduAnalyzer.Application.Services;

/// <summary>
/// Optikten gelen harfleri cevap anahtarına göre puanlamaya hazırlar (A–D anahtarda E okuması → boş).
/// </summary>
public static class OpticalReadGradingNormalizer
{
    public static List<string> NormalizeAgainstAnswerKey(
        IReadOnlyList<string> opticalAnswers,
        IReadOnlyList<string> answerKey)
    {
        var keyAllowsE = answerKey.Any(static k =>
            string.Equals(k?.Trim(), "E", StringComparison.OrdinalIgnoreCase));
        if (keyAllowsE)
        {
            return opticalAnswers.Select(static a => (a ?? "").Trim().ToUpperInvariant()).ToList();
        }

        return opticalAnswers
            .Select(static a =>
            {
                var t = (a ?? "").Trim();
                if (t.Length == 0)
                    return "";
                var first = char.ToUpperInvariant(t[0]);
                if (first == 'E')
                    return "";
                return first.ToString();
            })
            .ToList();
    }
}
