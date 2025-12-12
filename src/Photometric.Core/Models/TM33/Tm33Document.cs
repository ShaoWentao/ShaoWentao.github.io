using Photometric.Core.Models.TM33;

namespace Photometric.Core.Models.TM33;

public class Tm33Document
{
    public Tm33FileInformation FileInformation { get; init; } = new();
    public Tm33Measurement Measurement { get; init; } = new();

    public Tm33Header Header { get; init; } = new();
    public Tm33Luminaire Luminaire { get; init; } = new();
    public Tm33Photometry Photometry { get; init; } = new();
}
