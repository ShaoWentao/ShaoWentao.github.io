using Photometric.Core.Models.Common;

namespace Photometric.Core.Models;

/// <summary>
/// Core photometric data structure (angles + candela).
/// </summary>
public class PhotometricData
{
    public PhotometricAngles Angles { get; init; } = new();
    public CandelaMatrix Candela { get; init; } = new();
}
