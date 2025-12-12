using Photometric.Core.Models.Common;

namespace Photometric.Core.Models.IES;

/// <summary>
/// IES-specific header extension.
/// </summary>
public class IesHeader
{
    public string IesVersion { get; init; } = string.Empty;

    public IesTilt Tilt { get; init; } = new();

    public IesPhotometry Photometry { get; init; } = new();

    public LuminaireDimensions? Dimensions { get; init; }
}
