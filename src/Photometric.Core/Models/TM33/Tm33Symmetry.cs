namespace Photometric.Core.Models.TM33;

/// <summary>
/// Photometric symmetry definition per TM-33.
/// </summary>
public class Tm33Symmetry
{
    /// <summary>
    /// Symmetry type:
    /// - "None"
    /// - "Axial"
    /// - "Bilateral"
    /// </summary>
    public string Type { get; init; } = "None";
}
