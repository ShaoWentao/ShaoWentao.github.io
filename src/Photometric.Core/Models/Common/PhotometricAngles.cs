namespace Photometric.Core.Models.Common;

public class PhotometricAngles
{
    /// <summary>Vertical angles (Gamma). Count = Nv</summary>
    public IReadOnlyList<double> Vertical { get; init; } = Array.Empty<double>();

    /// <summary>Horizontal angles (C-planes). Count = Nh</summary>
    public IReadOnlyList<double> Horizontal { get; init; } = Array.Empty<double>();

    /// <summary>Photometric type string: "C" / "B" / "A"</summary>
    public string Type { get; init; } = "C";
}
