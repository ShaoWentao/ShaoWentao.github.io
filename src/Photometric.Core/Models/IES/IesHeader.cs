namespace Photometric.Core.Models.IES;

public record IesHeader
{
    public string IesVersion { get; init; } = "";
    public IesTilt Tilt { get; init; } = new();
    public IesPhotometry Photometry { get; init; } = new();
}
