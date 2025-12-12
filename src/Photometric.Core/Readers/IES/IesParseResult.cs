using Photometric.Core.Models;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

/// <summary>
/// Result of parsing an IES file header.
/// </summary>
public class IesParseResult
{
    public PhotometricHeader CommonHeader { get; init; } = new();
    public IesHeader IesHeader { get; init; } = new();
}
