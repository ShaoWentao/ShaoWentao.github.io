using Photometric.Core.Models;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// Result of parsing an IES file (header + angles).
/// </summary>
public class IesParseResult
{
    /// <summary>
    /// Common photometric header (shared model).
    /// </summary>
    public PhotometricHeader CommonHeader { get; init; } = new();

    /// <summary>
    /// IES-specific header extension.
    /// </summary>
    public IesHeader IesHeader { get; init; } = new();

    /// <summary>
    /// Angular definition (vertical & horizontal angles).
    /// </summary>
    public PhotometricAngles Angles { get; init; } = new();
}
