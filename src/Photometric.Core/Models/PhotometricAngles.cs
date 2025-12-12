namespace Photometric.Core.Models;

/// <summary>
/// Angular definition of a photometric system.
/// </summary>
public class PhotometricAngles
{
    /// <summary>
    /// Vertical angles (Gamma), usually 0–180 degrees.
    /// </summary>
    public IReadOnlyList<double> Vertical { get; init; } = Array.Empty<double>();

    /// <summary>
    /// Horizontal angles (C-planes), usually 0–360 degrees.
    /// </summary>
    public IReadOnlyList<double> Horizontal { get; init; } = Array.Empty<double>();

    /// <summary>
    /// Photometric type (e.g. C, B, A).
    /// </summary>
    public string Type { get; init; } = "C";
}
