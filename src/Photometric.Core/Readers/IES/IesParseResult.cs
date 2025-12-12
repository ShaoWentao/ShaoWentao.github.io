using Photometric.Core.Models.Common;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

public class IesParseResult
{
    public PhotometricHeader CommonHeader { get; init; } = new();
    public IesHeader IesHeader { get; init; } = new();
    public PhotometricAngles Angles { get; init; } = new();
    public CandelaMatrix Candela { get; init; } = new();
}
