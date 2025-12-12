using System.Collections.Generic;

namespace Photometric.Core.Models.Common
{
    public class CandelaMatrix
    {
        // ✅ 修复：添加 = new() 默认值
        public List<double> VerticalAngles { get; set; } = new();
        public List<double> HorizontalAngles { get; set; } = new();
        public double[,] Values { get; set; } = new double[0, 0];

        public double PeakCandela { get; set; }
        public double PeakPlaneIndex { get; set; }
        public double PeakVerticalAngle { get; set; }
        public double BeamAngle { get; set; }

        public CandelaMatrix() { }

        public CandelaMatrix(List<double> verticalAngles, List<double> horizontalAngles, double[,] values)
        {
            VerticalAngles = verticalAngles;
            HorizontalAngles = horizontalAngles;
            Values = values;
        }
    }
}
