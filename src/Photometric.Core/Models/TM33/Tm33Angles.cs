namespace Photometric.Core.Models.TM33;

/// <summary>
/// Angular definition for TM-33.
/// </summary>
public class Tm33Angles
{
    /// <summary>
    /// Vertical angles (Gamma).
    /// </summary>
    public IReadOnlyList<double> Vertical { get; init; } = Array.Empty<double>();

    /// <summary>
    /// Horizontal angles (C-planes).
    /// </summary>
    public IReadOnlyList<double> Horizontal { get; init; } = Array.Empty<double>();
}
