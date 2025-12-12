using System.Collections.Generic;

namespace Photometric.Core.Models.Common
{
    public class CandelaMatrix
    {
        // 现有的属性...
        public List<double> VerticalAngles { get; set; }
        public List<double> HorizontalAngles { get; set; }
        public double[,] Values { get; set; }

        // 🟢 新增以下 4 个属性以修复 CS0117 错误
        public double PeakCandela { get; set; }
        public double PeakPlaneIndex { get; set; } // 或者叫 PeakHorizontalAngle
        public double PeakVerticalAngle { get; set; }
        public double BeamAngle { get; set; }

        // 构造函数 (确保参数类型匹配)
        public CandelaMatrix(List<double> verticalAngles, List<double> horizontalAngles, double[,] values)
        {
            VerticalAngles = verticalAngles;
            HorizontalAngles = horizontalAngles;
            Values = values;
        }

        // 如果有一个空的构造函数，也保留它
        public CandelaMatrix() { }
    }
}
