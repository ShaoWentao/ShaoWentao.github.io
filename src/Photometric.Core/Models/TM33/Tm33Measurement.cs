namespace Photometric.Core.Models.TM33;

/// <summary>
/// Measurement unit definitions for TM-33.
/// Mandatory block in TM-33-18.
/// </summary>
public class Tm33Measurement
{
    /// <summary>
    /// Length unit: "meter" or "foot".
    /// </summary>
    public string LengthUnit { get; init; } = "meter";

    /// <summary>
    /// Angle unit (always degree in TM-33).
    /// </summary>
    public string AngleUnit { get; init; } = "degree";

    /// <summary>
    /// Luminous intensity unit (candela).
    /// </summary>
    public string IntensityUnit { get; init; } = "candela";

    /// <summary>
    /// Flux unit (lumen).
    /// </summary>
    public string FluxUnit { get; init; } = "lumen";

    /// <summary>
    /// Power unit (watt).
    /// </summary>
    public string PowerUnit { get; init; } = "watt";
}
