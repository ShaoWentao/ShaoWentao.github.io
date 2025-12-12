using Photometric.Core.Models.Common;

namespace Photometric.Core.Models;

/// <summary>
/// High-level container for photometric data files (IES, LDT, TM-33, etc.).
/// </summary>
public class PhotometricFile
{
    public PhotometricHeader Header { get; init; } = new();
    public PhotometricAngles Angles { get; init; } = new();
    public CandelaMatrix Candela { get; init; } = new();
}
