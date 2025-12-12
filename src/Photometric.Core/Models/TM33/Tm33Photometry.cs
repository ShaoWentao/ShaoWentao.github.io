namespace Photometric.Core.Models.TM33;

/// <summary>
/// Photometric section of TM-33.
/// </summary>
public class Tm33Photometry
{
    /// <summary>
    /// Photometric type (C, B, A).
    /// </summary>
    public string Type { get; init; } = "C";

    public Tm33Angles Angles { get; init; } = new();

    public Tm33CandelaMatrix Candela { get; init; } = new();
}
