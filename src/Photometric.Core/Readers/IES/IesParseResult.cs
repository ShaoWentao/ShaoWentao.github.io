using Photometric.Core.Models;
using Photometric.Core.Models.IES;

namespace Photometric.Core.Readers.IES;

public class IesParseResult
{
    public PhotometricHeader CommonHeader { get; init; } = new();
    public IesHeader IesHeader { get; init; } = new();

    // ⭐ 新增：角度定义
    public PhotometricAngles Angles { get; init; } = new();
}
