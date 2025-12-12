namespace Photometric.Core.Models.IES;

/// <summary>
/// IES photometric system parameters.
/// </summary>
public class IesPhotometry
{
    /// <summary>
    /// Photometric type (1 = Type C, 2 = Type B, 3 = Type A).
    /// </summary>
    public int PhotometricType { get; init; }

    /// <summary>
    /// Units type (1 = feet, 2 = meters).
    /// </summary>
    public int UnitsType { get; init; }

    /// <summary>
    /// Number of lamps.
    /// </summary>
    public int LampCount { get; init; }

    /// <summary>
    /// Lumens per lamp.
    /// </summary>
    public double LumensPerLamp { get; init; }

    /// <summary>
    /// Candela multiplier.
    /// </summary>
    public double CandelaMultiplier { get; init; }

    /// <summary>
    /// Ballast factor.
    /// </summary>
    public double BallastFactor { get; init; }

    /// <summary>
    /// Input watts.
    /// </summary>
    public double InputWatts { get; init; }
}
