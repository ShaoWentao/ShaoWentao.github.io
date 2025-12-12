namespace Photometric.Core.Models.IES;

/// <summary>
/// IES TILT definition.
/// </summary>
public class IesTilt
{
    /// <summary>
    /// TILT type: NONE, INCLUDE, or FILE.
    /// </summary>
    public string Type { get; init; } = "NONE";

    /// <summary>
    /// Referenced external tilt file (if Type = FILE).
    /// </summary>
    public string? FileName { get; init; }

    /// <summary>
    /// Tilt angles in degrees (if INCLUDE).
    /// </summary>
    public IReadOnlyList<double>? Angles { get; init; }

    /// <summary>
    /// Multipliers corresponding to tilt angles.
    /// </summary>
    public IReadOnlyList<double>? Multipliers { get; init; }
}
