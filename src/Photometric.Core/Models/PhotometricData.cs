namespace Photometric.Core.Models;

/// <summary>
/// Strongly typed access to photometric numeric data.
/// </summary>
public class PhotometricData
{
    public PhotometricAngles Angles { get; init; } = new();
    public CandelaMatrix Candela { get; init; } = new();
}
