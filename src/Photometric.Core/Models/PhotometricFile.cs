
namespace Photometric.Core.Models;

/// <summary>
/// A complete photometric file (IES / LDT / TM33).
/// </summary>
public class PhotometricFile
{
    /// <summary>
    /// File format identifier (IES, LDT, TM33, etc.).
    /// </summary>
    public string Format { get; init; } = string.Empty;

    /// <summary>
    /// Raw file name.
    /// </summary>
    public string FileName { get; init; } = string.Empty;

    /// <summary>
    /// Header / metadata section.
    /// </summary>
    public PhotometricHeader Header { get; init; } = new();

    /// <summary>
    /// Photometric angular definitions.
    /// </summary>
    public PhotometricAngles Angles { get; init; } = new();

    /// <summary>
    /// Candela intensity data.
    /// </summary>
    public CandelaMatrix Candela { get; init; } = new();
}
