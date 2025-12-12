namespace Photometric.Core.Models.IES;

public record IesTilt
{
    /// <summary>NONE / INCLUDE / FILE</summary>
    public string Type { get; init; } = "NONE";

    /// <summary>If Type = FILE</summary>
    public string? FileName { get; init; }

    /// <summary>If Type = INCLUDE (not applied yet in this version)</summary>
    public IReadOnlyList<double>? Angles { get; init; }

    /// <summary>If Type = INCLUDE (not applied yet in this version)</summary>
    public IReadOnlyList<double>? Multipliers { get; init; }
}
